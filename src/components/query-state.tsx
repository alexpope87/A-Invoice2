import { Loader2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export function LoadingPanel({ label = "Loading data…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-6 py-16 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger-soft px-6 py-10 text-center">
      <TriangleAlert className="mx-auto size-5 text-danger" />
      <p className="mt-3 text-sm font-medium text-foreground">Could not load invoices</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {message ?? "The database request failed. Please try again."}
      </p>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyPanel({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface px-6 py-16 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
