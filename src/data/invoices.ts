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
};

export const CATEGORIES = [
  "Software & SaaS",
  "Professional Services",
  "Logistics",
  "Utilities",
  "Office & Facilities",
  "Marketing",
  "Hardware",
  "Travel",
] as const;

const SUPPLIERS: Array<[string, string, (typeof CATEGORIES)[number]]> = [
  ["Nordwind Cloud GmbH", "DE811907980", "Software & SaaS"],
  ["Studio Legale Bertani", "IT04512380962", "Professional Services"],
  ["Trasporti Marconi Srl", "IT02219870154", "Logistics"],
  ["Enel Energia SpA", "IT06655971007", "Utilities"],
  ["Ufficio Più Forniture", "IT01998450231", "Office & Facilities"],
  ["Brightloop Media BV", "NL854502108B01", "Marketing"],
  ["Helvetica Hardware AG", "CHE116281277", "Hardware"],
  ["Voyage Business Travel", "FR40303265045", "Travel"],
  ["Datacore Systems Ltd", "GB884627291", "Software & SaaS"],
  ["Consulenza Riva & Partners", "IT03388120969", "Professional Services"],
  ["Alpine Logistics AG", "CHE409112780", "Logistics"],
  ["Acqua Metropolitana Srl", "IT07123450961", "Utilities"],
];

const REASONS = [
  "Total does not match line items sum",
  "VAT rate differs from supplier history",
  "Amount above auto-approval threshold (€5,000)",
  "Duplicate invoice number detected",
  "Missing purchase order reference",
  "Due date precedes invoice date",
  "New supplier — first invoice received",
  "Low OCR confidence on total field",
];

/** Deterministic pseudo-random so SSR and client render identically. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function buildChecks(
  status: InvoiceStatus,
  reason: string | undefined,
  totals: { subtotal: number; vat: number; total: number },
): ValidationCheck[] {
  const ok = status === "auto-approved";
  const money = (n: number) => `€${n.toLocaleString("en-IE", { minimumFractionDigits: 2 })}`;
  return [
    {
      id: "required-fields",
      label: "Required fields present",
      state: ok || reason !== "Missing purchase order reference" ? "pass" : "warn",
      detail:
        ok || reason !== "Missing purchase order reference"
          ? "Supplier, VAT ID, invoice number, dates and totals extracted."
          : "Purchase order reference not found on the document.",
    },
    {
      id: "totals",
      label: "Total calculation",
      state: reason === "Total does not match line items sum" ? "fail" : "pass",
      detail:
        reason === "Total does not match line items sum"
          ? `Line items sum to ${money(totals.subtotal + totals.vat - 12.4)}, document states ${money(totals.total)}.`
          : `${money(totals.subtotal)} + ${money(totals.vat)} = ${money(totals.total)}.`,
    },
    {
      id: "vat",
      label: "VAT consistency",
      state: reason === "VAT rate differs from supplier history" ? "warn" : "pass",
      detail:
        reason === "VAT rate differs from supplier history"
          ? "Applied rate 10% vs. 22% used on the last 6 invoices from this supplier."
          : `Rate ${Math.round((totals.vat / totals.subtotal) * 100)}% matches supplier history.`,
    },
    {
      id: "dates",
      label: "Date validation",
      state: reason === "Due date precedes invoice date" ? "fail" : "pass",
      detail:
        reason === "Due date precedes invoice date"
          ? "Due date is earlier than the invoice issue date."
          : "Issue date and due date are valid and within payment terms.",
    },
  ];
}

function generate(): Invoice[] {
  const rand = rng(20260903);
  const out: Invoice[] = [];

  for (let i = 0; i < 42; i++) {
    const [supplier, supplierVat, category] = SUPPLIERS[Math.floor(rand() * SUPPLIERS.length)]!;
    const subtotal = Math.round((180 + rand() * 8200) * 100) / 100;
    const rate = [0.04, 0.1, 0.22][Math.floor(rand() * 3)]!;
    const vat = Math.round(subtotal * rate * 100) / 100;
    const total = Math.round((subtotal + vat) * 100) / 100;

    const roll = rand();
    let status: InvoiceStatus;
    if (i < 2) status = "processing";
    else if (roll > 0.94) status = "rejected";
    else if (roll > 0.72) status = "needs-review";
    else status = "auto-approved";

    const risk: RiskLevel =
      status === "auto-approved"
        ? rand() > 0.85
          ? "medium"
          : "low"
        : status === "rejected"
          ? "high"
          : rand() > 0.5
            ? "high"
            : "medium";

    const confidence =
      status === "auto-approved"
        ? Math.round((93 + rand() * 6.5) * 10) / 10
        : Math.round((68 + rand() * 21) * 10) / 10;

    const reason =
      status === "auto-approved" ? undefined : REASONS[Math.floor(rand() * REASONS.length)]!;

    const day = 1 + Math.floor(rand() * 28);
    const month = 6 + Math.floor(rand() * 3);
    const issueDate = `2026-${pad(month)}-${pad(day)}`;
    const dueDate = `2026-${pad(month + 1 > 12 ? 12 : month + 1)}-${pad(day)}`;

    out.push({
      id: `inv-${1000 + i}`,
      number: `${2026}-${pad(month)}-${(4180 + i * 7).toString()}`,
      supplier,
      supplierVat,
      issueDate,
      dueDate,
      subtotal,
      vat,
      total,
      currency: "EUR",
      category,
      confidence,
      risk,
      status,
      reason,
      checks: buildChecks(status, reason, { subtotal, vat, total }),
    });
  }

  return out.sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1));
}

export const invoices: Invoice[] = generate();

export function getInvoice(id: string): Invoice | undefined {
  return invoices.find((i) => i.id === id);
}

/** The invoice shown after a simulated upload analysis. */
export const demoAnalysisInvoiceId = invoices.find((i) => i.status === "needs-review")!.id;

export const kpis = {
  totalInvoices: 247,
  autoApproved: 203,
  needsReview: 44,
  automationRate: 82,
  averageConfidence: 94,
  hoursSaved: 31.4,
  monthlySavings: 785,
};

export const activity = [
  { day: "Mon", approved: 34, review: 7 },
  { day: "Tue", approved: 41, review: 9 },
  { day: "Wed", approved: 28, review: 5 },
  { day: "Thu", approved: 46, review: 11 },
  { day: "Fri", approved: 38, review: 6 },
  { day: "Sat", approved: 9, review: 2 },
  { day: "Sun", approved: 7, review: 4 },
];

export const reviewQueue = invoices.filter((i) => i.status === "needs-review");

export function formatMoney(value: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-") as [string, string, string];
  return `${d}/${m}/${y}`;
}
