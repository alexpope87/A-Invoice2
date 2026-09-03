import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { ConfidenceMeter, EmptyRow, RiskBadge, StatusBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, formatDate, formatMoney, invoices } from "@/data/invoices";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Invoice history — InvoiceAI" },
      {
        name: "description",
        content:
          "Searchable archive of every processed invoice with amount, category, AI confidence, risk and final status.",
      },
      { property: "og:title", content: "Invoice history — InvoiceAI" },
      {
        property: "og:description",
        content: "Search and filter the full archive of processed invoices.",
      },
    ],
  }),
  component: HistoryPage,
});

const ALL = "all";
const PAGE_SIZE = 12;

function HistoryPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(ALL);
  const [risk, setRisk] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [sortDesc, setSortDesc] = useState(true);
  const [sortKey, setSortKey] = useState<"issueDate" | "total">("issueDate");
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = invoices
      .filter((i) => (q ? i.supplier.toLowerCase().includes(q) || i.number.includes(q) : true))
      .filter((i) => (status === ALL ? true : i.status === status))
      .filter((i) => (risk === ALL ? true : i.risk === risk))
      .filter((i) => (category === ALL ? true : i.category === category));

    return [...filtered].sort((a, b) => {
      const av = sortKey === "total" ? a.total : a.issueDate;
      const bv = sortKey === "total" ? b.total : b.issueDate;
      if (av === bv) return 0;
      return (av < bv ? -1 : 1) * (sortDesc ? -1 : 1);
    });
  }, [query, status, risk, category, sortKey, sortDesc]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  function toggleSort(key: "issueDate" | "total") {
    if (key === sortKey) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Invoice history"
        description={`${rows.length} of ${invoices.length} invoices match your filters.`}
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1 min-w-64">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Search
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Supplier or invoice number"
              className="bg-surface pl-9"
            />
          </div>
        </label>
        <FilterSelect
          label="Status"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(0);
          }}
          options={["auto-approved", "needs-review", "processing", "rejected"]}
        />
        <FilterSelect
          label="Risk"
          value={risk}
          onChange={(v) => {
            setRisk(v);
            setPage(0);
          }}
          options={["low", "medium", "high"]}
        />
        <FilterSelect
          label="Category"
          value={category}
          onChange={(v) => {
            setCategory(v);
            setPage(0);
          }}
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
              <th className="px-5 py-2.5 font-medium">
                <button
                  onClick={() => toggleSort("issueDate")}
                  className="inline-flex items-center gap-1 uppercase hover:text-foreground"
                >
                  Date <ArrowUpDown className="size-3" />
                </button>
              </th>
              <th className="px-5 py-2.5 text-right font-medium">
                <button
                  onClick={() => toggleSort("total")}
                  className="inline-flex items-center gap-1 uppercase hover:text-foreground"
                >
                  Amount <ArrowUpDown className="size-3" />
                </button>
              </th>
              <th className="px-5 py-2.5 font-medium">Category</th>
              <th className="px-5 py-2.5 font-medium">AI confidence</th>
              <th className="px-5 py-2.5 font-medium">Risk</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && <EmptyRow colSpan={8} label="No invoices found." />}
            {visible.map((invoice) => (
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
                <td className="px-5 py-3 font-mono text-xs tabular-nums text-muted-foreground">
                  {formatDate(invoice.issueDate)}
                </td>
                <td className="px-5 py-3 text-right font-mono tabular-nums">
                  {formatMoney(invoice.total)}
                </td>
                <td className="px-5 py-3 text-muted-foreground">{invoice.category}</td>
                <td className="px-5 py-3">
                  <ConfidenceMeter value={invoice.confidence} />
                </td>
                <td className="px-5 py-3">
                  <RiskBadge risk={invoice.risk} />
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={invoice.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Page {current + 1} of {pageCount}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={current >= pageCount - 1}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
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
