import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpDown, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { ConfidenceMeter, EmptyRow, RiskBadge, StatusBadge } from "@/components/badges";
import { PageHeader } from "@/components/page-header";
import { ErrorPanel, LoadingPanel } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatLabel, formatMoney, PAGE_SIZE } from "@/data/invoices";
import { listCategories, listInvoices } from "@/lib/invoices.functions";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Invoice history — InvoiceAI" },
      {
        name: "description",
        content:
          "Search and filter every processed invoice by supplier, status, risk level, category and amount.",
      },
      { property: "og:title", content: "Invoice history — InvoiceAI" },
      {
        property: "og:description",
        content: "A complete searchable archive of processed invoices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => <ErrorPanel message={error.message} />,
  component: HistoryPage,
});

const ALL = "all";

function HistoryPage() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState(ALL);
  const [risk, setRisk] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [sortKey, setSortKey] = useState<"issueDate" | "total">("issueDate");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(query);
      setPage(0);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategories(),
  });

  const invoicesQuery = useQuery({
    queryKey: ["invoices", { debounced, status, risk, category, sortKey, sortDesc, page }],
    queryFn: () =>
      listInvoices({
        data: {
          search: debounced,
          status,
          risk,
          category,
          sortKey,
          sortDesc,
          page,
          pageSize: PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  });

  const rows = invoicesQuery.data?.rows ?? [];
  const total = invoicesQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggleSort(key: "issueDate" | "total") {
    if (key === sortKey) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
    setPage(0);
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Invoice history"
        description={
          invoicesQuery.isLoading
            ? "Loading invoices…"
            : `${total} invoice${total === 1 ? "" : "s"} match your filters.`
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-64 flex-1 flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Search
          </span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
          options={categoriesQuery.data ?? []}
          width="w-56"
        />
      </div>

      {invoicesQuery.isError ? (
        <ErrorPanel
          message={(invoicesQuery.error as Error).message}
          onRetry={() => invoicesQuery.refetch()}
        />
      ) : invoicesQuery.isLoading ? (
        <LoadingPanel label="Loading invoices…" />
      ) : (
        <>
          <div className="relative overflow-x-auto rounded-lg border border-border bg-surface">
            {invoicesQuery.isFetching && (
              <span className="absolute right-3 top-3 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </span>
            )}
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
                {rows.length === 0 && <EmptyRow colSpan={8} label="No invoices found." />}
                {rows.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/50"
                  >
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
                      {formatMoney(invoice.total, invoice.currency)}
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
              Page {page + 1} of {pageCount}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
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
              {formatLabel(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
