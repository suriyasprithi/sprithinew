"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { ImportSummaryCard } from "@/components/products/import-summary-card";
import { TemplateBuilder } from "@/components/products/template-builder";
import {
  type Group, type ImportSummary,
  fileToRows, groupRows, isValidGroup, runChunkedImport,
} from "@/lib/catalog-import";

type Vendor = { id: number; name: string };

export default function ImportProductsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<ImportSummary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/vendors");
        const raw = (res.data.data?.items ?? res.data.data ?? []) as Record<string, unknown>[];
        setVendors(raw.map((v) => ({ id: Number(v.id ?? 0), name: String(v.shop_name || v.name || `Vendor #${v.id}`) })));
      } catch (e) { toast.error(apiErrorMessage(e, "Could not load vendors")); }
    })();
  }, []);

  const valid = useMemo(() => groups.filter(isValidGroup), [groups]);
  const variantCount = useMemo(() => valid.reduce((n, g) => n + g.variants.length, 0), [valid]);

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setResult(null);
    try {
      const gs = groupRows(await fileToRows(f));
      setGroups(gs);
      if (!gs.length) toast.error("No products found — check the file has a header row + item_code column");
    } catch {
      toast.error("Could not read that file");
    }
  }

  async function runImport() {
    if (!vendorId) { toast.error("Pick a vendor first"); return; }
    if (!valid.length) { toast.error("No valid products to import"); return; }
    setImporting(true);
    setResult(null);
    try {
      const agg = await runChunkedImport(
        api.post, "/admin/products/import", valid,
        { vendor_id: Number(vendorId) },
        (done, total) => setProgress(`Importing ${done} / ${total} products…`),
      );
      setResult(agg);
      setProgress("");
      toast.success(`Products ${agg.products.created}+${agg.products.updated}, variants ${agg.variants.created}+${agg.variants.updated}` + (agg.failed ? `, ${agg.failed} failed` : ""));
      setGroups([]); setFileName("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      setProgress("");
      toast.error(apiErrorMessage(e, "Import failed"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <MobileHeader title="Import Products" />
      <section className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Catalog"
          icon={Upload}
          title="Import Products"
          description="One universal importer for every category. Rows sharing an item_code become one product; each row is a SKU/variant. Any attribute column (Color, Size, RAM…) is supported automatically."
        />

        <TemplateBuilder />

        <LuxuryCard className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label>Vendor</Label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="h-10 w-full appearance-none rounded-xl border border-input bg-surface-2/60 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="">{vendors.length ? "Select a vendor" : "Loading…"}</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <p className="text-[11px] text-muted-foreground">All products in the file are imported under this vendor.</p>
          </div>

          <div className="space-y-1.5">
            <Label>CSV / Excel file</Label>
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" onChange={(e) => void pickFile(e)} className="hidden" />
            <Button variant="outline" className="w-full" onClick={() => inputRef.current?.click()} disabled={importing}>
              <Upload className="h-4 w-4" /> {fileName || "Choose CSV / Excel"}
            </Button>
          </div>

          {groups.length > 0 && (
            <div className="rounded-xl border border-border bg-surface-2/40 p-3 text-sm">
              <p><span className="font-semibold">{valid.length}</span> products ({variantCount} variants) ready to import.</p>
              {groups.length > valid.length && (
                <p className="mt-1 text-xs text-amber-600">{groups.length - valid.length} product(s) missing item_code / product_name / price will be skipped.</p>
              )}
            </div>
          )}

          <GradientButton className="w-full" onClick={() => void runImport()} disabled={importing || !vendorId || !valid.length}>
            {importing
              ? <><Loader2 className="h-4 w-4 animate-spin" /> {progress || "Importing…"}</>
              : <><Package className="h-4 w-4" /> Import {valid.length || ""} products</>}
          </GradientButton>

          <p className="text-[11px] text-muted-foreground">
            Reserved columns: item_code, product_name, category, sub_category, brand, hsn_code, description, sku,
            barcode, mrp, offer_price, stock, status. Every other column is treated as a variant attribute.
            Discount % is auto-computed from MRP &amp; offer price.
          </p>
        </LuxuryCard>

        {result && <ImportSummaryCard result={result} />}
      </section>
    </>
  );
}
