import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BadgeEuro,
  CheckCircle2,
  Clock,
  FileStack,
  Gauge,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ConfidenceMeter, RiskBadge, StatusBadge } from "@/components/badges";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { EmptyPanel, ErrorPanel } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/data/invoices";
import { getDashboardData } from "@/lib/invoices.functions";

const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: () => getDashboardData(),
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    // Prefetch only; a failed prefetch must not reject the loader.
    context.queryClient.ensureQueryData(dashboardQuery).catch(() => undefined);
  },
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-[1400px]">
      <ErrorPanel message={error.message} onRetry={reset} />
    </div>
  ),
  head: () => ({
    meta: [
      { title: "Dashboard — InvoiceAI invoice automation" },
      {
        name: "description",
        content:
          "Track invoice automation rate, AI confidence, review queue and estimated savings for your finance team.",
      },
      { property: "og:title", content: "Dashboard — InvoiceAI invoice automation" },
      {
        property: "og:description",
        content: "KPIs, processing activity and recent invoices in one operations view.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const { kpis, activity, recent, alerts } = data;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        title="Dashboard"
        description="Invoice processing performance for the current period."
        actions={
          <Button asChild>
            <Link to="/upload">
              <Sparkles className="size-4" />
              Process new invoice
            </Link>
          </Button>
        }
      />

      {kpis.totalInvoices === 0 ? (
        <EmptyPanel
          title="No invoices yet"
          hint="Upload your first PDF invoice to see processing metrics here."
        />
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total invoices"
              value={kpis.totalInvoices.toString()}
              hint="Processed to date"
              icon={FileStack}
            />
            <KpiCard
              label="Auto-approved"
              value={kpis.autoApproved.toString()}
              hint="No human touch required"
              icon={CheckCircle2}
              tone="success"
            />
            <KpiCard
              label="Needs review"
              value={kpis.needsReview.toString()}
              hint="Waiting in the review queue"
              icon={TriangleAlert}
              tone="warning"
            />
            <KpiCard
              label="Automation rate"
              value={`${kpis.automationRate}%`}
              hint="Target 85%"
              icon={Gauge}
              tone="info"
            />
            <KpiCard
              label="Avg. AI confidence"
              value={`${kpis.averageConfidence}%`}
              hint="Across extracted fields"
              icon={Sparkles}
              tone="info"
            />
            <KpiCard
              label="Hours saved"
              value={kpis.hoursSaved.toFixed(1)}
              hint="Vs. manual data entry"
              icon={Clock}
              tone="success"
            />
            <KpiCard
              label="Estimated savings"
              value={formatMoney(kpis.monthlySavings)}
              hint="Processing cost avoided"
              icon={BadgeEuro}
              tone="success"
            />
            <KpiCard
              label="Rejected"
              value={kpis.rejected.toString()}
              hint="Rejected by a reviewer"
              icon={TriangleAlert}
              tone="warning"
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-border bg-surface p-5 lg:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Processing activity</h2>
                  <p className="text-xs text-muted-foreground">Invoices per week, last 7 weeks</p>
                </div>
              </div>
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activity} barGap={4}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      stroke="var(--muted-foreground)"
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      stroke="var(--muted-foreground)"
                      width={28}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--muted)" }}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="approved"
                      name="Auto-approved"
                      fill="var(--chart-1)"
                      radius={[3, 3, 0, 0]}
                    />
                    <Bar
                      dataKey="review"
                      name="Needs review"
                      fill="var(--chart-2)"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Review alerts</h2>
                <Link
                  to="/review"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Open queue <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
              {alerts.length === 0 ? (
                <p className="mt-6 text-xs text-muted-foreground">
                  Nothing waiting for review right now.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {alerts.map((invoice) => (
                    <li key={invoice.id}>
                      <Link
                        to="/invoices/$invoiceId"
                        params={{ invoiceId: invoice.id }}
                        className="block rounded-md border border-border p-3 transition-colors hover:bg-accent"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{invoice.supplier}</span>
                          <RiskBadge risk={invoice.risk} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{invoice.reason}</p>
                        <p className="mt-1 font-mono text-xs tabular-nums text-foreground">
                          {formatMoney(invoice.total, invoice.currency)} · {invoice.number}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Recent invoices</h2>
                <p className="text-xs text-muted-foreground">
                  Latest documents processed by the engine
                </p>
              </div>
              <Link
                to="/history"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View all <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2.5 font-medium">Invoice</th>
                    <th className="px-5 py-2.5 font-medium">Supplier</th>
                    <th className="px-5 py-2.5 font-medium">Date</th>
                    <th className="px-5 py-2.5 text-right font-medium">Amount</th>
                    <th className="px-5 py-2.5 font-medium">Confidence</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((invoice) => (
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
                      <td className="px-5 py-3">
                        <ConfidenceMeter value={invoice.confidence} />
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={invoice.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
