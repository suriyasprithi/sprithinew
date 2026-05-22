"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Package, Plus, Search, MoreHorizontal, Pencil, Boxes, Tag, Layers, Trash2, Shapes, CircleCheck, CircleOff, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

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
  offer_price: string;
  stock: string;
  sku: string;
  delivery_time: string;
  status: "active" | "inactive";
  vendor_category_id: number | null;
  category_id: number | null;      // selected product category
  image: string | null;            // dataURL or absolute URL — stored in products.image (TEXT)
  attributes: ProductAttributes;
  variant_types: VType[];
  combos: ComboRow[];              // Cartesian product, vendor-edited per row
  variant_images: VariantImages;   // per-axis-per-option image arrays
};

type ProductCategory = { id: number; name: string; commission_pct: number; vendor_category_id: number | null; status: "active" | "inactive" };

function blankDraft(defaultCategoryId: number | null): Draft {
  return {
    name: "", description: "", price: "", offer_price: "", stock: "",
    sku: "", delivery_time: "", status: "active",
    vendor_category_id: defaultCategoryId,
    category_id: null,
    image: null,
    attributes: {},
    variant_types: [],
    combos: [],
    variant_images: {},
  };
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VendorProduct | null>(null);
  const [rowBusy, setRowBusy] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importSearch, setImportSearch] = useState("");

  useEffect(() => {
    void (async () => {
      // 1. Logged-in vendor's vendor_category (auto — no dropdown shown).
      const vc = await api.get("/vendor/me/category")
        .then((res) => (res.data.data?.category ?? null) as VendorCategoryFull | null)
        .catch(() => mock.currentVendorCategory());
      setVendorCategory(vc);

      // 2. Their products.
      const products = await api.get("/vendor/products")
        .then((res) => {
          const items = res.data.data?.items;
          return Array.isArray(items) ? (items as VendorProduct[]) : [];
        })
        .catch(() => mock.vendorProducts());
      setItems(Array.isArray(products) ? products : []);

      // 3. Product categories filtered to this vendor's vendor_category.
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
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => items.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (status !== "all" && p.status !== status) return false;
    return true;
  }), [items, search, status]);

  const totalStock = items.reduce((s, p) => s + p.stock, 0);
  const totalValue = items.reduce((s, p) => s + p.price * p.stock, 0);
  const activeCount = items.filter((p) => p.status === "active").length;

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

  function startEdit(p: VendorProduct) {
    setEditing({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      price: String(p.price),
      offer_price: p.offer_price != null ? String(p.offer_price) : "",
      stock: String(p.stock),
      sku: p.sku ?? "",
      delivery_time: p.delivery_time ?? "",
      status: p.status,
      vendor_category_id: p.vendor_category_id ?? vendorCategory?.id ?? null,
      category_id: (p as VendorProduct & { category_id?: number | null }).category_id ?? null,
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
    });
  }

  /** Import all fields from an existing product into a new draft (no id, stock reset to 0). */
  function importFromProduct(p: VendorProduct) {
    setEditing({
      // no `id` — creates a new product on save
      name: p.name,
      description: p.description ?? "",
      price: String(p.price),
      offer_price: p.offer_price != null ? String(p.offer_price) : "",
      stock: "0", // reset
      sku: p.sku ?? "",
      delivery_time: p.delivery_time ?? "",
      status: "active",
      vendor_category_id: p.vendor_category_id ?? vendorCategory?.id ?? null,
      category_id: (p as VendorProduct & { category_id?: number | null }).category_id ?? null,
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
    });
    setImportOpen(false);
    setImportSearch("");
    toast.success(`Imported from ${p.name} — set new stock & save`);
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
    if (editing.offer_price)   payload.offer_price = Number(editing.offer_price);
    if (editing.sku)           payload.sku = editing.sku;
    if (editing.delivery_time) payload.delivery_time = editing.delivery_time;

    try {
      if (editing.id) {
        await api.patch(`/vendor/products/${editing.id}`, payload);
        toast.success("Product updated");
      } else {
        await api.post("/vendor/products", payload);
        toast.success("Product added");
      }
      setEditing(null);
      // Reload list from API to pick up server-side state
      try {
        const res = await api.get("/vendor/products");
        setItems((res.data.data?.items ?? []) as VendorProduct[]);
      } catch { /* keep current items if reload fails */ }
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
            <GradientButton onClick={startNew}>
              <Plus className="h-4 w-4" /> New product
            </GradientButton>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total products"  value={items.length} icon={Package} tone="brand"   spark={[2, 2, 3, 3, 3, 3, 3, 3]} />
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

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[1.4fr_140px_120px_120px_120px_56px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Product</span>
            <span>Category</span>
            <span>Stock</span>
            <span>Price</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          {loading ? (
            <div className="p-3"><TableSkeleton rows={4} cols={6} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products match your filters"
              description="Adjust filters or list a new product."
              action={<GradientButton onClick={startNew}><Plus className="h-4 w-4" /> New product</GradientButton>}
            />
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[1.4fr_140px_120px_120px_120px_56px]"
                >
                  <div className="flex items-center gap-3">
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
              <Select
                value={editing?.category_id != null ? String(editing.category_id) : ""}
                onValueChange={(v) => v && setEditing((p) => {
                  if (!p) return p;
                  const newId = Number(v);
                  if (p.category_id === newId) return p;
                  return { ...p, category_id: newId, attributes: {} };
                })}
              >
                <SelectTrigger className="h-11 w-full rounded-xl bg-surface-2/60">
                  <SelectValue placeholder={productCategories.length === 0 ? "No categories available for your vendor category" : "Pick a category — Vegetables, Fruits, Rice…"}>
                    {(v: string | null) => {
                      if (!v) return null;
                      const cat = productCategories.find((c) => String(c.id) === v);
                      return cat ? cat.name : null;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {productCategories.length === 0 ? (
                    <SelectItem value="__empty" disabled>No categories — ask admin to link some to {vendorCategory?.name ?? "your vendor category"}</SelectItem>
                  ) : productCategories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Only categories linked to your <span className="font-medium text-foreground">{vendorCategory?.name ?? "vendor category"}</span> appear here.</p>
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
                  <Label>Offer price (₹)</Label>
                  <Input type="number" value={editing?.offer_price ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, offer_price: e.target.value }))} placeholder="Optional" className="h-11 rounded-xl bg-surface-2/60" />
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
        <p className="text-[11px] text-muted-foreground">Upload images per option (e.g. Black gets black-front/back). The customer page swaps the gallery when this axis option is picked. Optional — combinations use the product image otherwise.</p>
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
                              <img src={src} alt={`${t.name} ${opt} ${idx + 1}`} className="h-full w-full object-cover" />
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
                                const newDataUrls = await Promise.all(files.map(readAsDataUrl));
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
