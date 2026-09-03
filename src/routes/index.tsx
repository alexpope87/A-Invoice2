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

import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { ConfidenceMeter, RiskBadge, StatusBadge } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { activity, formatDate, formatMoney, invoices, kpis, reviewQueue } from "@/data/invoices";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — InvoiceAI" },
      {
        name: "description",
        content:
          "Track invoice automation rate, AI confidence, review queue volume and estimated savings in one operations dashboard.",
      },
      { property: "og:title", content: "Dashboard — InvoiceAI" },
      {
        property: "og:description",
        content: "Invoice automation KPIs, recent activity and the human review queue at a glance.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const recent = invoices.slice(0, 8);
  const alerts = reviewQueue.slice(0, 4);

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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total invoices"
          value={kpis.totalInvoices.toString()}
          hint="Processed this month"
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
          label="Monthly savings"
          value={formatMoney(kpis.monthlySavings)}
          hint="Estimated processing cost avoided"
          icon={BadgeEuro}
          tone="success"
        />
        <KpiCard
          label="Rejected"
          value={invoices.filter((i) => i.status === "rejected").length.toString()}
          hint="Blocked by validation rules"
          icon={TriangleAlert}
          tone="warning"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Processing activity</h2>
              <p className="text-xs text-muted-foreground">Invoices per day, last 7 days</p>
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
                    {formatMoney(invoice.total)} · {invoice.number}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Recent invoices</h2>
            <p className="text-xs text-muted-foreground">Latest documents processed by the engine</p>
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
    </div>
  );
}
