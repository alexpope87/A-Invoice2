import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  XCircle,
} from "lucide-react";
import type { InvoiceStatus, RiskLevel } from "@/data/invoices";
import { cn } from "@/lib/utils";

const base =
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide";

const statusMap: Record<InvoiceStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  "auto-approved": {
    label: "Auto-approved",
    className: "border-success/30 bg-success-soft text-success",
    Icon: CheckCircle2,
  },
  "needs-review": {
    label: "Needs review",
    className: "border-warning/30 bg-warning-soft text-warning",
    Icon: AlertTriangle,
  },
  processing: {
    label: "Processing",
    className: "border-info/30 bg-info-soft text-info",
    Icon: Loader2,
  },
  rejected: {
    label: "Rejected",
    className: "border-danger/30 bg-danger-soft text-danger",
    Icon: XCircle,
  },
};

export function StatusBadge({ status, className }: { status: InvoiceStatus; className?: string }) {
  const { label, className: tone, Icon } = statusMap[status];
  return (
    <span className={cn(base, tone, className)}>
      <Icon className={cn("size-3.5", status === "processing" && "animate-spin")} />
      {label}
    </span>
  );
}

const riskMap: Record<RiskLevel, { label: string; className: string; Icon: typeof ShieldCheck }> = {
  low: { label: "Low risk", className: "border-success/30 bg-success-soft text-success", Icon: ShieldCheck },
  medium: {
    label: "Medium risk",
    className: "border-warning/30 bg-warning-soft text-warning",
    Icon: ShieldQuestion,
  },
  high: { label: "High risk", className: "border-danger/30 bg-danger-soft text-danger", Icon: ShieldAlert },
};

export function RiskBadge({ risk, className }: { risk: RiskLevel; className?: string }) {
  const { label, className: tone, Icon } = riskMap[risk];
  return (
    <span className={cn(base, tone, className)}>
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

export function ConfidenceMeter({ value, className }: { value: number; className?: string }) {
  const tone = value >= 93 ? "bg-success" : value >= 80 ? "bg-warning" : "bg-danger";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${value}%` }} />
      </div>
      <span className="font-mono text-xs tabular-nums text-foreground">{value.toFixed(1)}%</span>
    </div>
  );
}

export function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-muted-foreground">
        <CircleDashed className="mx-auto mb-2 size-5 opacity-50" />
        {label}
      </td>
    </tr>
  );
}
