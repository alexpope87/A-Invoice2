/**
 * Client-safe invoice types, mappers and formatters.
 * Data itself comes from the Supabase `public.invoices` table via
 * the server functions in `src/lib/invoices.functions.ts`.
 */

export type RiskLevel = "low" | "medium" | "high";
export type InvoiceStatus = "auto-approved" | "needs-review" | "processing" | "rejected";
export type ValidationState = "pass" | "warn" | "fail";

export type ValidationCheck = {
  id: string;
  label: string;
  state: ValidationState;
  detail: string;
};

export type Invoice = {
  id: string;
  number: string;
  supplier: string;
  supplierVat: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  vat: number;
  total: number;
  currency: string;
  category: string;
  confidence: number;
  risk: RiskLevel;
  status: InvoiceStatus;
  reason?: string | undefined;
  checks: ValidationCheck[];
  extractedData?: Record<string, unknown> | undefined;
  validationResults?: Record<string, unknown> | undefined;
  sourceFileName?: string | undefined;
  processingTimeSeconds?: number | undefined;
};

export type Kpis = {
  totalInvoices: number;
  autoApproved: number;
  needsReview: number;
  rejected: number;
  automationRate: number;
  averageConfidence: number;
  hoursSaved: number;
  monthlySavings: number;
};

export type ActivityPoint = { day: string; approved: number; review: number };

export const DB_STATUS: Record<InvoiceStatus, string> = {
  "auto-approved": "AUTO-APPROVED",
  "needs-review": "NEEDS REVIEW",
  processing: "PROCESSING",
  rejected: "REJECTED",
};

export const DB_RISK: Record<RiskLevel, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
};

export function toStatus(value: string | null): InvoiceStatus {
  switch ((value ?? "").toUpperCase()) {
    case "AUTO-APPROVED":
      return "auto-approved";
    case "NEEDS REVIEW":
      return "needs-review";
    case "REJECTED":
      return "rejected";
    default:
      return "processing";
  }
}

export function toRisk(value: string | null): RiskLevel {
  switch ((value ?? "").toUpperCase()) {
    case "HIGH":
      return "high";
    case "MEDIUM":
      return "medium";
    default:
      return "low";
  }
}

export const PAGE_SIZE = 10;

export function formatMoney(value: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function formatLabel(value: string) {
  return value.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
