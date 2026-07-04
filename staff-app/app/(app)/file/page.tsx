"use client";

import { useEffect, useState } from "react";
import { FolderCog, FileArchive, ImageOff, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";

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
  }, [debounced, page]);

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
