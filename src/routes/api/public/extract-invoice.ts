/**
 * POST /api/public/extract-invoice
 *
 * Downloads a PDF from the private "invoices" Supabase Storage bucket and sends
 * it to the Google Gemini API for structured extraction.
 *
 * Returns the extracted JSON; the upload page saves it and runs the
 * deterministic validation/risk/decision pipeline. Upstream failures keep
 * their status: 429 (quota, no auto-retry), 503 (after one retry), 502 other.
 *
 * SECURITY: GEMINI_API_KEY is read server-side only, never logged, and never
 * shipped to the browser. Invoice contents are never logged.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, Type } from "@google/genai";

// Current Gemini model with document/PDF understanding + structured output.
const MODEL = "gemini-3.5-flash-lite";

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    supplier_name: { type: Type.STRING, nullable: true },
    invoice_number: { type: Type.STRING, nullable: true },
    invoice_date: { type: Type.STRING, nullable: true },
    due_date: { type: Type.STRING, nullable: true },
    subtotal: { type: Type.NUMBER, nullable: true },
    vat: { type: Type.NUMBER, nullable: true },
    total: { type: Type.NUMBER, nullable: true },
    currency: { type: Type.STRING, nullable: true },
    category: { type: Type.STRING, nullable: true },
    confidence_score: { type: Type.NUMBER },
  },
  required: [
    "supplier_name",
    "invoice_number",
    "invoice_date",
    "due_date",
    "subtotal",
    "vat",
    "total",
    "currency",
    "category",
    "confidence_score",
  ],
  propertyOrdering: [
    "supplier_name",
    "invoice_number",
    "invoice_date",
    "due_date",
    "subtotal",
    "vat",
    "total",
    "currency",
    "category",
    "confidence_score",
  ],
};

const INSTRUCTIONS = [
  "You extract structured data from invoice PDFs and return JSON only.",
  "Never invent information. If a field is missing or unreadable, return null.",
  "Dates must use the YYYY-MM-DD format when possible, otherwise null.",
  "Amounts must be plain numbers without currency symbols or thousand separators.",
  "Currency must be an ISO 4217 code such as EUR, USD or GBP.",
  "category is a short business expense category inferred from the invoice content.",
  "confidence_score is a number between 0 and 100 describing overall extraction confidence.",
  "Base every value strictly on information actually present in the PDF.",
].join(" ");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

export const Route = createFileRoute("/api/public/extract-invoice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let payload: { invoice_id?: unknown; storage_path?: unknown };
          try {
            payload = (await request.json()) as typeof payload;
          } catch {
            return json({ error: "Request body must be valid JSON" }, 400);
          }

          const invoiceId =
            typeof payload.invoice_id === "string" ? payload.invoice_id.trim() : "";
          const storagePath =
            typeof payload.storage_path === "string" ? payload.storage_path.trim() : "";

          if (!invoiceId) return json({ error: "Missing required field: invoice_id" }, 400);
          if (!storagePath) return json({ error: "Missing required field: storage_path" }, 400);

          const geminiKey = process.env["GEMINI_API_KEY"];
          if (!geminiKey) {
            return json({ error: "GEMINI_API_KEY is not configured on the server" }, 500);
          }

          const supabaseUrl = process.env["SUPABASE_URL"];
          const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
          if (!supabaseUrl || !serviceRoleKey) {
            return json({ error: "Supabase server credentials are not configured" }, 500);
          }

          const supabase = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: {
              fetch: (input, init) => {
                const h = new Headers(init?.headers);
                if (
                  serviceRoleKey.startsWith("sb_") &&
                  h.get("Authorization") === `Bearer ${serviceRoleKey}`
                ) {
                  h.delete("Authorization");
                }
                h.set("apikey", serviceRoleKey);
                return fetch(input, { ...init, headers: h });
              },
            },
          });

          const { data: file, error: downloadError } = await supabase.storage
            .from("invoices")
            .download(storagePath);

          if (downloadError || !file) {
            return json(
              {
                error: "Could not download the PDF from the invoices bucket",
                detail: downloadError?.message ?? "File not found",
              },
              404,
            );
          }

          const bytes = new Uint8Array(await file.arrayBuffer());
          if (bytes.byteLength === 0) return json({ error: "The stored PDF is empty" }, 422);

          const ai = new GoogleGenAI({ apiKey: geminiKey });
          const pdfData = toBase64(bytes);

          // Retry policy: max 2 attempts. Only 503 UNAVAILABLE gets one retry
          // after ~5s. 429 is never retried automatically (protects quota).
          const MAX_ATTEMPTS = 2;
          const RETRY_503_DELAY_MS = 5000;

          const classify = (err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            const rawStatus = (err as { status?: unknown })?.status;
            const status =
              typeof rawStatus === "number"
                ? rawStatus
                : Number(message.match(/\b(4\d\d|5\d\d)\b/)?.[1] ?? 0);
            let category: "quota" | "unavailable" | "auth" | "other" = "other";
            if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(message))
              category = "quota";
            else if (status === 503 || /UNAVAILABLE|overloaded|high demand/i.test(message))
              category = "unavailable";
            else if (status === 401 || status === 403 || /API key|PERMISSION_DENIED/i.test(message))
              category = "auth";
            const delay = message.match(/retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)s/i)?.[1];
            const retryAfterSeconds = delay ? Math.ceil(Number(delay)) : null;
            return { status, category, retryAfterSeconds };
          };

          let text: string | undefined;
          let failure: ReturnType<typeof classify> | null = null;
          for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
              const response = await ai.models.generateContent({
                model: MODEL,
                contents: [
                  {
                    role: "user",
                    parts: [
                      { inlineData: { mimeType: "application/pdf", data: pdfData } },
                      { text: "Extract the invoice fields from this PDF and return JSON only." },
                    ],
                  },
                ],
                config: {
                  systemInstruction: INSTRUCTIONS,
                  responseMimeType: "application/json",
                  responseSchema: RESPONSE_SCHEMA,
                },
              });
              text = response.text;
              failure = null;
              break;
            } catch (err) {
              failure = classify(err);
              // Sanitized diagnostics only: no key, no invoice content.
              console.error("Gemini request failed", {
                attempt,
                status: failure.status,
                category: failure.category,
              });
              if (failure.category === "unavailable" && attempt < MAX_ATTEMPTS) {
                await new Promise((r) => setTimeout(r, RETRY_503_DELAY_MS));
                continue;
              }
              break;
            }
          }

          if (failure) {
            if (failure.category === "quota") {
              const secs = failure.retryAfterSeconds;
              const wait = secs ? `about ${secs} seconds` : "about 1 minute";
              return new Response(
                JSON.stringify({
                  error: `Gemini request limit reached. Please wait ${wait} and retry processing.`,
                  retryable: true,
                  retry_after_seconds: secs ?? 60,
                }),
                {
                  status: 429,
                  headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-store",
                    "Retry-After": String(secs ?? 60),
                  },
                },
              );
            }
            if (failure.category === "unavailable") {
              return json(
                {
                  error:
                    "Gemini is temporarily unavailable due to high demand. Your invoice has been saved. Please retry processing in a moment.",
                  retryable: true,
                },
                503,
              );
            }
            if (failure.category === "auth") {
              return json({ error: "Gemini rejected the server API key configuration" }, 500);
            }
            return json({ error: "Gemini API request failed", retryable: true }, 502);
          }

          if (!text || !text.trim()) {
            return json({ error: "The model returned an empty response" }, 502);
          }

          let extracted: unknown;
          try {
            extracted = JSON.parse(text);
          } catch {
            console.error("Model returned non-JSON output");
            return json({ error: "The model returned output that is not valid JSON" }, 502);
          }

          return json({ invoice_id: invoiceId, storage_path: storagePath, extracted });
        } catch (e) {
          console.error("extract-invoice failed", e instanceof Error ? e.message : e);
          return json({ error: "Unexpected server error" }, 500);
        }
      },
    },
  },
});
