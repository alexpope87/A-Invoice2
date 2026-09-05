import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, FileText, Loader2, ScanLine, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { createDemoInvoice } from "@/lib/invoices.functions";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UploadPage,
});

const STEPS = [
  "Uploading document",
  "Extracting fields",
  "Validating totals & VAT",
  "Classifying category",
  "Scoring risk",
];

function UploadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const processing = step >= 0;

  function accept(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setStep(-1);
    setError(null);
  }

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function analyze() {
    if (!file) return;
    setError(null);
    setStep(0);
    try {
      const path = `demo/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage
        .from("invoices")
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw new Error(uploadError.message);

      for (let i = 1; i < STEPS.length; i++) {
        setStep(i);
        await wait(700);
      }

      const { id } = await createDemoInvoice({
        data: { fileName: file.name, storagePath: path },
      });

      await queryClient.invalidateQueries();
      toast.success("Invoice processed");
      navigate({ to: "/invoices/$invoiceId", params: { invoiceId: id } });
    } catch (e) {
      setStep(-1);
      const message = e instanceof Error ? e.message : "Processing failed";
      setError(message);
      toast.error(message);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Upload invoice"
        description="Supported format: PDF up to 10 MB. AI extraction is simulated in this MVP."
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

          {error && (
            <p className="mt-4 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end">
            <Button onClick={analyze} disabled={processing}>
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
        The PDF is stored in your private Supabase storage bucket, then a realistic demo invoice
        record is created in the database. Real AI extraction will replace this step later.
      </div>
    </div>
  );
}
