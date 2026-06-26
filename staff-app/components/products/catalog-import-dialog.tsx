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
  type Group, type ImportSummary,
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
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<ImportSummary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const valid = useMemo(() => groups.filter(isValidGroup), [groups]);
  const variantCount = useMemo(() => valid.reduce((n, g) => n + g.variants.length, 0), [valid]);

  function reset() {
    setGroups([]); setFileName(""); setProgress(""); setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    try {
      const gs = groupRows(await fileToRows(file));
      setGroups(gs);
      if (!gs.length) toast.error("No products found — check the file has a header row + item_code");
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
      setResult(agg);
      setProgress("");
      setGroups([]); setFileName("");
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
              Build a template for your category, fill it, and upload. Rows sharing an item_code become one product;
              each row is a SKU/variant. Any attribute column (Color, Size, RAM…) works automatically.
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
                  <p className="mt-1 text-xs text-amber-600">{groups.length - valid.length} product(s) missing item_code / product_name / price will be skipped.</p>
                )}
              </div>
            )}

            {result && <ImportSummaryCard result={result} />}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Close</Button>
            <GradientButton disabled={importing || !valid.length} onClick={() => void doImport()}>
              {importing
                ? <><Loader2 className="h-4 w-4 animate-spin" /> {progress || "Importing…"}</>
                : <><Package className="h-4 w-4" /> Import {valid.length || ""} products</>}
            </GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
