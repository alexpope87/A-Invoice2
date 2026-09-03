import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { EmptyRow, RiskBadge, StatusBadge } from "@/components/badges";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CATEGORIES, formatDate, formatMoney, invoices } from "@/data/invoices";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "Review queue — InvoiceAI" },
      {
        name: "description",
        content:
          "Invoices flagged for human review, with risk level, flag reason and status filters for your AP team.",
      },
      { property: "og:title", content: "Review queue — InvoiceAI" },
      {
        property: "og:description",
        content: "Work through flagged invoices by risk, status and category.",
      },
    ],
  }),
  component: ReviewQueuePage,
});

const ALL = "all";

function ReviewQueuePage() {
  const [risk, setRisk] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [category, setCategory] = useState(ALL);

  const rows = useMemo(
    () =>
      invoices
        .filter((i) => i.status === "needs-review" || i.status === "rejected")
        .filter((i) => (risk === ALL ? true : i.risk === risk))
        .filter((i) => (status === ALL ? true : i.status === status))
        .filter((i) => (category === ALL ? true : i.category === category)),
    [risk, status, category],
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Review queue"
        description={`${rows.length} invoice${rows.length === 1 ? "" : "s"} waiting for a human decision.`}
        actions={
          <Button
            variant="outline"
            onClick={() => {
              setRisk(ALL);
              setStatus(ALL);
              setCategory(ALL);
            }}
          >
            Reset filters
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Filter label="Risk" value={risk} onChange={setRisk} options={["low", "medium", "high"]} />
        <Filter
          label="Status"
          value={status}
          onChange={setStatus}
          options={["needs-review", "rejected"]}
        />
        <Filter
          label="Category"
          value={category}
          onChange={setCategory}
          options={[...CATEGORIES]}
          width="w-56"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-2.5 font-medium">Invoice</th>
              <th className="px-5 py-2.5 font-medium">Supplier</th>
              <th className="px-5 py-2.5 text-right font-medium">Amount</th>
              <th className="px-5 py-2.5 font-medium">Risk</th>
              <th className="px-5 py-2.5 font-medium">Reason</th>
              <th className="px-5 py-2.5 font-medium">Date</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={7} label="No invoices match these filters." />}
            {rows.map((invoice) => (
              <tr key={invoice.id} className="border-b border-border/60 last:border-0 hover:bg-muted/50">
                <td className="px-5 py-3">
                  <Link
                    to="/invoices/$invoiceId"
                    params={{ invoiceId: invoice.id }}
                    className="font-mono text-xs font-medium text-primary hover:underline"
                  >
                    {invoice.number}
                  </Link>
                </td>
                <td className="px-5 py-3">{invoice.supplier}</td>
                <td className="px-5 py-3 text-right font-mono tabular-nums">
                  {formatMoney(invoice.total)}
                </td>
                <td className="px-5 py-3">
                  <RiskBadge risk={invoice.risk} />
                </td>
                <td className="max-w-xs px-5 py-3 text-muted-foreground">
                  {invoice.reason ?? "—"}
                </td>
                <td className="px-5 py-3 font-mono text-xs tabular-nums text-muted-foreground">
                  {formatDate(invoice.issueDate)}
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={invoice.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
  width = "w-44",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  width?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={`${width} bg-surface`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o.replace("-", " ").replace(/^\w/, (c) => c.toUpperCase())}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
