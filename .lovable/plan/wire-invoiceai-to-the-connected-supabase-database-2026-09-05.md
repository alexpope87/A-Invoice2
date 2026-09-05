# Wire InvoiceAI to the connected Supabase database

The app currently shows invented invoices. This plan replaces them with real records from the connected database, keeping the design and pages exactly as they are.

Note: the invoices table is currently **empty**, and it has no access rules yet, so the app cannot read it. Both are fixed as part of this work.

## 1. Database access (demo only)

One database change, clearly commented as demo-only:

- Allow read, insert and update of invoice records for the public (unauthenticated) app.
- Allow upload/read of PDF files in the existing private "invoices" file bucket.
- A comment in the change states these rules are for a portfolio demo and must be replaced with per-user rules before production.
- Row-level security stays on. No table structure change, no new table.
- Insert about 40 realistic demo invoice records (Italian/EU suppliers, EUR amounts, mixed categories, confidence scores, risk levels, statuses `AUTO-APPROVED` / `NEEDS REVIEW` / `REJECTED`, review reasons, plus extracted-data and validation-results details) so every page has content.

## 2. Invoice history

Reads from the database with search by supplier or invoice number, filters for status, risk and category, sorting by date and amount, and pagination. Same table layout as today.

## 3. Review queue

Reads only invoices marked "NEEDS REVIEW", shows number, supplier, amount, risk, reason, date and status, and each row opens its analysis page.

## 4. Invoice analysis

Loads the single invoice by its id and shows all stored fields plus the review reason. The stored extracted-data and validation-results details are rendered as readable rows/checklists instead of raw code, with a graceful fallback if they are empty.

## 5. Dashboard

KPIs computed from real records:

- Total invoices, auto-approved, needs review
- Automation rate = auto-approved / total x 100
- Average confidence = average of confidence scores
- Hours saved = auto-approved x 8 / 60
- Monthly savings = hours saved x EUR 25

Recent invoices, alerts and the activity chart come from the same real data. Layout unchanged.

## 6. Upload page

Same interface. On analyze: the PDF is uploaded to the private "invoices" bucket, the filename and a processing state are shown, then a realistic demo invoice record is created in the database from that file and the user is taken to its analysis page. No AI is involved yet.

## 7. Loading, error and empty states

Every page gets a skeleton/loading state, a clear error message with a retry option, and a friendly empty state when there are no matching records.

## Technical notes

- Data access via TanStack `createServerFn` server functions using a publishable-key server client; route loaders prime TanStack Query, components use `useSuspenseQuery`.
- Filtering/sorting/pagination for history and review pushed to the database query (`ilike`, `eq`, `order`, `range`) with a total count for pagination.
- `src/data/invoices.ts` keeps only formatting helpers, category list and shared types; the generated mock array and hardcoded KPIs are removed.
- Badge components map the database's uppercase status/risk values to the existing visual variants.
- Upload uses the browser Supabase client for storage, then a server function inserts the demo record and returns its id.
- Each route defines `errorComponent` and `notFoundComponent`.
- Verification after implementation: load each page against the real database and confirm rows and KPIs render.
