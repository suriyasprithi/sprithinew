"use client";

import { useEffect, useRef, useState } from "react";
import { FolderCog, FileArchive, ImageOff, Search, ChevronLeft, ChevronRight, FileUp, RefreshCw, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { fileToRows, norm } from "@/lib/catalog-import";

// CSV header aliases (normalized) for the two columns the attach mapping needs.
const IMAGE_HEADERS = ["image", "imageurl", "mainimageurl", "proimage", "productimage", "variantimage"];
const KEY_HEADERS   = ["itemcode", "productcode", "code", "sku", "variantsku", "barcode"];

type ImgRow = { id: number; name: string; image: string; filename: string };

const PER_PAGE = 20;

// Mirror the backend's export-image entry name: <sanitized code/SKU>.<ext>.
function sanitizeCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[-._]+|[-._]+$/g, "");
}

function toRow(p: Record<string, unknown>): ImgRow {
  const url  = String(p.image ?? "");
  const ext  = (url.split(/[?#]/)[0].split(".").pop() || "jpg").toLowerCase();
  const code = String(p.code || p.sku || `P${p.id}`);
  return { id: Number(p.id), name: String(p.name ?? ""), image: url, filename: `${sanitizeCode(code) || `P${p.id}`}.${ext}` };
}

/**
 * Vendor "File" hub — export product images as a ZIP, and browse each product's
 * image filename (server-paginated + searchable).
 */
export default function FilePage() {
  const [exportingZip, setExportingZip] = useState(false);
  const [rows, setRows] = useState<ImgRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [reloadKey, setReloadKey] = useState(0);   // bumped after an import to refresh the table
  const [importingZip, setImportingZip] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [attachingCsv, setAttachingCsv] = useState(false);
  const zipRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  // Attach images to products from a CSV mapping: a key column (item_code / sku /
  // barcode) → the `image` column (a filename already in the pool, or a URL).
  async function attachByCsv(file: File) {
    setAttachingCsv(true);
    toast.message("Reading file…");
    try {
      const rows = await fileToRows(file);
      if (rows.length < 2) { toast.error("The file has no data rows"); return; }
      const header   = rows[0].map((h) => norm(h));
      const imageCol = header.findIndex((h) => IMAGE_HEADERS.includes(h));
      const keyCol   = header.findIndex((h) => KEY_HEADERS.includes(h));
      if (imageCol < 0) { toast.error('The file needs an "image" column'); return; }
      if (keyCol < 0)   { toast.error("The file needs a key column (item_code / sku / barcode)"); return; }

      const items = rows.slice(1)
        .map((r) => ({ key: (r[keyCol] ?? "").trim(), image: (r[imageCol] ?? "").trim() }))
        .filter((x) => x.key && x.image);
      if (!items.length) { toast.error("No key + image rows found in the file"); return; }

      let attached = 0, noProduct = 0, noImage = 0;
      for (let i = 0; i < items.length; i += 2000) {
        const res = await api.post("/vendor/products/attach-images-csv", { items: items.slice(i, i + 2000) }, { timeout: 600000 });
        const d = (res.data.data ?? {}) as { attached?: number; no_product?: number; no_image?: number };
        attached += Number(d.attached ?? 0);
        noProduct += Number(d.no_product ?? 0);
        noImage += Number(d.no_image ?? 0);
      }
      toast.success(`${attached} attached${noProduct ? ` · ${noProduct} product(s) not found` : ""}${noImage ? ` · ${noImage} image(s) not in pool` : ""}`);
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Attach failed"));
    } finally {
      setAttachingCsv(false);
      if (csvRef.current) csvRef.current.value = "";
    }
  }

  async function syncImages() {
    setSyncing(true);
    toast.message("Syncing images to products…");
    try {
      const res = await api.post("/vendor/products/attach-images", {}, { timeout: 600000 });
      const d = (res.data.data ?? {}) as { products?: number; variants?: number };
      const n = Number(d.products ?? 0) + Number(d.variants ?? 0);
      toast.success(`${n} product${n === 1 ? "" : "s"} synced from uploaded images`);
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Sync failed"));
    } finally { setSyncing(false); }
  }

  async function importImagesZip(file: File) {
    setImportingZip(true);
    toast.message("Uploading images…");
    try {
      const fd = new FormData();
      fd.append("zip", file);
      const res = await api.post("/vendor/products/import-images-only", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 600000 });
      const d = (res.data.data ?? {}) as { stored?: number; products?: number; variants?: number; unmatched?: number };
      const stored = Number(d.stored ?? 0);
      const attached = Number(d.products ?? 0) + Number(d.variants ?? 0);
      const unmatched = Number(d.unmatched ?? 0);
      toast.success(`${stored} stored · ${attached} attached to products${unmatched ? ` · ${unmatched} unmatched` : ""}`);
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Import failed"));
    } finally {
      setImportingZip(false);
      if (zipRef.current) zipRef.current.value = "";
    }
  }

  // Debounce the search box; a new term restarts at page 1.
  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 350); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [debounced]);

  // Server-paginated list of products that have an image.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await api.get("/vendor/products", { params: { has_image: 1, q: debounced || undefined, page, per_page: PER_PAGE } });
        if (cancelled) return;
        const payload = res.data.data;
        setRows(((payload?.items ?? []) as Record<string, unknown>[]).map(toRow));
        setTotal(Number(payload?.total ?? 0));
      } catch (e) {
        if (!cancelled) toast.error(apiErrorMessage(e, "Could not load products"));
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [debounced, page, reloadKey]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

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
          description="Export your product images and browse the filename each one uses."
        />

        {/* IMPORT IMAGES ZIP (images only — no CSV) */}
        <LuxuryCard className="space-y-3 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"><FileUp className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Import images (ZIP)</p>
              <p className="text-xs text-muted-foreground">Upload a ZIP of product images (no CSV). Stored by filename — a later CSV import that references those names connects automatically. jpg, png, webp. <span className="text-foreground">Large sets: split into ~90 MB ZIPs and import each — they add up.</span></p>
            </div>
          </div>
          <input ref={zipRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importImagesZip(f); }} />
          <Button variant="outline" className="w-full rounded-xl" onClick={() => zipRef.current?.click()} disabled={importingZip || syncing}>
            <FileUp className="h-4 w-4" /> {importingZip ? "Uploading…" : "Choose images ZIP"}
          </Button>
          <div className="rounded-xl bg-surface-2/50 p-3">
            <p className="text-[11px] text-muted-foreground">Already uploaded images earlier but they&apos;re not on the products? Attach them by matching filename → SKU — no re-upload.</p>
            <Button variant="outline" size="sm" className="mt-2 w-full rounded-lg" onClick={() => void syncImages()} disabled={syncing || importingZip}>
              <RefreshCw className={`h-4 w-4${syncing ? " animate-spin" : ""}`} /> {syncing ? "Syncing…" : "Sync images to products"}
            </Button>
          </div>
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
          <Button variant="outline" className="w-full rounded-xl" onClick={() => void exportImagesZip()} disabled={exportingZip || total === 0}>
            <FileArchive className="h-4 w-4" /> {exportingZip ? "Preparing…" : `Export images ZIP${total ? ` (${total})` : ""}`}
          </Button>
        </LuxuryCard>

        {/* IMAGE LIST TABLE */}
        <LuxuryCard className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Product images</p>
            <span className="text-xs text-muted-foreground">{loading ? "Loading…" : `${total} image${total === 1 ? "" : "s"}`}</span>
          </div>

          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product name…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
            </div>
          </div>

          <div className="hidden grid-cols-[64px_1fr_200px] gap-3 border-b border-border bg-surface-2/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
            <span>Image</span>
            <span>Product</span>
            <span>Filename</span>
          </div>

          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <ImageOff className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">{debounced ? "No products match your search" : "No product images yet"}</p>
              <p className="text-xs text-muted-foreground">{debounced ? "Try a different name." : "Import a CSV with an images ZIP, or add images to your products."}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <div key={r.id} className="grid grid-cols-[48px_1fr] items-center gap-3 px-4 py-2.5 sm:grid-cols-[64px_1fr_200px]">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.image} alt="" className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  </span>
                  <p className="min-w-0 truncate text-sm">{r.name || `#${r.id}`}</p>
                  <code className="col-span-2 truncate text-xs text-muted-foreground sm:col-span-1">{r.filename}</code>
                </div>
              ))}
            </div>
          )}

          {/* PAGINATION */}
          {!loading && total > PER_PAGE && (
            <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-lg" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-4 w-4" /> Prev
                </Button>
                <Button variant="outline" size="sm" className="rounded-lg" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </LuxuryCard>
      </section>
    </>
  );
}
