import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/integrations/supabase/types";
import { runEngine } from "@/lib/risk-engine";
import {
  DB_RISK,
  DB_STATUS,
  toRisk,
  toStatus,
  type ActivityPoint,
  type Invoice,
  type Kpis,
  type ValidationCheck,
  type ValidationState,
} from "@/data/invoices";

type Row = Database["public"]["Tables"]["invoices"]["Row"];

function client() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        // Transient network hiccups ("fetch failed") would otherwise blank the page.
        let lastError: unknown;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            return await fetch(input, { ...init, headers: h });
          } catch (e) {
            lastError = e;
            await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
          }
        }
        throw new Error(
          `Could not reach the invoice database. ${lastError instanceof Error ? lastError.message : ""}`.trim(),
        );
      },

    },
  });
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function parseChecks(value: unknown): ValidationCheck[] {
  const obj = asObject(value);
  const raw = obj?.["checks"];
  if (!Array.isArray(raw)) return [];
  return raw.map((entry, index) => {
    const c = asObject(entry) ?? {};
    const state = String(c["state"] ?? "pass");
    return {
      id: `check-${index}`,
      label: String(c["label"] ?? "Validation check"),
      state: (["pass", "warn", "fail"].includes(state) ? state : "pass") as ValidationState,
      detail: String(c["detail"] ?? ""),
    };
  });
}

function mapRow(row: Row): Invoice {
  const extracted = asObject(row.extracted_data);
  return {
    id: row.id,
    number: row.invoice_number ?? "—",
    supplier: row.supplier_name ?? "Unknown supplier",
    supplierVat: String(extracted?.["supplier_vat"] ?? "—"),
    issueDate: row.invoice_date ?? "",
    dueDate: row.due_date ?? "",
    subtotal: Number(row.subtotal ?? 0),
    vat: Number(row.vat ?? 0),
    total: Number(row.total ?? 0),
    currency: row.currency ?? "EUR",
    category: row.category ?? "Uncategorised",
    confidence: Number(row.confidence_score ?? 0),
    risk: toRisk(row.risk_level),
    status: toStatus(row.status),
    reason: row.review_reason ?? undefined,
    checks: parseChecks(row.validation_results),
    extractedData: extracted
      ? Object.fromEntries(
          Object.entries(extracted).map(([k, v]) => [
            k,
            v === null || v === undefined ? "—" : String(v),
          ]),
        )
      : undefined,
    sourceFileName: row.source_file_name ?? undefined,
    processingTimeSeconds: row.processing_time_seconds ?? undefined,
  };
}

export type ListInput = {
  search?: string;
  status?: string;
  risk?: string;
  category?: string;
  statuses?: string[];
  sortKey?: "issueDate" | "total";
  sortDesc?: boolean;
  page?: number;
  pageSize?: number;
};

export const listInvoices = createServerFn({ method: "GET" })
  .inputValidator((input: ListInput) => input ?? {})
  .handler(async ({ data }) => {
    const page = data.page ?? 0;
    const pageSize = data.pageSize ?? 10;
    const supabase = client();

    let query = supabase.from("invoices").select("*", { count: "exact" });

    if (data.statuses?.length) {
      query = query.in(
        "status",
        data.statuses.map((s) => DB_STATUS[s as keyof typeof DB_STATUS] ?? s),
      );
    }
    if (data.status && data.status !== "all") {
      query = query.eq("status", DB_STATUS[data.status as keyof typeof DB_STATUS] ?? data.status);
    }
    if (data.risk && data.risk !== "all") {
      query = query.eq("risk_level", DB_RISK[data.risk as keyof typeof DB_RISK] ?? data.risk);
    }
    if (data.category && data.category !== "all") {
      query = query.eq("category", data.category);
    }
    const search = data.search?.trim();
    if (search) {
      const safe = search.replace(/[%,()]/g, " ");
      query = query.or(`supplier_name.ilike.%${safe}%,invoice_number.ilike.%${safe}%`);
    }

    const column = data.sortKey === "total" ? "total" : "invoice_date";
    query = query
      .order(column, { ascending: data.sortDesc === false })
      .order("created_at", { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);

    const { data: rows, count, error } = await query;
    if (error) throw new Error(error.message);

    return { rows: (rows ?? []).map(mapRow), total: count ?? 0 };
  });

export const getInvoiceById = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const supabase = client();
    const { data: row, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ? mapRow(row) : null;
  });

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = client();
  const { data, error } = await supabase.from("invoices").select("category").limit(1000);
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  for (const r of data ?? []) if (r.category) set.add(r.category);
  return [...set].sort();
});

export const getDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = client();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .order("invoice_date", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);

  const invoices = (data ?? []).map(mapRow);
  const total = invoices.length;
  const autoApproved = invoices.filter((i) => i.status === "auto-approved").length;
  const needsReview = invoices.filter((i) => i.status === "needs-review").length;
  const rejected = invoices.filter((i) => i.status === "rejected").length;
  const processingCount = invoices.filter((i) => i.status === "processing").length;
  const hoursSaved = (autoApproved * 8) / 60;
  const confidenceValues = invoices.filter((i) => i.confidence > 0).map((i) => i.confidence);

  const kpis: Kpis = {
    totalInvoices: total,
    autoApproved,
    needsReview,
    rejected,
    // Denominator excludes invoices still in Processing.
    automationRate: total - processingCount
      ? Math.round((autoApproved / (total - processingCount)) * 100)
      : 0,
    averageConfidence: confidenceValues.length
      ? Math.round(
          (confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length) * 10,
        ) / 10
      : 0,
    hoursSaved: Math.round(hoursSaved * 10) / 10,
    monthlySavings: Math.round(hoursSaved * 25),
  };

  // Weekly processing activity (7 most recent weeks with data).
  const buckets = new Map<string, { approved: number; review: number }>();
  for (const inv of invoices) {
    if (!inv.issueDate) continue;
    const date = new Date(`${inv.issueDate}T00:00:00Z`);
    const day = date.getUTCDay();
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    const bucket = buckets.get(key) ?? { approved: 0, review: 0 };
    if (inv.status === "auto-approved") bucket.approved += 1;
    else bucket.review += 1;
    buckets.set(key, bucket);
  }
  const activity: ActivityPoint[] = [...buckets.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-7)
    .map(([key, value]) => ({
      day: `${key.slice(8, 10)}/${key.slice(5, 7)}`,
      approved: value.approved,
      review: value.review,
    }));

  return {
    kpis,
    activity,
    recent: invoices.slice(0, 8),
    alerts: invoices.filter((i) => i.status === "needs-review").slice(0, 4),
  };
});

/**
 * Creates the invoice record right after the PDF lands in the private
 * "invoices" bucket. No mock values: the row starts as PROCESSING and is
 * filled in by the Gemini extraction step.
 * DEMO ONLY write path — replace with authenticated writes before production.
 */
export const createUploadedInvoice = createServerFn({ method: "POST" })
  .inputValidator((input: { fileName: string; storagePath: string }) => input)
  .handler(async ({ data }) => {
    const supabase = client();
    const { data: row, error } = await supabase
      .from("invoices")
      .insert({
        status: "PROCESSING",
        source_file_name: data.fileName,
        extracted_data: { storage_path: data.storagePath },
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: row.id, storagePath: data.storagePath };
  });

export type ExtractedInvoice = {
  supplier_name?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  due_date?: string | null;
  subtotal?: number | null;
  vat?: number | null;
  total?: number | null;
  currency?: string | null;
  category?: string | null;
  confidence_score?: number | null;
};

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Persists the values returned by the Gemini extraction endpoint onto the
 * existing invoice row. Risk scoring and validation rules come later.
 */
export const saveExtraction = createServerFn({ method: "POST" })
  .inputValidator((input: { invoiceId: string; extracted: ExtractedInvoice }) => input)
  .handler(async ({ data }) => {
    const supabase = client();
    const e = data.extracted ?? {};

    const { data: current } = await supabase
      .from("invoices")
      .select("extracted_data")
      .eq("id", data.invoiceId)
      .maybeSingle();
    const previous = asObject(current?.extracted_data) ?? {};

    const fields = {
      supplier_name: str(e.supplier_name),
      invoice_number: str(e.invoice_number),
      invoice_date: str(e.invoice_date),
      due_date: str(e.due_date),
      subtotal: num(e.subtotal),
      vat: num(e.vat),
      total: num(e.total),
      currency: str(e.currency),
      category: str(e.category),
      confidence_score: num(e.confidence_score),
    };

    // 1. Save extracted data first so it is preserved even if later steps fail.
    const { error } = await supabase
      .from("invoices")
      .update({ ...fields, extracted_data: { ...previous, ...e, extracted_by: "gemini" } })
      .eq("id", data.invoiceId);
    if (error) throw new Error(error.message);

    // 2. Deterministic validation → risk → decision. Fails safe to human review.
    let decision: {
      validation_results?: Json;
      validation_passed?: boolean;
      risk_level: string | null;
      status: string;
      review_reason: string | null;
    };
    try {
      const result = runEngine(fields);
      decision = {
        validation_results: { engine: "v1", checks: result.checks } as unknown as Json,
        validation_passed: result.validationPassed,
        risk_level: result.risk,
        status: result.status,
        review_reason: result.reasons.length ? result.reasons.join(" ") : null,
      };
    } catch {
      decision = {
        risk_level: null,
        status: "NEEDS REVIEW",
        review_reason: "System processing error during risk assessment — manual review required.",
      };
    }

    const { error: decisionError } = await supabase
      .from("invoices")
      .update(decision)
      .eq("id", data.invoiceId);
    if (decisionError) {
      await supabase
        .from("invoices")
        .update({
          status: "NEEDS REVIEW",
          review_reason: "System processing error while saving the decision — manual review required.",
        })
        .eq("id", data.invoiceId);
      throw new Error(decisionError.message);
    }
    return { id: data.invoiceId };
  });

