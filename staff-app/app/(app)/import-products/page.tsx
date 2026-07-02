"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Loader2, Package, FileUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { ImportSummaryCard } from "@/components/products/import-summary-card";
import { TemplateBuilder } from "@/components/products/template-builder";
import {
  type Group, type ImportSummary, type ReviewRow,
  fileToRows, groupRows, isValidGroup, runChunkedImport,
} from "@/lib/catalog-import";

type Vendor = { id: number; label: string };

export default function ImportProductsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [review, setReview] = useState<ReviewRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<ImportSummary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);   // optional product-images ZIP
  const zipRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/vendors");
        const raw = (res.data.data?.items ?? res.data.data ?? []) as Record<string, unknown>[];
        // Label = shop/owner name · mobile · taluk, so the searchable dropdown
        // can tell duplicate shop names apart (search matches any of the three).
        setVendors(raw.map((v) => {
          const profile = (v.profile ?? {}) as Record<string, unknown>;
          const shop   = String(profile.shop_name || v.name || `Vendor #${v.id}`);
          const mobile = v.mobile_number ? String(v.mobile_number) : "";
          const taluk  = profile.taluk_name ? String(profile.taluk_name) : "";
          const label  = [shop, mobile, taluk].filter(Boolean).join(" · ");
          return { id: Number(v.id ?? 0), label };
        }));
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
      const { groups: gs, review: rv, totalRows: tr } = groupRows(await fileToRows(f));
      setGroups(gs);
      setReview(rv);
      setTotalRows(tr);
      if (!gs.length) toast.error("No products found — check the file has a header row with product_name + category");
    } catch {
      toast.error("Could not read that file");
    }
  }

  async function runImport() {
    if (!vendorId) { toast.error("Pick a vendor first"); return; }
    if (!valid.length) { toast.error("No valid products to import"); return; }
    setImporting(true);
    setResult(null);
    let imageBatch = "";
    try {
      // 1. Upload the images ZIP first (optional) → batch token.
      if (zipFile) {
        setProgress("Uploading images…");
        const fd = new FormData();
        fd.append("zip", zipFile);
        const up = await api.post("/admin/products/import-images", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 600000 });
        imageBatch = String(up.data.data?.token ?? "");
      }
      // 2. Chunked row import — passes the token so each chunk resolves its images.
      const agg = await runChunkedImport(
        api.post, "/admin/products/import", valid,
        { vendor_id: Number(vendorId), ...(imageBatch ? { image_batch: imageBatch } : {}) },
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
      toast.success(`Products ${agg.products.created}+${agg.products.updated}, variants ${agg.variants.created}+${agg.variants.updated}` + (agg.failed ? `, ${agg.failed} failed` : ""));
      setGroups([]); setReview([]); setTotalRows(0); setFileName("");
      setZipFile(null);
      if (inputRef.current) inputRef.current.value = "";
      if (zipRef.current) zipRef.current.value = "";
    } catch (e) {
      setProgress("");
      toast.error(apiErrorMessage(e, "Import failed"));
    } finally {
      setImporting(false);
      // Best-effort cleanup of the extracted ZIP temp on the server.
      if (imageBatch) { try { await api.post("/admin/products/import-images/cleanup", { token: imageBatch }); } catch { /* ignore */ } }
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
          description="One universal importer for every category. Rows with the same product name + category + brand auto-merge into one product with variants — only when every row is a clean attribute (Size, Color, RAM…). Bundles/packs or mixed rows stay separate and are flagged Needs review."
        />

        <TemplateBuilder />

        <LuxuryCard className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label>Vendor</Label>
            <Combobox
              value={vendorId}
              onValueChange={(v) => setVendorId(v || "")}
              options={vendors.map((v) => ({ value: String(v.id), label: v.label }))}
              placeholder={vendors.length ? "Select a vendor" : "Loading…"}
              searchPlaceholder="Search by shop, mobile or taluk…"
              emptyText="No vendor found."
              className="h-10 w-full rounded-xl bg-surface-2/60"
            />
            <p className="text-[11px] text-muted-foreground">All products in the file are imported under this vendor.</p>
          </div>

          <div className="space-y-1.5">
            <Label>CSV / Excel file</Label>
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" onChange={(e) => void pickFile(e)} className="hidden" />
            <Button variant="outline" className="w-full" onClick={() => inputRef.current?.click()} disabled={importing}>
              <Upload className="h-4 w-4" /> {fileName || "Choose CSV / Excel"}
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Product Images ZIP <span className="text-[11px] font-normal text-muted-foreground">(optional)</span></Label>
            <input ref={zipRef} type="file" accept=".zip,application/zip" onChange={(e) => setZipFile(e.target.files?.[0] ?? null)} className="hidden" />
            <div className="flex items-center gap-2">
              <Button variant="outline" className="w-full justify-start truncate" onClick={() => zipRef.current?.click()} disabled={importing}>
                <FileUp className="h-4 w-4 shrink-0" /> {zipFile ? zipFile.name : "Choose images ZIP"}
              </Button>
              {zipFile && (
                <Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs text-muted-foreground" disabled={importing} onClick={() => { setZipFile(null); if (zipRef.current) zipRef.current.value = ""; }}>Clear</Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">Matched to each row by the <code>image</code> filename (or SKU). jpg, png, webp. Max 300 MB.</p>
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

          <GradientButton className="w-full" onClick={() => void runImport()} disabled={importing || !vendorId || !valid.length}>
            {importing
              ? <><Loader2 className="h-4 w-4 animate-spin" /> {progress || "Importing…"}</>
              : <><Package className="h-4 w-4" /> Import {valid.length || ""} products</>}
          </GradientButton>

          <p className="text-[11px] text-muted-foreground">
            Reserved columns: item_code, product_name, category, sub_category, brand, hsn_code, description, sku,
            barcode, mrp, offer_price, stock, status, image. Every other column is treated as a variant attribute.
            <span className="text-foreground"> sub_category is optional</span> — created under its category on import.
            <span className="text-foreground"> image</span> = a filename inside the uploaded ZIP (or a full URL).
            Discount % is auto-computed from MRP &amp; offer price.
          </p>
        </LuxuryCard>

        {result && <ImportSummaryCard result={result} />}
      </section>
    </>
  );
}
