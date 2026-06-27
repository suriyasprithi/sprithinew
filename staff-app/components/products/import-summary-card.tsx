"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import type { ImportSummary } from "@/lib/catalog-import";

/** Shared products + variants import summary (created/updated/skipped/failed). */
export function ImportSummaryCard({ result }: { result: ImportSummary }) {
  return (
    <LuxuryCard className="space-y-3 p-5">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        <h3 className="text-sm font-semibold">Import summary</h3>
      </div>

      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Products</p>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <Stat label="Created" value={result.products.created} tone="text-emerald-600" />
        <Stat label="Updated" value={result.products.updated} tone="text-sky-600" />
        <Stat label="Skipped" value={result.products.skipped} tone="text-muted-foreground" />
      </div>

      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Variants</p>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <Stat label="Created" value={result.variants.created} tone="text-emerald-600" />
        <Stat label="Updated" value={result.variants.updated} tone="text-sky-600" />
        <Stat label="Failed" value={result.failed} tone={result.failed ? "text-red-600" : "text-muted-foreground"} />
      </div>

      {(result.totalRows != null || result.separateProducts != null) && (
        <>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Detection</p>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <Stat label="Total rows" value={result.totalRows ?? 0} tone="text-muted-foreground" />
            <Stat label="Variant products" value={result.variantProducts ?? 0} tone="text-emerald-600" />
            <Stat label="Separate" value={result.separateProducts ?? 0} tone="text-sky-600" />
          </div>
        </>
      )}

      {result.needsReview && result.needsReview.length > 0 && (
        <details className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
          <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-amber-600">
            <AlertCircle className="h-3.5 w-3.5" /> {result.needsReview.length} group(s) need review
          </summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {result.needsReview.slice(0, 100).map((r, idx) => (
              <li key={idx}><span className="font-medium text-foreground">{r.name}</span> ×{r.count} — {r.reason}</li>
            ))}
          </ul>
        </details>
      )}

      {result.failedRows.length > 0 && (
        <details className="rounded-xl border border-border bg-surface-2/40 p-3 text-xs">
          <summary className="flex cursor-pointer items-center gap-1.5 font-medium text-red-600">
            <AlertCircle className="h-3.5 w-3.5" /> {result.failed} failed row(s)
          </summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {result.failedRows.slice(0, 100).map((f, idx) => (
              <li key={idx}>Row {f.row}{f.name ? ` (${f.name})` : ""}: {f.reason || "error"}</li>
            ))}
          </ul>
        </details>
      )}
    </LuxuryCard>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-3 text-center">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
