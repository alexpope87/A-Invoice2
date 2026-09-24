import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ListChecks,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { RiskBadge, StatusBadge } from "@/components/badges";
import { ErrorPanel } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney, type ValidationState } from "@/data/invoices";
import { getInvoiceById, setManualDecision } from "@/lib/invoices.functions";
import { cn } from "@/lib/utils";

const invoiceQuery = (id: string) =>
  queryOptions({
    queryKey: ["invoice", id],
    queryFn: () => getInvoiceById({ data: { id } }),
  });

export const Route = createFileRoute("/invoices/$invoiceId")({
  loader: async ({ context, params }) => {
    const invoice = await context.queryClient.ensureQueryData(invoiceQuery(params.invoiceId));
    if (!invoice) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Invoice analysis — InvoiceAI" },
      {
        name: "description",
        content:
          "Extracted data, validation checks and risk assessment for a processed supplier invoice.",
      },
      { property: "og:title", content: "Invoice analysis — InvoiceAI" },
      {
        property: "og:description",
        content: "Full AI extraction, validation and risk detail for one invoice.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => <ErrorPanel message={error.message} />,
  notFoundComponent: () => (
    <div className="mx-auto max-w-md rounded-lg border border-border bg-surface p-8 text-center">
      <p className="text-sm font-medium">Invoice not found</p>
      <p className="mt-1 text-xs text-muted-foreground">
        This invoice no longer exists in the database.
      </p>
      <Button asChild variant="outline" className="mt-4">
        <Link to="/history">Back to history</Link>
      </Button>
    </div>
  ),
  component: InvoiceAnalysis,
});

function InvoiceAnalysis() {
  const { invoiceId } = Route.useParams();
  const { data } = useSuspenseQuery(invoiceQuery(invoiceId));
  const queryClient = useQueryClient();
  const [deciding, setDeciding] = useState<"approve" | "reject" | null>(null);
  const invoice = data!;
  const approved = invoice.status === "auto-approved";

  async function decide(action: "approve" | "reject") {
    setDeciding(action);
    try {
      await setManualDecision({ data: { invoiceId, action } });
      await queryClient.invalidateQueries();
      toast.success(action === "approve" ? "Invoice approved" : "Invoice rejected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the decision");
    } finally {
      setDeciding(null);
    }
  }

  const fields: Array<[string, string]> = [
    ["Supplier", invoice.supplier],
    ["VAT ID", invoice.supplierVat],
    ["Invoice number", invoice.number],
    ["Invoice date", formatDate(invoice.issueDate)],
    ["Due date", formatDate(invoice.dueDate)],
    ["Category", invoice.category],
    ["Subtotal", formatMoney(invoice.subtotal, invoice.currency)],
    ["VAT", formatMoney(invoice.vat, invoice.currency)],
    ["Total", formatMoney(invoice.total, invoice.currency)],
    ["Currency", invoice.currency],
  ];

  const extractedEntries = Object.entries(invoice.extractedData ?? {});

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <Link
        to="/review"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to review queue
      </Link>

      <PageHeader
        title={`Invoice ${invoice.number}`}
        description={`${invoice.supplier} · processed ${formatDate(invoice.issueDate)}${
          invoice.sourceFileName ? ` · ${invoice.sourceFileName}` : ""
        }`}
        actions={
          <>
            <StatusBadge status={invoice.status} />
            <RiskBadge risk={invoice.risk} />
          </>
        }
      />

      <div
        className={cn(
          "flex flex-wrap items-center gap-4 rounded-lg border p-5",
          approved ? "border-success/30 bg-success-soft" : "border-warning/30 bg-warning-soft",
        )}
      >
        <span
          className={cn(
            "grid size-10 place-items-center rounded-full",
            approved ? "bg-success text-primary-foreground" : "bg-warning text-primary-foreground",
          )}
        >
          {approved ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-semibold uppercase tracking-wide",
              approved ? "text-success" : "text-warning",
            )}
          >
            {approved
              ? "Auto-approved"
              : invoice.status === "rejected"
                ? "Rejected"
                : invoice.status === "processing"
                  ? "Processing"
                  : "Needs review"}
          </p>
          <p className="mt-0.5 text-sm text-foreground">
            {invoice.reason ??
              (approved
                ? "All validation rules passed and confidence met the 90% auto-approval threshold."
                : "Manual verification required before approval.")}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-border bg-surface lg:col-span-2">
          <h2 className="border-b border-border px-5 py-3.5 text-sm font-semibold">
            Extracted data
          </h2>
          <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
            {fields.map(([label, value]) => (
              <div key={label} className="border-b border-border/50 pb-3">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
                <dd className="mt-1 font-mono text-sm tabular-nums text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          {extractedEntries.length > 0 && (
            <div className="border-t border-border px-5 py-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Additional extracted fields
              </p>
              <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {extractedEntries.map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-3 text-xs">
                    <dt className="text-muted-foreground">{key.replace(/_/g, " ")}</dt>
                    <dd className="truncate font-mono text-foreground">
                      {value === null || value === undefined ? "—" : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">AI confidence</h2>
            <div className="mt-4 flex items-end gap-2">
              <span className="font-mono text-4xl font-semibold tabular-nums text-foreground">
                {invoice.confidence.toFixed(1)}
              </span>
              <span className="pb-1.5 text-sm text-muted-foreground">%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  invoice.confidence >= 90
                    ? "bg-success"
                    : invoice.confidence >= 70
                      ? "bg-warning"
                      : "bg-danger",
                )}
                style={{ width: `${invoice.confidence}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Auto-approval requires ≥90% confidence and all key checks passing; below 70% is high
              risk.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">Risk assessment</h2>
            <div className="mt-3 flex items-center gap-2">
              <RiskBadge risk={invoice.risk} />
              <StatusBadge status={invoice.status} />
            </div>
            <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <ShieldCheck className="size-3.5 shrink-0" />
                {invoice.checks.filter((c) => c.state === "pass").length} of{" "}
                {invoice.checks.length} validation checks passed
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="size-3.5 shrink-0" /> Decided by deterministic rules (no AI)
              </li>
            </ul>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-border bg-surface">
        <h2 className="flex items-center gap-2 border-b border-border px-5 py-3.5 text-sm font-semibold">
          <ListChecks className="size-4" /> Validation
        </h2>
        {invoice.checks.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            No validation results were stored for this invoice.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {invoice.checks.map((check) => (
              <li key={check.id} className="flex items-start gap-3 px-5 py-4">
                <CheckIcon state={check.state} />
                <div>
                  <p className="text-sm font-medium text-foreground">{check.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{check.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          className="text-danger"
          disabled={deciding !== null || invoice.status === "rejected"}
          onClick={() => decide("reject")}
        >
          <ThumbsDown className="size-4" /> {deciding === "reject" ? "Rejecting…" : "Reject"}
        </Button>
        <Button
          disabled={deciding !== null || invoice.status === "auto-approved"}
          onClick={() => decide("approve")}
        >
          <ThumbsUp className="size-4" /> {deciding === "approve" ? "Approving…" : "Approve"}
        </Button>
      </div>
    </div>
  );
}

function CheckIcon({ state }: { state: ValidationState }) {
  if (state === "pass") return <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />;
  if (state === "warn") return <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />;
  return <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />;
}
