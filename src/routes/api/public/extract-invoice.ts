/**
 * POST /api/public/extract-invoice
 *
 * Downloads a PDF from the private "invoices" Supabase Storage bucket and sends
 * it to the OpenAI Responses API for structured extraction.
 *
 * This first version is TEST ONLY: it does not write to the database and does
 * not change the upload flow. The extracted JSON is returned in the response.
 *
 * SECURITY: OPENAI_API_KEY is read server-side only, never logged, and never
 * shipped to the browser. Invoice contents are never logged.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Current OpenAI model that accepts PDF (input_file) content.
const MODEL = "gpt-4.1";

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    supplier_name: { type: ["string", "null"] },
    invoice_number: { type: ["string", "null"] },
    invoice_date: { type: ["string", "null"] },
    due_date: { type: ["string", "null"] },
    subtotal: { type: ["number", "null"] },
    vat: { type: ["number", "null"] },
    total: { type: ["number", "null"] },
    currency: { type: ["string", "null"] },
    category: { type: ["string", "null"] },
    confidence_score: { type: ["number", "null"] },
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

          const openaiKey = process.env["OPENAI_API_KEY"];
          if (!openaiKey) {
            return json({ error: "OPENAI_API_KEY is not configured on the server" }, 500);
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

          const fileName = storagePath.split("/").pop() || "invoice.pdf";
          const dataUrl = `data:application/pdf;base64,${toBase64(bytes)}`;

          let openaiRes: Response;
          try {
            openaiRes = await fetch("https://api.openai.com/v1/responses", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${openaiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: MODEL,
                instructions: INSTRUCTIONS,
                input: [
                  {
                    role: "user",
                    content: [
                      { type: "input_file", filename: fileName, file_data: dataUrl },
                      {
                        type: "input_text",
                        text: "Extract the invoice fields from this PDF and return JSON only.",
                      },
                    ],
                  },
                ],
                text: {
                  format: {
                    type: "json_schema",
                    name: "invoice_extraction",
                    strict: true,
                    schema: SCHEMA,
                  },
                },
              }),
            });
          } catch (e) {
            console.error("OpenAI request failed to send", e instanceof Error ? e.message : e);
            return json({ error: "Could not reach the OpenAI API" }, 502);
          }

          if (!openaiRes.ok) {
            const detail = await openaiRes.text();
            console.error("OpenAI API error", openaiRes.status, detail.slice(0, 300));
            if (openaiRes.status === 429) return json({ error: "OpenAI rate limit reached" }, 429);
            if (openaiRes.status === 401) return json({ error: "OpenAI rejected the API key" }, 500);
            return json({ error: "OpenAI API request failed", status: openaiRes.status }, 502);
          }

          const result = (await openaiRes.json()) as {
            output_text?: string;
            output?: Array<{ content?: Array<{ text?: string }> }>;
          };

          let text = result.output_text;
          if (!text && Array.isArray(result.output)) {
            for (const item of result.output) {
              for (const part of item.content ?? []) {
                if (typeof part.text === "string") text = (text ?? "") + part.text;
              }
            }
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
