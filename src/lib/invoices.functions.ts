import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
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
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
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
  const hoursSaved = (autoApproved * 8) / 60;
  const confidenceValues = invoices.filter((i) => i.confidence > 0).map((i) => i.confidence);

  const kpis: Kpis = {
    totalInvoices: total,
    autoApproved,
    needsReview,
    rejected,
    automationRate: total ? Math.round((autoApproved / total) * 100) : 0,
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
 * DEMO ONLY: creates a realistic invoice record after a PDF upload.
 * Replace with real AI extraction + authenticated writes before production.
 */
export const createDemoInvoice = createServerFn({ method: "POST" })
  .inputValidator((input: { fileName: string; storagePath?: string }) => input)
  .handler(async ({ data }) => {
    const supabase = client();
    const subtotal = Math.round((420 + Math.random() * 4200) * 100) / 100;
    const vat = Math.round(subtotal * 0.22 * 100) / 100;
    const total = Math.round((subtotal + vat) * 100) / 100;
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const due = new Date(today);
    due.setDate(due.getDate() + 30);
    const confidence = Math.round((88 + Math.random() * 10) * 10) / 10;
    const approved = confidence >= 93;

    const { data: row, error } = await supabase
      .from("invoices")
      .insert({
        invoice_number: `INV-2026-${Math.floor(5000 + Math.random() * 4000)}`,
        supplier_name: "Rossi Costruzioni S.r.l.",
        invoice_date: iso(today),
        due_date: iso(due),
        subtotal,
        vat,
        total,
        currency: "EUR",
        category: "Professional services",
        confidence_score: confidence,
        risk_level: approved ? "LOW" : "MEDIUM",
        status: approved ? "AUTO-APPROVED" : "NEEDS REVIEW",
        review_reason: approved ? null : "Confidence below the auto-approval threshold",
        validation_passed: approved,
        processing_time_seconds: Math.round((2 + Math.random() * 3) * 10) / 10,
        source_file_name: data.fileName,
        extracted_data: {
          supplier_vat: "IT04421890156",
          payment_terms: "30 days net",
          storage_path: data.storagePath ?? null,
          line_items: 3,
        },
        validation_results: {
          passed: approved,
          checks: [
            {
              label: "Required fields",
              state: "pass",
              detail: "All mandatory fields were detected.",
            },
            {
              label: "Total calculation",
              state: "pass",
              detail: "Subtotal + VAT matches the stated total.",
            },
            {
              label: "VAT check",
              state: approved ? "pass" : "warn",
              detail: approved
                ? "22% standard rate applied."
                : "VAT rate could not be confirmed against supplier history.",
            },
            {
              label: "Date validation",
              state: "pass",
              detail: "Invoice date and due date are consistent.",
            },
          ],
        },
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { id: row.id };
  });
