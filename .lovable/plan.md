# InvoiceAI — Frontend MVP

A desktop-first B2B SaaS interface for AI invoice processing. Frontend only: no auth, no AI calls, no integrations, no payments. All data is realistic mock data held in a shared module.

## App shell

Persistent left sidebar (InvoiceAI wordmark at top) + main content area:
Dashboard, Upload Invoice, Review Queue, Invoice History. Top bar with page title and a mock user chip.

## Pages

**Dashboard (`/`)**
- KPI cards: total invoices 247, auto-approved 203, needs review 44, automation rate 82%, avg AI confidence 94%, hours saved 31.4, monthly savings €785.
- Processing activity chart (invoices per day, approved vs review).
- Recent invoices table (last 8) and a review-queue alert panel linking into the queue.

**Upload Invoice (`/upload`)**
- Drag-and-drop zone plus file-select button, PDF-only indication, file size/name preview.
- "Analyze Invoice" button triggers a simulated multi-step processing state (extract → validate → classify → score risk) with progress, then routes to the analysis page for a mock invoice.

**Invoice Analysis (`/invoices/$invoiceId`)**
- Header with supplier, invoice number, status badge, final decision banner (AUTO-APPROVED / NEEDS REVIEW with reason).
- Extracted data panel: supplier, number, invoice date, due date, subtotal, VAT, total, currency, category.
- AI panel: confidence score with gauge, risk level badge.
- Validation checklist: required fields, total calculation, VAT check, date validation — each pass/warn/fail with detail text.
- Actions (mock): Approve, Reject, Send to review.

**Review Queue (`/review`)**
- Table: invoice number, supplier, amount, risk, reason, date, status.
- Filters: risk, status, category. Row click opens the analysis page.

**Invoice History (`/history`)**
- Table: invoice number, supplier, date, amount, category, AI confidence, risk, status.
- Text search (supplier/number), filters (status, risk, category), sortable amount/date, client-side pagination.

## Status and risk language

Consistent badge components across all pages:
- Risk: LOW / MEDIUM / HIGH
- Status: AUTO-APPROVED / NEEDS REVIEW / PROCESSING / REJECTED

Each gets its own semantic token so meaning is readable at a glance without relying on color alone (icon + label).

## Technical notes

- TanStack Start routes: `index.tsx`, `upload.tsx`, `review.tsx`, `history.tsx`, `invoices.$invoiceId.tsx`; shared shell rendered in `__root.tsx` (sidebar hidden on none — all routes use it).
- `src/data/invoices.ts`: ~40 seeded mock invoices (Italian/EU suppliers, EUR, mixed categories, confidence, risk, validation results) plus derived KPI helpers, so dashboard/queue/history all read from one source.
- Reusable components in `src/components/`: `AppSidebar`, `KpiCard`, `StatusBadge`, `RiskBadge`, `ConfidenceMeter`, `DataTable` (filter/sort/search), `ValidationChecklist`, `ProcessingStepper`.
- shadcn/ui primitives + Recharts for the activity chart.
- Design tokens (colors for risk/status states, typography, spacing) defined in `src/styles.css`; no hardcoded color classes.
- Per-route `head()` metadata with unique titles/descriptions.

## Design direction

Before building, I'll generate three visual directions for the dashboard so you can pick the look; all are professional, minimal, data-dense B2B — no chatbot/consumer AI styling.
