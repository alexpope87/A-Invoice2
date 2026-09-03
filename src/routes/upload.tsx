import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, FileText, Loader2, ScanLine, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { demoAnalysisInvoiceId } from "@/data/invoices";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload invoice — InvoiceAI" },
      {
        name: "description",
        content:
          "Drop a PDF invoice and let InvoiceAI extract, validate, classify and risk-score it automatically.",
      },
      { property: "og:title", content: "Upload invoice — InvoiceAI" },
      {
        property: "og:description",
        content: "Drag and drop a PDF invoice to start automated processing.",
      },
    ],
  }),
  component: UploadPage,
});

const STEPS = [
  "Reading document",
  "Extracting fields",
  "Validating totals & VAT",
  "Classifying category",
  "Scoring risk",
];

function UploadPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState(-1);

  const processing = step >= 0;

  useEffect(() => {
    if (!processing) return;
    if (step >= STEPS.length) {
      const t = setTimeout(
        () => navigate({ to: "/invoices/$invoiceId", params: { invoiceId: demoAnalysisInvoiceId } }),
        600,
      );
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 850);
    return () => clearTimeout(t);
  }, [step, processing, navigate]);

  function accept(f: File | undefined) {
    if (!f) return;
    setFile({ name: f.name, size: f.size });
    setStep(-1);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Upload invoice"
        description="Supported format: PDF up to 10 MB. Processing is simulated in this MVP."
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "rounded-lg border-2 border-dashed border-border bg-surface px-6 py-14 text-center transition-colors",
          dragging && "border-primary bg-accent",
        )}
      >
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
          <UploadCloud className="size-6" />
        </span>
        <h2 className="mt-4 text-base font-semibold text-foreground">
          Drag & drop your invoice here
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          or select a file from your computer — PDF only
        </p>
        <div className="mt-5">
          <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={processing}>
            <FileText className="size-4" />
            Select file
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => accept(e.target.files?.[0] ?? undefined)}
          />
        </div>
      </div>

      {file && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-danger-soft text-danger">
              <FileText className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB · PDF
              </p>
            </div>
            {!processing && (
              <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>

          {processing && (
            <div className="mt-5 space-y-4">
              <Progress value={Math.min(100, ((step + 1) / STEPS.length) * 100)} />
              <ul className="space-y-2">
                {STEPS.map((label, i) => (
                  <li key={label} className="flex items-center gap-2 text-sm">
                    {i < step ? (
                      <CheckCircle2 className="size-4 text-success" />
                    ) : i === step ? (
                      <Loader2 className="size-4 animate-spin text-primary" />
                    ) : (
                      <span className="size-4 rounded-full border border-border" />
                    )}
                    <span className={i <= step ? "text-foreground" : "text-muted-foreground"}>
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <Button onClick={() => setStep(0)} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Analyzing…
                </>
              ) : (
                <>
                  <ScanLine className="size-4" /> Analyze invoice
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-accent/50 p-4 text-sm text-muted-foreground">
        The engine extracts supplier data, totals and VAT, checks the document against your
        validation rules, assigns a spend category and returns a risk score. Invoices that pass every
        rule are approved automatically; anything else lands in the review queue.
      </div>
    </div>
  );
}
