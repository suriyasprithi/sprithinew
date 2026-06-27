"use client";

import { useMemo, useRef, useState } from "react";
import { Upload, FileUp, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { api, apiErrorMessage } from "@/lib/api";
import { ImportSummaryCard } from "@/components/products/import-summary-card";
import { TemplateBuilder } from "@/components/products/template-builder";
import {
  type Group, type ImportSummary, type ReviewRow,
  fileToRows, groupRows, isValidGroup, runChunkedImport,
} from "@/lib/catalog-import";

type Props = { onImported: () => void | Promise<void> };

/**
 * Vendor catalog import — the universal, attribute-agnostic importer in a dialog.
 * Build a template (category → attributes), upload, and rows group by item_code
 * into products + variants. Imports into the logged-in vendor's own catalog.
 */
export function CatalogImportDialog({ onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [review, setReview] = useState<ReviewRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const valid = useMemo(() => groups.filter(isValidGroup), [groups]);
  const variantCount = useMemo(() => valid.reduce((n, g) => n + g.variants.length, 0), [valid]);

  // Preview is paginated so a 5,000-row import renders only one page at a time.
  const PREVIEW_PAGE = 50;
  const previewPageCount = Math.max(1, Math.ceil(valid.length / PREVIEW_PAGE));
  const previewClamped = Math.min(previewPage, previewPageCount - 1);
  const previewStart = previewClamped * PREVIEW_PAGE;
  const previewRows = valid.slice(previewStart, previewStart + PREVIEW_PAGE);

  function reset() {
    setGroups([]); setReview([]); setTotalRows(0); setFileName(""); setProgress(""); setResult(null); setPreviewing(false); setPreviewPage(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setPreviewing(false);
    setPreviewPage(0);
    try {
      const { groups: gs, review: rv, totalRows: tr } = groupRows(await fileToRows(file));
      setGroups(gs);
      setReview(rv);
      setTotalRows(tr);
      if (!gs.length) toast.error("No products found — check the file has a header row with product_name + category");
    } catch {
      toast.error("Could not read that file");
      reset();
    }
  }

  async function doImport() {
    if (!valid.length) { toast.error("No valid products to import"); return; }
    setImporting(true);
    setResult(null);
    try {
      const agg = await runChunkedImport(
        api.post, "/vendor/products/import", valid, {},
        (done, total) => setProgress(`Importing ${done} / ${total} products…`),
      );
      setResult({
        ...agg,
        totalRows,
        variantProducts: valid.filter((g) => g.variants.length >= 2).length,
        separateProducts: valid.filter((g) => g.variants.length < 2).length,
        needsReview: review,
      });
      setProgress("");
      setGroups([]); setReview([]); setTotalRows(0); setFileName(""); setPreviewing(false); setPreviewPage(0);
      if (fileRef.current) fileRef.current.value = "";
      toast.success(`Products ${agg.products.created}+${agg.products.updated}, variants ${agg.variants.created}+${agg.variants.updated}` + (agg.failed ? `, ${agg.failed} failed` : ""));
      await onImported();
    } catch (e) {
      setProgress("");
      toast.error(apiErrorMessage(e, "Import failed"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" /> Import CSV
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-h-[92vh] sm:!max-w-xl overflow-y-auto rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Import products from CSV / Excel</DialogTitle>
            <DialogDescription>
              Build a template for your category, fill it, and upload. Rows with the same product name + category +
              brand become one product with variants — but only when every row is a clean attribute (Size, Color, RAM…).
              Bundles/packs or mixed rows stay separate and are flagged for review.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <TemplateBuilder />

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-surface-2/30 p-3">
              <Button type="button" size="sm" variant="outline" className="rounded-lg" onClick={() => fileRef.current?.click()} disabled={importing}>
                <FileUp className="h-3.5 w-3.5" /> {fileName || "Choose CSV / Excel file"}
              </Button>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
            </div>

            {groups.length > 0 && (
              <div className="rounded-xl border border-border bg-surface-2/40 p-3 text-sm">
                <p><span className="font-semibold">{valid.length}</span> products ({variantCount} variants) ready to import.</p>
                {groups.length > valid.length && (
                  <p className="mt-1 text-xs text-amber-600">{groups.length - valid.length} product(s) missing product_name / category / price will be skipped.</p>
                )}
                {review.length > 0 && (
                  <p className="mt-1 text-xs text-amber-600">{review.length} group(s) flagged <span className="font-medium">Needs review</span> (bundle/pack or mixed values) — kept as separate products.</p>
                )}
              </div>
            )}

            {previewing && valid.length > 0 && (
              <div className="space-y-2">
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-2/60 text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1.5 font-medium">#</th>
                        <th className="px-2 py-1.5 font-medium">Name</th>
                        <th className="px-2 py-1.5 font-medium">Category</th>
                        <th className="px-2 py-1.5 text-right font-medium">Price</th>
                        <th className="px-2 py-1.5 text-right font-medium">Stock</th>
                        <th className="px-2 py-1.5 text-right font-medium">Variants</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((g, i) => {
                        const cat = g.category || "—";
                        const prices = g.variants.length ? g.variants.map((v) => Number(v.price) || 0) : [Number(g.price) || 0];
                        const lo = Math.min(...prices), hi = Math.max(...prices);
                        const price = lo === hi ? `₹${lo}` : `₹${lo}–${hi}`;
                        const stock = g.variants.length ? g.variants.reduce((s, v) => s + (Number(v.stock) || 0), 0) : (Number(g.stock) || 0);
                        return (
                          <tr key={g.code + (previewStart + i)} className="border-t border-border">
                            <td className="px-2 py-1.5 text-muted-foreground">{previewStart + i + 1}</td>
                            <td className="px-2 py-1.5 font-medium">{g.name || "—"}</td>
                            <td className="px-2 py-1.5">{cat}</td>
                            <td className="px-2 py-1.5 text-right">{price}</td>
                            <td className="px-2 py-1.5 text-right">{stock}</td>
                            <td className="px-2 py-1.5 text-right">{g.variants.length || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {previewPageCount > 1 && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Showing {previewStart + 1}–{Math.min(previewStart + PREVIEW_PAGE, valid.length)} of {valid.length}</span>
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="outline" className="h-7 rounded-lg" disabled={previewClamped <= 0} onClick={() => setPreviewPage(previewClamped - 1)}>Prev</Button>
                      <span>Page {previewClamped + 1} / {previewPageCount}</span>
                      <Button type="button" size="sm" variant="outline" className="h-7 rounded-lg" disabled={previewClamped >= previewPageCount - 1} onClick={() => setPreviewPage(previewClamped + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {result && <ImportSummaryCard result={result} />}
          </div>

          <DialogFooter>
            {previewing
              ? <Button type="button" variant="outline" className="rounded-xl" disabled={importing} onClick={() => setPreviewing(false)}>Back</Button>
              : <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Close</Button>}
            {previewing ? (
              <GradientButton disabled={importing || !valid.length} onClick={() => void doImport()}>
                {importing
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> {progress || "Importing…"}</>
                  : <><Package className="h-4 w-4" /> Confirm import {valid.length || ""} products</>}
              </GradientButton>
            ) : (
              <GradientButton disabled={!valid.length} onClick={() => { setPreviewing(true); setPreviewPage(0); }}>
                <Package className="h-4 w-4" /> Import {valid.length || ""} products
              </GradientButton>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
