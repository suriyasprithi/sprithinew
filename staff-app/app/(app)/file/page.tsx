"use client";

import { useState } from "react";
import { FolderCog, Download, FileArchive, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { CatalogImportDialog } from "@/components/products/catalog-import-dialog";
import { api, apiErrorMessage } from "@/lib/api";
import { downloadProductsCsv, type ExportProduct } from "@/lib/catalog-import";

/**
 * Vendor "File" hub — one page for all bulk file operations:
 *   • Import products (CSV/Excel + optional images ZIP)
 *   • Export products to CSV (round-trips with the import template)
 *   • Export product images as a ZIP
 */
export default function FilePage() {
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);

  async function exportCsv() {
    setExportingCsv(true);
    toast.message("Preparing CSV…");
    try {
      const all: ExportProduct[] = [];
      for (let p = 1; ; p++) {
        const res = await api.get("/vendor/products", { params: { page: p, per_page: 200 } });
        const batch = (res.data.data?.items ?? []) as ExportProduct[];
        all.push(...batch);
        if (batch.length < 200 || p > 500) break;
      }
      if (!all.length) { toast.error("No products to export"); return; }
      downloadProductsCsv(all, `products-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(`Exported ${all.length} products`);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Export failed"));
    } finally { setExportingCsv(false); }
  }

  async function exportImagesZip() {
    setExportingZip(true);
    toast.message("Preparing images ZIP…");
    try {
      const res = await api.get("/vendor/products/export-images", { responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url; a.download = "product-images.zip"; a.click();
      URL.revokeObjectURL(url);
      toast.success("Images ZIP downloaded");
    } catch (e) {
      // The error body is a blob (not JSON) with responseType:"blob", so map the
      // common cases by status instead of reading the message.
      const status = (e as { response?: { status?: number } })?.response?.status;
      toast.error(status === 404 ? "No product images to export" : apiErrorMessage(e, "Export failed"));
    } finally { setExportingZip(false); }
  }

  return (
    <>
      <MobileHeader title="File" />
      <section className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Catalog"
          icon={FolderCog}
          title="File"
          description="Bulk import and export your products and images in one place."
        />

        {/* IMPORT */}
        <LuxuryCard className="space-y-3 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"><Download className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Import products</p>
              <p className="text-xs text-muted-foreground">CSV / Excel + an optional Product Images ZIP. New categories & sub-categories are created automatically.</p>
            </div>
          </div>
          <CatalogImportDialog onImported={() => toast.success("Import finished — check the Products page")} />
        </LuxuryCard>

        {/* EXPORT CSV */}
        <LuxuryCard className="space-y-3 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><FileSpreadsheet className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Export products (CSV)</p>
              <p className="text-xs text-muted-foreground">Download all your products in the import template format — edit and re-import.</p>
            </div>
          </div>
          <Button variant="outline" className="w-full rounded-xl" onClick={() => void exportCsv()} disabled={exportingCsv}>
            <Download className="h-4 w-4" /> {exportingCsv ? "Preparing…" : "Export CSV"}
          </Button>
        </LuxuryCard>

        {/* EXPORT IMAGES ZIP */}
        <LuxuryCard className="space-y-3 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600"><FileArchive className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Export images (ZIP)</p>
              <p className="text-xs text-muted-foreground">Download all your product images as a ZIP, named by SKU so they match the CSV <code>image</code> column on re-import.</p>
            </div>
          </div>
          <Button variant="outline" className="w-full rounded-xl" onClick={() => void exportImagesZip()} disabled={exportingZip}>
            <FileArchive className="h-4 w-4" /> {exportingZip ? "Preparing…" : "Export images ZIP"}
          </Button>
        </LuxuryCard>
      </section>
    </>
  );
}
