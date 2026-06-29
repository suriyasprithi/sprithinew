"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Package, Plus, Search, MoreHorizontal, Pencil, Boxes, Tag, Layers, Trash2, Shapes, CircleCheck, CircleOff, Copy, X, Download } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { ImageDrop } from "@/components/ui/custom/image-drop";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/data-table/status-badge";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { CatalogImportDialog } from "@/components/products/catalog-import-dialog";
import { downloadProductsCsv } from "@/lib/catalog-import";
import { api, apiErrorMessage } from "@/lib/api";
import {
  mock,
  type VendorProduct,
  type VendorCategoryFull,
  type ProductAttributes,
  type VType,
  type ProductCombo,
  type VariantImages,
} from "@/lib/mock";

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

type ComboRow = {
  key: string;
  options: Record<string, string>;
  name: string;
  sku: string;
  price: string;  // string for input binding
  stock: string;
};

type Draft = {
  id?: number;
  name: string;
  description: string;
  price: string;
  mrp: string;                     // MRP (was "offer_price"); stored in products.mrp
  stock: string;
  sku: string;                     // stored in products.code (catalog SKU / upsert key)
  delivery_time: string;
  status: "active" | "inactive";
  vendor_category_id: number | null;
  category_id: number | null;      // selected product category (parent)
  image: string | null;            // dataURL or absolute URL — stored in products.image (TEXT)
  attributes: ProductAttributes;
  variant_types: VType[];
  combos: ComboRow[];              // Cartesian product, vendor-edited per row
  variant_images: VariantImages;   // per-axis-per-option image arrays
  // Comprehensive catalog details (string-bound inputs; backend normalizes/computes).
  brand: string;
  hsn_code: string;
  barcode: string;
  tax_type: string;                // "" | "exclusive" | "inclusive"
  tax_percentage: string;
  discount_type: string;           // "" | "percentage" | "fixed"
  discount_value: string;
  min_stock_alert: string;
  max_order_qty: string;
  weight: string;
  length: string;
  width: string;
  height: string;
  unit: string;
  delivery_charge: string;
  return_days: string;
  warranty_days: string;
  short_description: string;
  tags: string;
  gallery_images: string;          // one URL per line / comma-separated
  featured: boolean;
};

type ProductCategory = { id: number; name: string; commission_pct: number; vendor_category_id: number | null; status: "active" | "inactive" };

// The catalog-detail fields, all blank.
const blankCatalog = () => ({
  brand: "", hsn_code: "", barcode: "",
  tax_type: "", tax_percentage: "", discount_type: "", discount_value: "",
  min_stock_alert: "", max_order_qty: "", weight: "", length: "", width: "", height: "",
  unit: "", delivery_charge: "", return_days: "", warranty_days: "",
  short_description: "", tags: "", gallery_images: "", featured: false,
});

function blankDraft(defaultCategoryId: number | null): Draft {
  return {
    name: "", description: "", price: "", mrp: "", stock: "",
    sku: "", delivery_time: "", status: "active",
    vendor_category_id: defaultCategoryId,
    category_id: null,
    image: null,
    attributes: {},
    variant_types: [],
    combos: [],
    variant_images: {},
    ...blankCatalog(),
  };
}

// Map a product row's catalog columns into Draft string/bool fields (edit + clone).
function catalogDraftFrom(p: VendorProduct): ReturnType<typeof blankCatalog> {
  const s = (v: unknown) => (v == null ? "" : String(v));
  let gallery = "";
  try {
    const g = p.gallery_images ? JSON.parse(p.gallery_images) : null;
    gallery = Array.isArray(g) ? g.join("\n") : (typeof p.gallery_images === "string" ? p.gallery_images : "");
  } catch { gallery = typeof p.gallery_images === "string" ? p.gallery_images : ""; }
  return {
    brand: s(p.brand), hsn_code: s(p.hsn_code), barcode: s(p.barcode),
    tax_type: s(p.tax_type).toLowerCase(), tax_percentage: s(p.tax_percentage),
    discount_type: s(p.discount_type).toLowerCase(), discount_value: s(p.discount_value),
    min_stock_alert: s(p.min_stock_alert), max_order_qty: s(p.max_order_qty),
    weight: s(p.weight), length: s(p.length), width: s(p.width), height: s(p.height),
    unit: s(p.unit), delivery_charge: s(p.delivery_charge),
    return_days: s(p.return_days), warranty_days: s(p.warranty_days),
    short_description: s(p.short_description), tags: s(p.tags),
    gallery_images: gallery,
    featured: Number(p.featured) === 1, // API returns "1"/"0" (string) for TINYINT
  };
}

// Resolve the Category picker value from a product (flat — no sub-category).
function categorySplit(p: VendorProduct): { category_id: number | null } {
  return { category_id: p.category_id ?? null };
}

function code(s: string, max: number): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, Math.max(1, max));
}
function suggestSku(productName: string, options: Record<string, string>): string {
  const parts = [code(productName, 8), ...Object.values(options).map((v) => code(v, 6))].filter(Boolean);
  return parts.join("-");
}
function comboKey(options: Record<string, string>): string {
  return Object.entries(options)
    .map(([k, v]) => `${k}=${v}`)
    .join("|");
}
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
function cloneVariantImages(src: VariantImages): VariantImages {
  const out: VariantImages = {};
  for (const axis of Object.keys(src)) {
    out[axis] = {};
    for (const opt of Object.keys(src[axis])) {
      out[axis][opt] = [...src[axis][opt]];
    }
  }
  return out;
}
/** Strip the images map to only axes/options that the current types declare. */
function pruneVariantImages(images: VariantImages, types: VType[]): VariantImages {
  const allowed = new Map<string, Set<string>>();
  for (const t of types) allowed.set(t.name, new Set(t.options));
  const out: VariantImages = {};
  for (const axis of Object.keys(images)) {
    const allowedOpts = allowed.get(axis);
    if (!allowedOpts) continue;
    const axisOut: Record<string, string[]> = {};
    for (const opt of Object.keys(images[axis])) {
      if (!allowedOpts.has(opt)) continue;
      const list = images[axis][opt].filter(Boolean);
      if (list.length) axisOut[opt] = list;
    }
    if (Object.keys(axisOut).length) out[axis] = axisOut;
  }
  return out;
}
function cartesianCombos(types: VType[]): Array<{ key: string; options: Record<string, string>; name: string }> {
  const valid = types.filter((t) => t.name.trim() && t.options.length > 0);
  if (!valid.length) return [];
  let rows: Array<Record<string, string>> = [{}];
  for (const t of valid) {
    const next: Array<Record<string, string>> = [];
    for (const r of rows) for (const opt of t.options) next.push({ ...r, [t.name]: opt });
    rows = next;
  }
  return rows.map((opts) => ({
    key: comboKey(opts),
    options: opts,
    name: Object.values(opts).join(" + "),
  }));
}
function mergeCombos(prev: ComboRow[], generated: ReturnType<typeof cartesianCombos>, defaultPrice: string, defaultStock: string, productName: string): ComboRow[] {
  const byKey = new Map(prev.map((c) => [c.key, c]));
  return generated.map((g) => {
    const existing = byKey.get(g.key) ?? findBestPartialMatch(prev, g.options);
    return {
      key: g.key,
      options: g.options,
      name: existing?.name && Object.values(existing.options).every((v) => Object.values(g.options).includes(v))
        ? existing.name
        : g.name,
      sku: existing?.sku ?? suggestSku(productName, g.options),
      price: existing?.price ?? defaultPrice,
      stock: existing?.stock ?? defaultStock,
    };
  });
}
/**
 * When axes are added/removed, exact key match fails. Find any previous combo
 * whose shared axes (intersection of old + new) all have matching values.
 * Useful for: add axis (Storage) — keep the (Color=Black) row's price across
 * the new (Color=Black, Storage=*) rows. First match wins.
 */
function findBestPartialMatch(prev: ComboRow[], opts: Record<string, string>): ComboRow | undefined {
  return prev.find((c) => {
    const shared = Object.keys(c.options).filter((k) => k in opts);
    if (shared.length === 0) return false;
    return shared.every((k) => c.options[k] === opts[k]);
  });
}

export default function VendorProductsPage() {
  const [items, setItems] = useState<VendorProduct[]>([]);
  const [vendorCategory, setVendorCategory] = useState<VendorCategoryFull | null>(null);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [newCat, setNewCat] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, active: 0, total_stock: 0, total_value: 0 });
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VendorProduct | null>(null);
  const [rowBusy, setRowBusy] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importSearch, setImportSearch] = useState("");
  // Bulk-select for mass delete.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Debounce the search box → a server query; new search/status restarts at page 1.
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search.trim()), 350); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [debouncedSearch, status]);

  // Vendor category + its product categories — loaded once.
  useEffect(() => {
    void (async () => {
      const vc = await api.get("/vendor/me/category")
        .then((res) => (res.data.data?.category ?? null) as VendorCategoryFull | null)
        .catch(() => mock.currentVendorCategory());
      setVendorCategory(vc);

      const params = vc ? { vendor_category_id: vc.id } : {};
      const cats = await api.get("/catalog/categories", { params })
        .then((res) => {
          const items = res.data.data?.items;
          return Array.isArray(items) ? (items as ProductCategory[]) : [];
        })
        .catch(() => {
          // Offline fallback: derive a couple of sample product categories per vendor category.
          if (!vc) return [];
          const seed: Record<number, ProductCategory[]> = {
            1: [
              { id: 101, name: "Vegetables", commission_pct: 3, vendor_category_id: 1, status: "active" },
              { id: 102, name: "Fruits",     commission_pct: 3, vendor_category_id: 1, status: "active" },
              { id: 103, name: "Snacks",     commission_pct: 4, vendor_category_id: 1, status: "active" },
            ],
            2: [
              { id: 201, name: "Sona Masuri", commission_pct: 3, vendor_category_id: 2, status: "active" },
              { id: 202, name: "Basmati",     commission_pct: 3, vendor_category_id: 2, status: "active" },
            ],
            3: [
              { id: 301, name: "OTC medicine", commission_pct: 3, vendor_category_id: 3, status: "active" },
              { id: 302, name: "Wellness",     commission_pct: 3, vendor_category_id: 3, status: "active" },
            ],
            4: [
              { id: 401, name: "Mobiles",     commission_pct: 4, vendor_category_id: 4, status: "active" },
              { id: 402, name: "Accessories", commission_pct: 4, vendor_category_id: 4, status: "active" },
            ],
            5: [
              { id: 501, name: "Veg",     commission_pct: 5, vendor_category_id: 5, status: "active" },
              { id: 502, name: "Non-Veg", commission_pct: 5, vendor_category_id: 5, status: "active" },
            ],
          };
          return seed[vc.id] ?? [];
        });
      setProductCategories(Array.isArray(cats) ? cats : []);
    })();
  }, []);

  // One server page of products — the backend owns filtering, paging and the
  // aggregate stat counts (a vendor can have 14k+ products).
  const PAGE_SIZE = 50;
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await api.get("/vendor/products", {
          params: { q: debouncedSearch || undefined, status: status !== "all" ? status : undefined, page, per_page: PAGE_SIZE },
        });
        if (cancelled) return;
        const payload = res.data.data;
        setItems((Array.isArray(payload?.items) ? payload.items : []) as VendorProduct[]);
        setTotal(Number(payload?.total ?? 0));
        const s = payload?.stats;
        if (s) setStats({ total: Number(s.total ?? 0), active: Number(s.active ?? 0), total_stock: Number(s.total_stock ?? 0), total_value: Number(s.total_value ?? 0) });
      } catch {
        if (cancelled) return;
        const m = await mock.vendorProducts();
        setItems(m);
        setTotal(m.length);
        setStats({ total: m.length, active: m.filter((p) => p.status === "active").length, total_stock: m.reduce((s, p) => s + (Number(p.stock) || 0), 0), total_value: m.reduce((s, p) => s + p.price * p.stock, 0) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [debouncedSearch, status, page, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  // The server already returns just this page; filtering/paging happen on the backend.
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = items;
  const pageIds = paged.map((p) => p.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  function toggleSelectPage() {
    setSelected((s) => {
      const n = new Set(s);
      if (allPageSelected) pageIds.forEach((id) => n.delete(id));
      else pageIds.forEach((id) => n.add(id));
      return n;
    });
  }
  const totalStock = stats.total_stock;
  const totalValue = stats.total_value;
  const activeCount = stats.active;

  // Category dropdown options. Always include the product's CURRENT category so
  // an edit pre-selects it even when that category isn't linked to this vendor
  // category (imported products' categories often aren't) — otherwise the field
  // looks empty though the product clearly has a category.
  const categoryOptions = useMemo(() => {
    const opts = productCategories.map((c) => ({ value: String(c.id), label: c.name }));
    const cid = editing?.category_id;
    if (cid != null && !opts.some((o) => o.value === String(cid))) {
      const prod = items.find((p) => p.id === editing?.id);
      opts.unshift({ value: String(cid), label: prod?.category_name ?? `Category #${cid}` });
    }
    return opts;
  }, [productCategories, editing?.category_id, editing?.id, items]);

  function startNew() {
    setEditing(blankDraft(vendorCategory?.id ?? null));
  }
  async function toggleStatus(p: VendorProduct) {
    const next = p.status === "active" ? "inactive" : "active";
    setRowBusy(p.id);
    try {
      await api.patch(`/vendor/products/${p.id}`, { status: next });
      setItems((cur) => cur.map((x) => (x.id === p.id ? { ...x, status: next } : x)));
      toast.success(`${p.name} ${next === "active" ? "activated" : "deactivated"}`);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not update status"));
    } finally { setRowBusy(null); }
  }

  async function removeProduct() {
    if (!deleteTarget) return;
    const p = deleteTarget;
    setRowBusy(p.id);
    try {
      await api.delete(`/vendor/products/${p.id}`);
      setItems((cur) => cur.filter((x) => x.id !== p.id));
      toast.success(`${p.name} deleted`);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Delete failed"));
    } finally {
      setRowBusy(null);
      setDeleteTarget(null);
    }
  }

  function toggleSelect(id: number) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function clearSelection() { setSelected(new Set()); }
  function selectAllFiltered() { setSelected(new Set(items.map((p) => p.id))); }

  async function bulkDelete() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      // Chunk to respect the backend's per-request cap; works for huge selections.
      let done = 0;
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        await api.post("/vendor/products/bulk-delete", { ids: chunk });
        done += chunk.length;
        if (ids.length > 500) toast.message(`Deleting… ${done}/${ids.length}`);
      }
      setSelected(new Set());
      setBulkConfirm(false);
      toast.success(`${ids.length} product${ids.length === 1 ? "" : "s"} deleted`);
      reload();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Bulk delete failed"));
      reload();
    } finally {
      setBulkBusy(false);
    }
  }

  function startEdit(p: VendorProduct) {
    const cs = categorySplit(p);
    setEditing({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      price: String(p.price),
      mrp: p.mrp != null ? String(p.mrp) : "",
      stock: String(p.stock),
      sku: p.code ?? p.sku ?? "",
      delivery_time: p.delivery_time ?? "",
      status: p.status,
      vendor_category_id: p.vendor_category_id ?? vendorCategory?.id ?? null,
      category_id: cs.category_id,
      image: (p as VendorProduct & { image?: string | null }).image ?? null,
      attributes: { ...(p.attributes ?? {}) },
      variant_types: (p.variant_types ?? []).map((t) => ({ name: t.name, options: [...t.options] })),
      combos: (p.variants ?? []).map((v) => ({
        key: comboKey(v.options),
        options: { ...v.options },
        name: v.name,
        sku: v.sku ?? "",
        price: String(v.price),
        stock: String(v.stock),
      })),
      variant_images: cloneVariantImages(p.variant_images ?? {}),
      ...catalogDraftFrom(p),    });
  }

  /** Import all fields from an existing product into a new draft (no id, stock reset to 0). */
  function importFromProduct(p: VendorProduct) {
    const cs = categorySplit(p);
    setEditing({
      // no `id` — creates a new product on save
      name: p.name,
      description: p.description ?? "",
      price: String(p.price),
      mrp: p.mrp != null ? String(p.mrp) : "",
      stock: "0", // reset
      sku: "", // a clone is a new product — don't copy the SKU/code (would collide on upsert)
      delivery_time: p.delivery_time ?? "",
      status: "active",
      vendor_category_id: p.vendor_category_id ?? vendorCategory?.id ?? null,
      category_id: cs.category_id,
      image: (p as VendorProduct & { image?: string | null }).image ?? null,
      attributes: { ...(p.attributes ?? {}) },
      variant_types: (p.variant_types ?? []).map((t) => ({ name: t.name, options: [...t.options] })),
      combos: (p.variants ?? []).map((v) => ({
        key: comboKey(v.options),
        options: { ...v.options },
        name: v.name,
        sku: v.sku ?? "",
        price: String(v.price),
        stock: "0", // reset per-variant stock
      })),
      variant_images: cloneVariantImages(p.variant_images ?? {}),
      ...catalogDraftFrom(p),    });
    setImportOpen(false);
    setImportSearch("");
    toast.success(`Imported from ${p.name} — set new stock & save`);
  }

  // Vendor creates a new product category, filed under their own vendor
  // category (backend POST /vendor/categories = ensure: case-insensitive,
  // returns existing id if the name already exists). Then auto-select it.
  async function createCategory() {
    const name = newCat.trim();
    if (!name) return;
    setCreatingCat(true);
    try {
      const res = await api.post("/vendor/categories", { names: [name] });
      const item = ((res.data.data?.items ?? [])[0] ?? null) as { id?: number; created?: boolean } | null;
      const id = item?.id ? Number(item.id) : null;
      if (!id) { toast.error("Could not create category"); return; }
      setProductCategories((prev) =>
        prev.some((c) => c.id === id)
          ? prev
          : [...prev, { id, name, commission_pct: 0, vendor_category_id: vendorCategory?.id ?? null, status: "active" }],
      );
      setEditing((p) => (p ? { ...p, category_id: id, attributes: {} } : p));
      setNewCat("");
      toast.success(item?.created ? `Category "${name}" created` : `Using existing "${name}"`);
    } catch (e) { toast.error(apiErrorMessage(e, "Could not create category")); }
    finally { setCreatingCat(false); }
  }

  async function exportCsv() {
    toast.message("Preparing export…");
    try {
      // Pull every page (200/req) so the export covers the whole catalog, not
      // just the page on screen (the list is now server-paginated).
      const all: VendorProduct[] = [];
      for (let p = 1; ; p++) {
        const res = await api.get("/vendor/products", { params: { page: p, per_page: 200 } });
        const batch = (res.data.data?.items ?? []) as VendorProduct[];
        all.push(...batch);
        if (batch.length < 200 || p > 500) break;
      }
      if (!all.length) { toast.error("No products to export"); return; }
      downloadProductsCsv(all, `products-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(`Exported ${all.length} products`);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Export failed"));
    }
  }

  async function save() {
    if (!editing) return;
    const { name, price, stock, attributes } = editing;
    if (!name || !price || !stock) { toast.error("Name, price and stock are required"); return; }
    if (editing.category_id == null) { toast.error("Pick a product category"); return; }

    const cleanTypes = editing.variant_types
      .map((t) => ({ name: t.name.trim(), options: t.options.map((o) => o.trim()).filter(Boolean) }))
      .filter((t) => t.name && t.options.length > 0);
    const variantsPayload = cleanTypes.length > 0
      ? editing.combos.map((c) => ({
          name: c.name,
          sku: c.sku || null,
          options: c.options,
          price: Number(c.price) || 0,
          stock: Number(c.stock) || 0,
        }))
      : [];
    const variantImagesPayload = cleanTypes.length > 0
      ? pruneVariantImages(editing.variant_images, cleanTypes)
      : {};

    const payload: Record<string, unknown> = {
      name,
      description: editing.description || null,
      price: Number(price),
      stock: Number(stock),
      status: editing.status,
      category_id: editing.category_id,                       // product category (drives commission)
      vendor_category_id: editing.vendor_category_id,         // auto from logged-in vendor
      image: editing.image,                                   // dataURL or null
      attributes,
      variant_types: cleanTypes,
      variants: variantsPayload,
      variant_images: variantImagesPayload,
    };
    if (editing.delivery_time) payload.delivery_time = editing.delivery_time;

    // Reconciled price/code + comprehensive catalog details. Sent on every save so
    // a full edit is the source of truth; the backend normalizes and computes the
    // tax/discount amounts. (A blank field clears that column on save.)
    const num = (v: string) => (v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : null);
    payload.mrp             = num(editing.mrp);
    payload.code            = editing.sku.trim() || null;             // SKU → products.code (upsert key)    payload.brand           = editing.brand.trim() || null;
    payload.hsn_code        = editing.hsn_code.trim() || null;
    payload.barcode         = editing.barcode.trim() || null;
    payload.unit            = editing.unit.trim() || null;
    payload.short_description = editing.short_description.trim() || null;
    payload.tags            = editing.tags.trim() || null;
    payload.gallery_images  = editing.gallery_images;                // string of URLs; backend → JSON array
    payload.tax_type        = editing.tax_type;                      // "" | exclusive | inclusive
    payload.tax_percentage  = num(editing.tax_percentage);
    payload.discount_type   = editing.discount_type;                 // "" | percentage | fixed
    payload.discount_value  = num(editing.discount_value);
    payload.min_stock_alert = num(editing.min_stock_alert);
    payload.max_order_qty   = num(editing.max_order_qty);
    payload.weight          = num(editing.weight);
    payload.length          = num(editing.length);
    payload.width           = num(editing.width);
    payload.height          = num(editing.height);
    payload.delivery_charge = num(editing.delivery_charge);
    payload.return_days     = num(editing.return_days);
    payload.warranty_days   = num(editing.warranty_days);
    payload.featured        = editing.featured ? 1 : 0;

    try {
      if (editing.id) {
        await api.patch(`/vendor/products/${editing.id}`, payload);
        toast.success("Product updated");
      } else {
        await api.post("/vendor/products", payload);
        toast.success("Product added");
      }
      setEditing(null);
      reload(); // refresh the current page from the server
    } catch (e) {
      toast.error(apiErrorMessage(e, "Save failed"));
    }
  }

  return (
    <>
      <MobileHeader title="Products" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 pb-24 md:p-8">
        <PageHeader
          eyebrow="Catalog"
          icon={Package}
          title="My products"
          description={vendorCategory ? `You're listing under the ${vendorCategory.name} vendor category. Pick a product category per product.` : "Manage your storefront listings, stock and prices."}
          action={
            <div className="flex items-center gap-2">
              <CatalogImportDialog
                onImported={async () => {
                  reload(); // refresh the current page from the server
                  // Refresh categories too — the import may have created new ones.
                  try {
                    const params = vendorCategory ? { vendor_category_id: vendorCategory.id } : {};
                    const res = await api.get("/catalog/categories", { params });
                    const cats = res.data.data?.items;
                    if (Array.isArray(cats)) setProductCategories(cats as ProductCategory[]);
                  } catch { /* keep current categories if reload fails */ }
                }}
              />
              <Button variant="outline" className="rounded-xl" onClick={exportCsv}>
                <Download className="h-4 w-4" /> Export
              </Button>
              <GradientButton onClick={startNew}>
                <Plus className="h-4 w-4" /> New product
              </GradientButton>
            </div>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total products"  value={stats.total} icon={Package} tone="brand"   spark={[2, 2, 3, 3, 3, 3, 3, 3]} />
          <StatCard label="Active"          value={activeCount}  icon={Tag}     tone="emerald" spark={[2, 2, 3, 3, 3, 3, 3, 3]} />
          <StatCard label="Total stock"     value={totalStock}   icon={Boxes}   tone="amber"   spark={[8, 10, 12, 14, 12, 16, 18, 18]} />
          <StatCard label="Inventory value" value={totalValue}   icon={Package} tone="violet"  spark={[3, 5, 6, 8, 9, 10, 12, 13]} format={fmtINR} />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
            </div>
            <Select value={status} onValueChange={(v) => v && setStatus(v as "all" | "active" | "inactive")}>
              <SelectTrigger className="h-10 rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/5 px-4 py-2.5">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <div className="flex flex-wrap items-center gap-2">
              {selected.size < items.length && (
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={selectAllFiltered}>Select all {items.length}</Button>
              )}
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={clearSelection}>Clear</Button>
              <Button size="sm" className="h-8 gap-1 bg-rose-500 text-xs text-white hover:bg-rose-600" disabled={bulkBusy} onClick={() => setBulkConfirm(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete selected
              </Button>
            </div>
          </div>
        )}

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[1.4fr_140px_120px_120px_120px_56px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span className="flex items-center gap-2">
              <input type="checkbox" checked={allPageSelected} onChange={toggleSelectPage} aria-label="Select all on page" className="h-4 w-4 accent-rose-500" />
              Product
            </span>
            <span>Category</span>
            <span>Stock</span>
            <span>Price</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          {loading ? (
            <div className="p-3"><TableSkeleton rows={4} cols={6} /></div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products match your filters"
              description="Adjust filters or list a new product."
              action={<GradientButton onClick={startNew}><Plus className="h-4 w-4" /> New product</GradientButton>}
            />
          ) : (
            <div className="divide-y divide-border">
              {paged.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[1.4fr_140px_120px_120px_120px_56px]"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      aria-label={`Select ${p.name}`}
                      className="h-4 w-4 shrink-0 accent-rose-500"
                    />
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <Package className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground md:hidden">{p.category_name} · stock {p.stock}{p.has_variants ? " · variants" : ""}</p>
                      {p.attributes && typeof p.attributes === "object" && Object.keys(p.attributes).length > 0 && (
                        <div className="mt-1 hidden flex-wrap gap-1 md:flex">
                          {Object.entries(p.attributes).slice(0, 3).map(([k, v]) => (
                            <span key={k} className="rounded-full border border-border bg-surface-2/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {String(v)}
                            </span>
                          ))}
                          {Object.keys(p.attributes).length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{Object.keys(p.attributes).length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="hidden text-sm text-muted-foreground md:block">
                    {p.category_name}{p.has_variants ? <span className="ml-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-medium text-violet-400">variants</span> : null}
                  </p>
                  <p className="hidden text-sm font-medium md:block">{p.stock}</p>
                  <p className="hidden text-sm font-bold text-brand md:block">{fmtINR(p.price)}</p>
                  <div className="hidden md:block"><StatusBadge status={p.status} /></div>
                  <div className="flex items-center gap-2 justify-self-end">
                    <p className="text-sm font-bold text-brand md:hidden">{fmtINR(p.price)}</p>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button type="button" aria-label="Row actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem disabled={rowBusy === p.id} onClick={() => void toggleStatus(p)}>
                          {p.status === "active"
                            ? <><CircleOff className="h-4 w-4" /> Set inactive</>
                            : <><CircleCheck className="h-4 w-4" /> Set active</>}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={rowBusy === p.id}
                          onClick={() => setDeleteTarget(p)}
                          className="text-rose-400 focus:text-rose-400"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          {!loading && total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
              <span>{total} products · showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, total)}</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="h-7 rounded-lg" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>Prev</Button>
                <span>Page {safePage} / {pageCount}</span>
                <Button size="sm" variant="outline" className="h-7 rounded-lg" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? <><span className="font-medium text-foreground">{deleteTarget.name}</span> and all its variant SKUs will be removed permanently. This can&apos;t be undone.</> : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void removeProduct()} className="bg-rose-500 text-white hover:bg-rose-600">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkConfirm} onOpenChange={(o) => { if (!o && !bulkBusy) setBulkConfirm(false); }}>
        <AlertDialogContent className="rounded-2xl border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} product{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              The selected products will be removed from your store. An admin can restore them if it was a mistake.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <Button onClick={() => void bulkDelete()} disabled={bulkBusy} className="bg-rose-500 text-white hover:bg-rose-600">
              {bulkBusy ? "Deleting…" : `Delete ${selected.size}`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setImportOpen(false); setImportSearch(""); } }}>
        <DialogContent className="max-h-[92vh] sm:!max-w-3xl lg:!max-w-5xl overflow-y-auto rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit product" : "New product"}</DialogTitle>
            <DialogDescription>
              {vendorCategory
                ? <>Your vendor category is <span className="font-medium text-foreground">{vendorCategory.name}</span>. Pick a product category and fill the fields below.</>
                : "Common product fields"}
            </DialogDescription>
          </DialogHeader>

          {/* IMPORT FROM EXISTING — only on new product creation, when vendor has at least one product */}
          {editing && !editing.id && items.length > 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface-2/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <Copy className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">Import from existing product</p>
                    <p className="text-[11px] text-muted-foreground">Copies name, price, variants, images & SKUs. Stock is reset to 0.</p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={importOpen ? "secondary" : "outline"}
                  className="shrink-0 rounded-lg"
                  onClick={() => { setImportOpen((o) => !o); setImportSearch(""); }}
                >
                  {importOpen ? (<><X className="h-3.5 w-3.5" /> Close</>) : (<><Copy className="h-3.5 w-3.5" /> Pick product</>)}
                </Button>
              </div>

              {importOpen ? (
                <div className="mt-3 space-y-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={importSearch}
                      onChange={(e) => setImportSearch(e.target.value)}
                      placeholder="Search your products by name or SKU…"
                      className="h-9 rounded-lg bg-background pl-9 text-sm"
                    />
                  </div>
                  <div className="max-h-[260px] space-y-1.5 overflow-y-auto rounded-lg border border-border bg-background/40 p-1.5">
                    {(() => {
                      const q = importSearch.trim().toLowerCase();
                      const list = q
                        ? items.filter((p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q))
                        : items;
                      if (list.length === 0) {
                        return (
                          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                            {items.length === 0 ? "No products yet — create your first one below." : "No matches for that search."}
                          </div>
                        );
                      }
                      return list.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => importFromProduct(p)}
                          className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition hover:bg-surface-2"
                        >
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-2 text-muted-foreground">
                            {(p as VendorProduct & { image?: string | null }).image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={(p as VendorProduct & { image?: string | null }).image as string} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-3.5 w-3.5" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{p.name}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {fmtINR(p.price)}
                              {p.sku ? <> · <span className="font-mono">{p.sku}</span></> : null}
                              {(p.variants?.length ?? 0) > 0 ? <> · {p.variants?.length} variants</> : null}
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] uppercase tracking-wider text-brand opacity-0 transition group-hover:opacity-100">Import</span>
                        </button>
                      ));
                    })()}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-5">
            {/* VENDOR CATEGORY — read-only badge (auto from logged-in vendor) */}
            <div className="space-y-1.5">
              <Label>Vendor category</Label>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-border bg-surface-2/40 px-3">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Layers className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm font-medium">{vendorCategory?.name ?? "—"}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">Auto</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Set once on your vendor profile by admin — can&apos;t be changed here.</p>
            </div>

            {/* PRODUCT CATEGORY — filtered to vendor's vendor_category */}
            <div className="space-y-1.5">
              <Label>Product category <span className="text-brand">*</span></Label>
              <Combobox
                value={editing?.category_id != null ? String(editing.category_id) : ""}
                onValueChange={(v) => v && setEditing((p) => {
                  if (!p) return p;
                  const newId = Number(v);
                  if (p.category_id === newId) return p;
                  return { ...p, category_id: newId, attributes: {} };
                })}
                options={categoryOptions}
                placeholder={categoryOptions.length === 0 ? "No categories available for your vendor category" : "Pick a category — Vegetables, Fruits, Rice…"}
                searchPlaceholder="Search category…"
                emptyText={`No categories — ask admin to link some to ${vendorCategory?.name ?? "your vendor category"}`}
                className="h-11 w-full rounded-xl bg-surface-2/60"
              />
              <p className="text-[11px] text-muted-foreground">Only categories linked to your <span className="font-medium text-foreground">{vendorCategory?.name ?? "vendor category"}</span> appear here.</p>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void createCategory(); } }}
                  placeholder="Can't find it? Type a new category…"
                  className="h-9 flex-1 rounded-lg bg-surface-2/60 text-sm"
                  disabled={creatingCat}
                />
                <Button type="button" size="sm" variant="outline" className="h-9 shrink-0" onClick={() => void createCategory()} disabled={creatingCat || !newCat.trim()}>
                  {creatingCat ? "Creating…" : <><Plus className="h-3.5 w-3.5" /> Create</>}
                </Button>
              </div>
            </div>

            {/* COMMON FIELDS — image left, details right on md+ */}
            <div className="grid gap-5 md:grid-cols-[280px_1fr]">
              {/* LEFT: Product image */}
              <div className="space-y-1.5">
                <Label>Product image</Label>
                <ImageDrop value={editing?.image ?? null} onChange={(d) => setEditing((p) => p && ({ ...p, image: d }))} />
                <p className="text-[11px] text-muted-foreground">Square images (1:1) display best in the customer app. Leave empty to use the default SPRITHI tile.</p>
              </div>

              {/* RIGHT: Details */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Name <span className="text-brand">*</span></Label>
                  <Input value={editing?.name ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, name: e.target.value }))} placeholder="Sona Masuri Rice 5kg" className="h-11 rounded-xl bg-surface-2/60" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Description</Label>
                  <Textarea rows={3} value={editing?.description ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, description: e.target.value }))} placeholder="Short product description" className="rounded-xl bg-surface-2/60" />
                </div>
                <div className="space-y-1.5">
                  <Label>Price (₹) <span className="text-brand">*</span></Label>
                  <Input type="number" value={editing?.price ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, price: e.target.value }))} className="h-11 rounded-xl bg-surface-2/60" />
                </div>
                <div className="space-y-1.5">
                  <Label>MRP (₹)</Label>
                  <Input type="number" value={editing?.mrp ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, mrp: e.target.value }))} placeholder="Optional — struck-through price" className="h-11 rounded-xl bg-surface-2/60" />
                </div>
                <div className="space-y-1.5">
                  <Label>Stock <span className="text-brand">*</span></Label>
                  <Input type="number" value={editing?.stock ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, stock: e.target.value }))} className="h-11 rounded-xl bg-surface-2/60" />
                </div>
                <div className="space-y-1.5">
                  <Label>SKU</Label>
                  <Input value={editing?.sku ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, sku: e.target.value }))} placeholder="VEN-001" className="h-11 rounded-xl bg-surface-2/60 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label>Delivery time</Label>
                  <Input value={editing?.delivery_time ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, delivery_time: e.target.value }))} placeholder="30 min, Same day…" className="h-11 rounded-xl bg-surface-2/60" />
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={editing?.status ?? "active"} onValueChange={(v) => v && setEditing((p) => p && ({ ...p, status: v as "active" | "inactive" }))}>
                    <SelectTrigger className="h-11 w-full rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* CATALOG DETAILS — comprehensive fields (stored on the product) */}
            <div className="space-y-3 rounded-xl border border-border bg-surface-2/20 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Catalog details</h4>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing?.featured ?? false}
                    onChange={(e) => setEditing((p) => p && ({ ...p, featured: e.target.checked }))}
                    className="h-4 w-4 rounded border-input accent-brand"
                  />
                  Featured product
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {([
                  ["brand", "Brand", "text"],
                  ["hsn_code", "HSN code", "text"],
                  ["barcode", "Barcode", "text"],
                  ["unit", "Unit (kg, pcs…)", "text"],
                  ["tax_percentage", "Tax %", "number"],
                  ["discount_value", "Discount value", "number"],
                  ["weight", "Weight", "number"],
                  ["length", "Length", "number"],
                  ["width", "Width", "number"],
                  ["height", "Height", "number"],
                  ["delivery_charge", "Delivery charge (₹)", "number"],
                  ["min_stock_alert", "Min stock alert", "number"],
                  ["max_order_qty", "Max order qty", "number"],
                  ["return_days", "Return days", "number"],
                  ["warranty_days", "Warranty days", "number"],
                ] as const).map(([key, label, type]) => (
                  <div key={key} className="space-y-1.5">
                    <Label>{label}</Label>
                    <Input
                      type={type}
                      value={editing?.[key] ?? ""}
                      onChange={(e) => setEditing((p) => p && ({ ...p, [key]: e.target.value }))}
                      className="h-10 rounded-xl bg-surface-2/60"
                    />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label>Tax type</Label>
                  <Select value={editing?.tax_type || "none"} onValueChange={(v) => v && setEditing((p) => p && ({ ...p, tax_type: v === "none" ? "" : v }))}>
                    <SelectTrigger className="h-10 w-full rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="exclusive">Exclusive</SelectItem>
                      <SelectItem value="inclusive">Inclusive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Discount type</Label>
                  <Select value={editing?.discount_type || "none"} onValueChange={(v) => v && setEditing((p) => p && ({ ...p, discount_type: v === "none" ? "" : v }))}>
                    <SelectTrigger className="h-10 w-full rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Short description</Label>
                <Input value={editing?.short_description ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, short_description: e.target.value }))} placeholder="One-line summary" className="h-10 rounded-xl bg-surface-2/60" />
              </div>
              <div className="space-y-1.5">
                <Label>Tags</Label>
                <Input value={editing?.tags ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, tags: e.target.value }))} placeholder="comma,separated,tags" className="h-10 rounded-xl bg-surface-2/60" />
              </div>
              <div className="space-y-1.5">
                <Label>Gallery image URLs</Label>
                <Textarea rows={2} value={editing?.gallery_images ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, gallery_images: e.target.value }))} placeholder="One image URL per line" className="rounded-xl bg-surface-2/60" />
              </div>
              <p className="text-[11px] text-muted-foreground">Tax &amp; discount amounts are calculated automatically. These details are stored on the product.</p>
            </div>

            {editing && (
              <VariantsEditor
                draft={editing}
                onTypesChange={(types) => setEditing((p) => {
                  if (!p) return p;
                  const generated = cartesianCombos(types);
                  const combos = mergeCombos(p.combos, generated, p.price, p.stock, p.name);
                  const variant_images = pruneVariantImages(p.variant_images, types);
                  return { ...p, variant_types: types, combos, variant_images };
                })}
                onComboChange={(key, patch) => setEditing((p) => p && ({
                  ...p,
                  combos: p.combos.map((c) => (c.key === key ? { ...c, ...patch } : c)),
                }))}
                onImagesChange={(axis, option, images) => setEditing((p) => {
                  if (!p) return p;
                  const next = cloneVariantImages(p.variant_images);
                  if (!next[axis]) next[axis] = {};
                  if (images.length) next[axis][option] = images;
                  else delete next[axis][option];
                  if (Object.keys(next[axis] ?? {}).length === 0) delete next[axis];
                  return { ...p, variant_images: next };
                })}
              />
            )}

          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <GradientButton onClick={save}>{editing?.id ? "Save changes" : "Save"}</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function VariantsEditor({ draft, onTypesChange, onComboChange, onImagesChange }: {
  draft: Draft;
  onTypesChange: (next: VType[]) => void;
  onComboChange: (key: string, patch: Partial<ComboRow>) => void;
  onImagesChange: (axis: string, option: string, images: string[]) => void;
}) {
  const types = draft.variant_types;
  const images = draft.variant_images;
  const [vZoom, setVZoom] = useState<string | null>(null);   // click a thumb → full-screen preview

  function addType() {
    onTypesChange([...types, { name: "", options: [] }]);
  }
  function updateType(idx: number, patch: Partial<VType>) {
    onTypesChange(types.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }
  function removeType(idx: number) {
    onTypesChange(types.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-5 border-t border-border pt-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5"><Shapes className="h-3.5 w-3.5 text-brand" /> Variant types</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addType} className="h-8 gap-1 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add type
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Each type (Color, Storage, RAM…) lists its options — one per line. All Cartesian combinations appear below for per-SKU pricing and stock.</p>

        {types.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-2/30 p-6 text-center">
            <Shapes className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No variant types</p>
            <p className="text-[11px] text-muted-foreground">Skip this section for a single-SKU product. Add types only if this product comes in multiple options.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {types.map((t, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface-2/40 p-3">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Type name</Label>
                    <Input
                      value={t.name}
                      onChange={(e) => updateType(i, { name: e.target.value })}
                      placeholder="e.g. Color"
                      className="h-9 rounded-lg bg-background"
                    />
                  </div>
                  <button type="button" onClick={() => removeType(i)} aria-label="Remove type" className="self-end rounded-md p-2 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Options (one per line)</Label>
                  <Textarea
                    rows={3}
                    value={(t.options ?? []).join("\n")}
                    onChange={(e) => updateType(i, { options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                    placeholder={"Black\nBlue\nSilver"}
                    className="rounded-lg bg-background font-mono text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-brand" /> Variant images</Label>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">per option</span>
        </div>
        <p className="text-[11px] text-muted-foreground">Upload images per option (e.g. Black gets black-front/back). The customer page swaps the gallery when this axis option is picked. Optional — combinations use the product image otherwise. <span className="font-medium text-foreground">Max 5 MB each.</span></p>
        {types.some((t) => t.name.trim() && t.options.length > 0) ? (
          <div className="space-y-3">
            {types.filter((t) => t.name.trim() && t.options.length > 0).map((t) => (
              <div key={t.name} className="rounded-xl border border-border bg-surface-2/40 p-3">
                <p className="mb-2 text-xs font-semibold">{t.name}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {t.options.map((opt) => {
                    const imgs = images[t.name]?.[opt] ?? [];
                    return (
                      <div key={opt} className="space-y-1.5 rounded-lg border border-border bg-background p-2">
                        <p className="text-xs font-medium">{opt}</p>
                        <div className="flex flex-wrap gap-2">
                          {imgs.map((src, idx) => (
                            <div key={idx} className="relative h-16 w-16 overflow-hidden rounded-md border border-border">
                              <img src={src} alt={`${t.name} ${opt} ${idx + 1}`} onClick={() => setVZoom(src)} className="h-full w-full cursor-zoom-in object-cover" />
                              <button
                                type="button"
                                onClick={() => onImagesChange(t.name, opt, imgs.filter((_, i) => i !== idx))}
                                aria-label="Remove image"
                                className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/90 text-white hover:bg-rose-500"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border border-dashed border-border text-muted-foreground hover:border-brand/40 hover:text-brand">
                            <Plus className="h-4 w-4" />
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={async (e) => {
                                const files = Array.from(e.currentTarget.files ?? []);
                                e.currentTarget.value = "";
                                if (!files.length) return;
                                const ok = files.filter((f) => {
                                  if (f.size > 5 * 1024 * 1024) { toast.error(`${f.name} is over 5 MB — skipped`); return false; }
                                  return true;
                                });
                                if (!ok.length) return;
                                const newDataUrls = await Promise.all(ok.map(readAsDataUrl));
                                onImagesChange(t.name, opt, [...imgs, ...newDataUrls]);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-surface-2/30 p-6 text-center">
            <Layers className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Add variant types first</p>
            <p className="text-[11px] text-muted-foreground">Define a variant type above (e.g. Color → Black, Blue) and per-option image slots appear here.</p>
          </div>
        )}
        {vZoom && typeof document !== "undefined" && createPortal(
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4" onClick={() => setVZoom(null)}>
            <button type="button" onClick={() => setVZoom(null)} aria-label="Close preview" className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={vZoom} alt="Variant preview" onClick={(e) => e.stopPropagation()} className="max-h-[90vh] max-w-full rounded-xl object-contain" />
          </div>,
          document.body,
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5"><Boxes className="h-3.5 w-3.5 text-brand" /> Combinations</Label>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{draft.combos.length} SKU{draft.combos.length === 1 ? "" : "s"}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">Each combination becomes one SKU in product_variants. Price and stock track per row.</p>

        {draft.combos.length > 0 ? (
          <>
          <BulkActionsBar
            productName={draft.name}
            types={types}
            combos={draft.combos}
            onComboChange={onComboChange}
          />

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="hidden grid-cols-[1.4fr_1.2fr_120px_100px] gap-3 border-b border-border bg-surface-2/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
              <span>Combination</span>
              <span>SKU</span>
              <span>Price (₹)</span>
              <span>Stock</span>
            </div>
            <div className="divide-y divide-border">
              {draft.combos.map((c) => (
                <div key={c.key} className="grid grid-cols-1 gap-2 px-3 py-2 md:grid-cols-[1.4fr_1.2fr_120px_100px] md:items-center">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <Input
                    value={c.sku}
                    onChange={(e) => onComboChange(c.key, { sku: e.target.value })}
                    placeholder="SKU"
                    className="h-9 rounded-lg bg-background font-mono text-xs"
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={c.price}
                    onChange={(e) => onComboChange(c.key, { price: e.target.value })}
                    placeholder="0"
                    className="h-9 rounded-lg bg-background"
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={c.stock}
                    onChange={(e) => onComboChange(c.key, { stock: e.target.value })}
                    placeholder="0"
                    className="h-9 rounded-lg bg-background"
                  />
                </div>
              ))}
            </div>
          </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-surface-2/30 p-6 text-center">
            <Boxes className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No combinations yet</p>
            <p className="text-[11px] text-muted-foreground">Add at least one variant type above with options — every Cartesian combination appears here for per-SKU pricing and stock.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BulkActionsBar({ productName, types, combos, onComboChange }: {
  productName: string;
  types: VType[];
  combos: ComboRow[];
  onComboChange: (key: string, patch: Partial<ComboRow>) => void;
}) {
  const [skuPrefix, setSkuPrefix] = useState("");
  const [filterAxis, setFilterAxis] = useState<string>("__all");
  const [filterValue, setFilterValue] = useState<string>("");
  const [priceOp, setPriceOp] = useState<"set" | "add">("set");
  const [priceVal, setPriceVal] = useState<string>("");
  const [stockOp, setStockOp] = useState<"set" | "add">("set");
  const [stockVal, setStockVal] = useState<string>("");

  const filteredCount = useMemo(() => combos.filter((c) =>
    filterAxis === "__all" ? true : (!filterValue ? false : c.options[filterAxis] === filterValue)
  ).length, [combos, filterAxis, filterValue]);

  function regenerateSkus() {
    const prefix = skuPrefix.trim() ? code(skuPrefix, 16) : code(productName, 8);
    for (const c of combos) {
      const parts = [prefix, ...Object.values(c.options).map((v) => code(v, 6))].filter(Boolean);
      onComboChange(c.key, { sku: parts.join("-") });
    }
    toast.success(`Regenerated ${combos.length} SKU${combos.length === 1 ? "" : "s"}`);
  }

  function applyBulk() {
    if (priceVal === "" && stockVal === "") {
      toast.error("Enter a price or stock value");
      return;
    }
    const matches = combos.filter((c) =>
      filterAxis === "__all" ? true : (!filterValue ? false : c.options[filterAxis] === filterValue)
    );
    if (matches.length === 0) {
      toast.error("No rows match the filter");
      return;
    }
    for (const c of matches) {
      const patch: Partial<ComboRow> = {};
      if (priceVal !== "") {
        const v = Number(priceVal);
        if (!Number.isNaN(v)) {
          patch.price = String(priceOp === "set" ? v : (Number(c.price) || 0) + v);
        }
      }
      if (stockVal !== "") {
        const v = Number(stockVal);
        if (!Number.isNaN(v)) {
          patch.stock = String(stockOp === "set" ? v : (Number(c.stock) || 0) + v);
        }
      }
      if (Object.keys(patch).length) onComboChange(c.key, patch);
    }
    toast.success(`Updated ${matches.length} row${matches.length === 1 ? "" : "s"}`);
    setPriceVal(""); setStockVal("");
  }

  const axisOptions = useMemo(() => {
    if (filterAxis === "__all") return [];
    const t = types.find((x) => x.name === filterAxis);
    return t?.options ?? [];
  }, [filterAxis, types]);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface-2/40 p-3">
      <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">SKU prefix (optional)</Label>
          <Input
            value={skuPrefix}
            onChange={(e) => setSkuPrefix(e.target.value)}
            placeholder={code(productName, 8) || "e.g. RM14"}
            className="h-9 rounded-lg bg-background font-mono text-xs"
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={regenerateSkus} className="h-9 gap-1">
          <Boxes className="h-3.5 w-3.5" /> Regenerate SKUs
        </Button>
      </div>

      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Bulk update</p>

        <div className="grid gap-2 md:grid-cols-[1fr_1fr]">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Filter by axis</Label>
            <Select value={filterAxis} onValueChange={(v) => { if (v) { setFilterAxis(v); setFilterValue(""); } }}>
              <SelectTrigger className="h-9 w-full rounded-lg bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All combinations</SelectItem>
                {types.map((t) => (
                  <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Value</Label>
            <Select
              value={filterValue || "__none"}
              onValueChange={(v) => v && setFilterValue(v === "__none" ? "" : v)}
            >
              <SelectTrigger className="h-9 w-full rounded-lg bg-background" disabled={filterAxis === "__all"}>
                <SelectValue placeholder={filterAxis === "__all" ? "—" : "Pick value"} />
              </SelectTrigger>
              <SelectContent>
                {axisOptions.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-[1fr_1fr]">
          <div className="grid grid-cols-[110px_1fr] gap-2">
            <Select value={priceOp} onValueChange={(v) => v && setPriceOp(v as "set" | "add")}>
              <SelectTrigger className="h-9 w-full rounded-lg bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="set">Set price</SelectItem>
                <SelectItem value="add">Add to price</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              inputMode="numeric"
              value={priceVal}
              onChange={(e) => setPriceVal(e.target.value)}
              placeholder={priceOp === "set" ? "₹ amount" : "+/- ₹"}
              className="h-9 rounded-lg bg-background"
            />
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-2">
            <Select value={stockOp} onValueChange={(v) => v && setStockOp(v as "set" | "add")}>
              <SelectTrigger className="h-9 w-full rounded-lg bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="set">Set stock</SelectItem>
                <SelectItem value="add">Add to stock</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              inputMode="numeric"
              value={stockVal}
              onChange={(e) => setStockVal(e.target.value)}
              placeholder={stockOp === "set" ? "units" : "+/- units"}
              className="h-9 rounded-lg bg-background"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={applyBulk}
            disabled={filteredCount === 0 || (priceVal === "" && stockVal === "")}
            className="h-9 gap-1"
          >
            Apply to {filteredCount} row{filteredCount === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </div>
  );
}
