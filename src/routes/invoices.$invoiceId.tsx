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
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney, getInvoice, type ValidationState } from "@/data/invoices";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/invoices/$invoiceId")({
  loader: ({ params }) => {
    const invoice = getInvoice(params.invoiceId);
    if (!invoice) throw notFound();
    return { invoice };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Invoice unavailable — InvoiceAI" }, { name: "robots", content: "noindex" }],
      };
    }
    const { invoice } = loaderData;
    const title = `Invoice ${invoice.number} — ${invoice.supplier} — InvoiceAI`;
    const description = `Extracted data, validation checks and risk assessment for invoice ${invoice.number} from ${invoice.supplier}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: InvoiceAnalysis,
});

function InvoiceAnalysis() {
  const { invoice } = Route.useLoaderData();
  const approved = invoice.status === "auto-approved";

  const fields: Array<[string, string]> = [
    ["Supplier", invoice.supplier],
    ["VAT ID", invoice.supplierVat],
    ["Invoice number", invoice.number],
    ["Invoice date", formatDate(invoice.issueDate)],
    ["Due date", formatDate(invoice.dueDate)],
    ["Category", invoice.category],
    ["Subtotal", formatMoney(invoice.subtotal)],
    ["VAT", formatMoney(invoice.vat)],
    ["Total", formatMoney(invoice.total)],
    ["Currency", invoice.currency],
  ];

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
        description={`${invoice.supplier} · processed ${formatDate(invoice.issueDate)}`}
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
            {approved ? "Auto-approved" : "Needs review"}
          </p>
          <p className="mt-0.5 text-sm text-foreground">
            {approved
              ? "All validation rules passed and confidence exceeded the auto-approval threshold."
              : (invoice.reason ?? "Manual verification required before approval.")}
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
                  invoice.confidence >= 93
                    ? "bg-success"
                    : invoice.confidence >= 80
                      ? "bg-warning"
                      : "bg-danger",
                )}
                style={{ width: `${invoice.confidence}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Auto-approval threshold: 93% with no failed validation rule.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold">Risk assessment</h2>
            <div className="mt-3">
              <RiskBadge risk={invoice.risk} />
            </div>
            <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <ShieldCheck className="size-3.5 shrink-0" /> Supplier known since 2024 · 18
                invoices on file
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="size-3.5 shrink-0" /> Amount within{" "}
                {invoice.total > 5000 ? "the top decile" : "the usual range"} for this supplier
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="size-3.5 shrink-0" /> No duplicate payment detected in the
                last 90 days
              </li>
            </ul>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-border bg-surface">
        <h2 className="flex items-center gap-2 border-b border-border px-5 py-3.5 text-sm font-semibold">
          <ListChecks className="size-4" /> Validation
        </h2>
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
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => toast("Sent to the review queue (demo)")}>
          Send to review
        </Button>
        <Button
          variant="outline"
          className="text-danger"
          onClick={() => toast("Invoice rejected (demo)")}
        >
          <ThumbsDown className="size-4" /> Reject
        </Button>
        <Button onClick={() => toast.success("Invoice approved (demo)")}>
          <ThumbsUp className="size-4" /> Approve
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
