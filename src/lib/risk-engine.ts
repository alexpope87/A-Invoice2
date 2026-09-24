/**
 * Deterministic Validation, Risk & Decision Engine (v1).
 * Pure code — no AI is involved in validating, scoring or deciding.
 * Gemini is used only for document extraction upstream.
 */

export type CheckStatus = "PASS" | "FAIL" | "NOT_CHECKED";
export type CheckKey =
  | "required_fields"
  | "total_calculation"
  | "date_validation"
  | "vat_check"
  | "amount_sanity";

export type EngineCheck = {
  key: CheckKey;
  label: string;
  status: CheckStatus;
  /** UI state used by the analysis page (pass / warn / fail). */
  state: "pass" | "warn" | "fail";
  detail: string;
};

export type EngineInput = {
  supplier_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  subtotal: number | null;
  vat: number | null;
  total: number | null;
  confidence_score: number | null;
  currency: string | null;
};

export type EngineResult = {
  checks: EngineCheck[];
  validationPassed: boolean;
  risk: "LOW" | "MEDIUM" | "HIGH";
  status: "AUTO-APPROVED" | "NEEDS REVIEW";
  reasons: string[];
};

const TOLERANCE = 0.02;
const MAX_SANE_AMOUNT = 1_000_000;
const COMMON_VAT_RATES = [0, 4, 5, 5.5, 6, 7, 8, 9, 10, 12, 13, 19, 20, 21, 22, 23, 24, 25, 27];

function check(key: CheckKey, label: string, status: CheckStatus, detail: string): EngineCheck {
  const state = status === "PASS" ? "pass" : status === "FAIL" ? "fail" : "warn";
  return { key, label, status, state, detail };
}

function isValidDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function runValidation(i: EngineInput): EngineCheck[] {
  const checks: EngineCheck[] = [];

  // Required fields
  const required: Array<keyof EngineInput> = ["supplier_name", "invoice_number", "invoice_date", "total", "currency"];
  const missing = required.filter((k) => i[k] === null || i[k] === undefined || i[k] === "");
  checks.push(
    missing.length
      ? check("required_fields", "Required fields", "FAIL", `Missing: ${missing.join(", ")}.`)
      : check("required_fields", "Required fields", "PASS", "Supplier, number, date, total and currency present."),
  );

  // Total calculation
  if (i.subtotal === null || i.vat === null || i.total === null) {
    checks.push(
      check("total_calculation", "Total calculation", "NOT_CHECKED", "Subtotal, VAT or total missing."),
    );
  } else {
    const expected = Math.round((i.subtotal + i.vat) * 100) / 100;
    checks.push(
      Math.abs(expected - i.total) <= TOLERANCE
        ? check("total_calculation", "Total calculation", "PASS", `Subtotal + VAT = ${expected.toFixed(2)}.`)
        : check(
            "total_calculation",
            "Total calculation",
            "FAIL",
            `Subtotal + VAT = ${expected.toFixed(2)}, but total is ${i.total.toFixed(2)}.`,
          ),
    );
  }

  // Date validation
  if (i.invoice_date && !isValidDate(i.invoice_date)) {
    checks.push(check("date_validation", "Date validation", "FAIL", "Invoice date is not a valid date."));
  } else if (i.due_date && !isValidDate(i.due_date)) {
    checks.push(check("date_validation", "Date validation", "FAIL", "Due date is not a valid date."));
  } else if (!i.invoice_date || !i.due_date) {
    checks.push(
      check("date_validation", "Date validation", "NOT_CHECKED", "Invoice date or due date missing."),
    );
  } else if (i.due_date < i.invoice_date) {
    checks.push(
      check("date_validation", "Date validation", "FAIL", "Due date is earlier than invoice date."),
    );
  } else {
    checks.push(check("date_validation", "Date validation", "PASS", "Dates are valid and consistent."));
  }

  // VAT check — informational only: no assumption about which rate is legally correct.
  if (i.subtotal === null || i.vat === null || !(i.subtotal > 0)) {
    checks.push(check("vat_check", "VAT check", "NOT_CHECKED", "Effective VAT rate could not be calculated."));
  } else {
    const rate = (i.vat / i.subtotal) * 100;
    checks.push(
      check("vat_check", "VAT check", "PASS", `Effective VAT rate ${rate.toFixed(2)}% (informational).`),
    );
  }

  // Amount sanity — no arbitrary maximum.
  const amounts = { total: i.total, subtotal: i.subtotal, vat: i.vat };
  const invalid = Object.entries(amounts).filter(([, v]) => v !== null && !Number.isFinite(v));
  const negative = Object.entries(amounts).filter(([, v]) => v !== null && Number.isFinite(v) && v < 0);
  if (invalid.length || negative.length) {
    const parts = [
      ...invalid.map(([k]) => `${k} is not a valid number`),
      ...negative.map(([k]) => `${k} is negative`),
    ];
    checks.push(check("amount_sanity", "Amount sanity", "FAIL", `${parts.join(", ")}.`));
  } else {
    checks.push(check("amount_sanity", "Amount sanity", "PASS", "No negative or invalid amounts."));
  }

  return checks;
}

const REASON: Partial<Record<CheckKey, Record<"FAIL" | "NOT_CHECKED", string>>> = {
  total_calculation: {
    FAIL: "Invoice total does not match subtotal + VAT.",
    NOT_CHECKED: "Total calculation could not be verified.",
  },
  date_validation: {
    FAIL: "Invoice dates are invalid or inconsistent.",
    NOT_CHECKED: "Invoice dates could not be verified.",
  },
  vat_check: {
    FAIL: "VAT could not be verified.",
    NOT_CHECKED: "VAT could not be verified.",
  },
  amount_sanity: {
    FAIL: "Invoice contains negative or invalid amounts.",
    NOT_CHECKED: "Invoice amount could not be verified.",
  },
};

export function assessRisk(input: EngineInput, checks: EngineCheck[]): EngineResult {
  const by = Object.fromEntries(checks.map((c) => [c.key, c])) as Record<CheckKey, EngineCheck>;
  const confidence = input.confidence_score ?? 0;
  const reasons: string[] = [];

  // Reasons (deterministic, in fixed order)
  if (by.required_fields.status === "FAIL") {
    const missing = by.required_fields.detail.replace(/^Missing: /, "").replace(/\.$/, "");
    for (const f of missing.split(", ")) reasons.push(`Required field missing: ${f}.`);
  }
  if (by.date_validation.status === "FAIL" && by.date_validation.detail.includes("earlier")) {
    reasons.push("Due date is earlier than invoice date.");
  }
  for (const key of ["total_calculation", "date_validation", "vat_check", "amount_sanity"] as const) {
    const s = by[key].status;
    if (s === "PASS") continue;
    if (key === "date_validation" && s === "FAIL" && by[key].detail.includes("earlier")) continue;
    const text = REASON[key]?.[s];
    if (text) reasons.push(text);
  }
  if (input.confidence_score === null) reasons.push("AI extraction confidence is unavailable.");
  else if (confidence < 70) reasons.push("AI extraction confidence is below 70%.");
  else if (confidence < 90) reasons.push("AI extraction confidence is below the 90% auto-approval threshold.");

  const high =
    (["required_fields", "total_calculation", "date_validation", "amount_sanity"] as const).some(
      (k) => by[k].status === "FAIL",
    ) || confidence < 70;

  const low =
    !checks.some((c) => c.status === "FAIL") &&
    (["required_fields", "total_calculation", "date_validation", "amount_sanity", "vat_check"] as const).every(
      (k) => by[k].status === "PASS",
    ) &&
    confidence >= 90;

  const risk = high ? "HIGH" : low ? "LOW" : "MEDIUM";
  const status = risk === "LOW" ? "AUTO-APPROVED" : "NEEDS REVIEW";

  return {
    checks,
    validationPassed: !checks.some((c) => c.status === "FAIL"),
    risk,
    status,
    reasons: status === "AUTO-APPROVED" ? [] : reasons.length ? reasons : ["Manual verification required."],
  };
}

export function effectiveVatRate(i: EngineInput): number | null {
  return i.subtotal !== null && i.vat !== null && i.subtotal > 0
    ? Math.round((i.vat / i.subtotal) * 10000) / 100
    : null;
}

export function runEngine(input: EngineInput): EngineResult {
  return assessRisk(input, runValidation(input));
}
