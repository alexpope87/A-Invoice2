/**
 * POST /api/public/extract-invoice
 *
 * Downloads a PDF from the private "invoices" Supabase Storage bucket and sends
 * it to the Google Gemini API for structured extraction.
 *
 * This version is TEST ONLY: it does not write to the database and does not
 * change the upload flow. The extracted JSON is returned in the response.
 *
 * SECURITY: GEMINI_API_KEY is read server-side only, never logged, and never
 * shipped to the browser. Invoice contents are never logged.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, Type } from "@google/genai";

// Current Gemini model with document/PDF understanding + structured output.
const MODEL = "gemini-3.6-flash";

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

          let text: string | undefined;
          try {
            const response = await ai.models.generateContent({
              model: MODEL,
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      inlineData: {
                        mimeType: "application/pdf",
                        data: toBase64(bytes),
                      },
                    },
                    {
                      text: "Extract the invoice fields from this PDF and return JSON only.",
                    },
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
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            console.error("Gemini API request failed", message.slice(0, 300));
            const status = /\b(401|403|API key)\b/i.test(message)
              ? 500
              : /\b429\b|quota|rate limit/i.test(message)
                ? 429
                : 502;
            return json(
              {
                error:
                  status === 500
                    ? "Gemini rejected the API key"
                    : status === 429
                      ? "Gemini rate limit or quota issue"
                      : "Gemini API request failed",
                detail: message.slice(0, 300),
              },
              status,
            );
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
