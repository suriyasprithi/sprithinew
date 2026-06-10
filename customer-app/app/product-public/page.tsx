"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Filter, Loader2, Minus, Plus, ShoppingCart, X } from "lucide-react";
import { toast } from "sonner";
import { TopInfoBar } from "@/components/marketplace/top-info-bar";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { ProductImage } from "@/components/ui/custom/product-image";
import { ProductCard, ProductCardSkeleton, type MarketplaceProduct } from "@/components/marketplace/product-card";
import { api, apiErrorMessage } from "@/lib/api";
import { cartBadge } from "@/lib/cart";
import { useAuth } from "@/stores/auth";
import { cn } from "@/lib/utils";

type AttrValue = string | number | boolean | string[] | null;
type Product = {
  id: number; name: string; description: string | null; price: number; stock: number;
  image: string | null; vendor_name: string | null; category_name: string | null;
  category_id: number | null;
  has_variants: boolean;
  attributes?: Record<string, AttrValue> | null;
};
type Variant = {
  id: number; name: string; price: number; stock: number;
  sku?: string | null;
  options?: Record<string, string>;
};
type VType = { name: string; options: string[] };
type VariantImages = Record<string, Record<string, string[]>>;
type Category = { id: number; name: string; vendor_category_id?: number | null };
type VendorCategory = { id: number; name: string };

function matchVariant(variants: Variant[], picks: Record<string, string>): Variant | undefined {
  return variants.find((v) => {
    const opts = v.options ?? {};
    for (const k of Object.keys(picks)) {
      if (opts[k] !== picks[k]) return false;
    }
    return Object.keys(opts).length === Object.keys(picks).length;
  });
}

function isOptionAvailable(variants: Variant[], _picks: Record<string, string>, axis: string, value: string): boolean {
  // Enable a chip if ANY variant carries that axis-value pair with stock left.
  // Sparse-variant products (e.g. only 3 of N possible combos) used to grey
  // most chips out because we required full multi-axis match; now the picker
  // snaps to the best matching variant on click instead (see pickValue).
  return variants.some((v) => {
    if ((v.stock ?? 0) <= 0) return false;
    return (v.options ?? {})[axis] === value;
  });
}

/**
 * Snap the entire pick-set to the best variant that contains axis=value.
 * "Best" = maximally agrees with the user's current picks (counts the other
 * axes that already match). Ties broken by stock and then by listing order.
 */
function pickValue(
  variants: Variant[],
  picks: Record<string, string>,
  axis: string,
  value: string,
): Record<string, string> {
  const candidates = variants
    .filter((v) => (v.options ?? {})[axis] === value && (v.stock ?? 0) > 0)
    .map((v) => {
      const opts = v.options ?? {};
      let score = 0;
      for (const k of Object.keys(picks)) {
        if (k !== axis && opts[k] === picks[k]) score++;
      }
      return { v, score };
    })
    .sort((a, b) => b.score - a.score || (b.v.stock ?? 0) - (a.v.stock ?? 0));
  if (candidates.length === 0) return { ...picks, [axis]: value };
  return { ...(candidates[0].v.options ?? {}) };
}
type ApiProduct = {
  id: number; name: string; price: number | string; image: string | null;
  stock: number; category_id: number | null; vendor_name?: string | null;
  has_variants?: boolean; default_variant_id?: number | null;
};
type AttributeField = {
  key: string; label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "toggle" | "image" | "color";
  unit?: string; options?: string[]; required?: boolean; placeholder?: string;
};

type FilterState = {
  category_id: number | null;
  price_min: string;
  price_max: string;
  in_stock: boolean;
};

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function adaptRelated(raw: ApiProduct): MarketplaceProduct {
  return {
    id: Number(raw.id),
    name: raw.name,
    price: Number(raw.price),
    image: raw.image,
    vendor_name: raw.vendor_name ?? null,
    stock: raw.stock,
    has_variants: !!raw.has_variants,
    default_variant_id: raw.default_variant_id ?? null,
  };
}

function readFilters(sp: URLSearchParams | null): Partial<FilterState> {
  if (!sp) return {};
  const catRaw = sp.get("category_id");
  return {
    category_id: catRaw ? Number(catRaw) : undefined,
    price_min: sp.get("price_min") ?? "",
    price_max: sp.get("price_max") ?? "",
    in_stock: sp.get("in_stock") === "1",
  };
}

/* ---------- Reusable accordion section ---------- */
function FilterSection({
  title, children, defaultOpen = true, count,
}: { title: string; children: React.ReactNode; defaultOpen?: boolean; count?: number }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--mk-border)] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold text-[var(--mk-text)] hover:bg-[var(--mk-brand-soft)]/40"
      >
        <span className="flex items-center gap-2">
          {title}
          {count != null && <span className="rounded-full bg-[var(--mk-surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--mk-text-muted)]">{count}</span>}
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open ? "rotate-180" : "")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- The filter panel (used in both sidebar + mobile drawer) ---------- */
/* ---------- Hierarchy: Vendor Category → Product Categories ---------- */
function CategoryTree({
  categories, vendorCategories, counts, activeId, onCategoryClick,
}: {
  categories: Category[];
  vendorCategories: VendorCategory[];
  counts: Map<number, number>;
  activeId: number | null;
  onCategoryClick: (id: number) => void;
}) {
  // Group product categories by their parent vendor_category_id.
  const grouped = useMemo(() => {
    const m = new Map<number, Category[]>();
    const orphans: Category[] = [];
    for (const c of categories) {
      const vcid = c.vendor_category_id ?? 0;
      if (vcid > 0) {
        if (!m.has(vcid)) m.set(vcid, []);
        m.get(vcid)!.push(c);
      } else {
        orphans.push(c);
      }
    }
    return { m, orphans };
  }, [categories]);

  // Default-open the vendor category whose subtree contains the active selection.
  const initiallyOpen = useMemo(() => {
    const set = new Set<number>();
    if (activeId == null) {
      // No selection — open the first vendor category that actually has children, so the user sees something.
      for (const vc of vendorCategories) {
        if ((grouped.m.get(vc.id)?.length ?? 0) > 0) { set.add(vc.id); break; }
      }
    } else {
      const parent = categories.find((c) => c.id === activeId)?.vendor_category_id;
      if (parent) set.add(parent);
    }
    return set;
  }, [activeId, categories, vendorCategories, grouped]);

  const [open, setOpen] = useState<Set<number>>(initiallyOpen);
  // If the active selection moves to a different subtree, expand its parent.
  useEffect(() => {
    if (activeId == null) return;
    const parent = categories.find((c) => c.id === activeId)?.vendor_category_id;
    if (parent && !open.has(parent)) {
      setOpen((s) => new Set(s).add(parent));
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [activeId, categories]);

  function toggle(vcid: number) {
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(vcid)) next.delete(vcid); else next.add(vcid);
      return next;
    });
  }

  return (
    <div className="space-y-0.5">
      {vendorCategories.map((vc) => {
        const kids = grouped.m.get(vc.id) ?? [];
        if (kids.length === 0) return null;
        const isOpen = open.has(vc.id);
        const totalCount = kids.reduce((s, k) => s + (counts.get(k.id) ?? 0), 0);
        return (
          <div key={vc.id}>
            <button
              type="button"
              onClick={() => toggle(vc.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm font-semibold text-[var(--mk-text)] transition-colors hover:bg-[var(--mk-brand-soft)]/60"
            >
              <span className="flex items-center gap-1.5 truncate">
                <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", isOpen ? "" : "-rotate-90")} />
                <span className="truncate">{vc.name}</span>
              </span>
              {totalCount > 0 && <span className="ml-2 shrink-0 text-[10px] text-[var(--mk-text-muted)]">({totalCount})</span>}
            </button>
            {isOpen && (
              <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-[var(--mk-border)] pl-2">
                {kids.map((c) => {
                  const active = c.id === activeId;
                  const cnt = counts.get(c.id) ?? 0;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => onCategoryClick(c.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm transition-colors",
                          active
                            ? "bg-[var(--mk-brand-soft)] font-semibold text-[var(--mk-brand-deep)]"
                            : "text-[var(--mk-text)] hover:bg-[var(--mk-brand-soft)]/60 hover:text-[var(--mk-brand-deep)]",
                        )}
                      >
                        <span className="truncate">{c.name}</span>
                        {cnt > 0 && <span className="ml-2 shrink-0 text-[10px] text-[var(--mk-text-muted)]">({cnt})</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}

      {grouped.orphans.length > 0 && (
        <div>
          <p className="px-2 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--mk-text-muted)]">Unlinked</p>
          <ul className="space-y-0.5">
            {grouped.orphans.map((c) => {
              const active = c.id === activeId;
              const cnt = counts.get(c.id) ?? 0;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onCategoryClick(c.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm transition-colors",
                      active
                        ? "bg-[var(--mk-brand-soft)] font-semibold text-[var(--mk-brand-deep)]"
                        : "text-[var(--mk-text)] hover:bg-[var(--mk-brand-soft)]/60 hover:text-[var(--mk-brand-deep)]",
                    )}
                  >
                    <span className="truncate">{c.name}</span>
                    {cnt > 0 && <span className="ml-2 shrink-0 text-[10px] text-[var(--mk-text-muted)]">({cnt})</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function FilterPanel({
  categories, vendorCategories, counts, filters, setFilters, onCategoryClick,
}: {
  categories: Category[];
  vendorCategories: VendorCategory[];
  counts: Map<number, number>;
  filters: FilterState;
  setFilters: (next: FilterState) => void;
  onCategoryClick: (id: number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] shadow-[var(--mk-shadow-sm)]">
      <FilterSection title="Categories" count={categories.length}>
        {categories.length === 0 ? (
          <p className="text-xs text-[var(--mk-text-muted)]">No categories</p>
        ) : (
          <CategoryTree
            categories={categories}
            vendorCategories={vendorCategories}
            counts={counts}
            activeId={filters.category_id}
            onCategoryClick={onCategoryClick}
          />
        )}
      </FilterSection>

      <FilterSection title="Price">
        <div className="flex items-center gap-2">
          <input
            inputMode="numeric"
            placeholder="Min"
            value={filters.price_min}
            onChange={(e) => setFilters({ ...filters, price_min: e.target.value.replace(/\D/g, "") })}
            className="h-9 w-full rounded-md border border-[var(--mk-border)] bg-[var(--mk-surface-2)] px-2 text-sm outline-none focus:border-[var(--mk-brand)]"
          />
          <span className="text-xs text-[var(--mk-text-muted)]">–</span>
          <input
            inputMode="numeric"
            placeholder="Max"
            value={filters.price_max}
            onChange={(e) => setFilters({ ...filters, price_max: e.target.value.replace(/\D/g, "") })}
            className="h-9 w-full rounded-md border border-[var(--mk-border)] bg-[var(--mk-surface-2)] px-2 text-sm outline-none focus:border-[var(--mk-brand)]"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            { label: "< ₹500", min: "", max: "500" },
            { label: "₹500–2k", min: "500", max: "2000" },
            { label: "₹2k–10k", min: "2000", max: "10000" },
            { label: "₹10k+", min: "10000", max: "" },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setFilters({ ...filters, price_min: p.min, price_max: p.max })}
              className="rounded-full border border-[var(--mk-border)] bg-[var(--mk-surface-2)] px-2 py-0.5 text-[10px] text-[var(--mk-text)] transition-colors hover:border-[var(--mk-brand)] hover:text-[var(--mk-brand-deep)]"
            >
              {p.label}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Availability">
        <label className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--mk-brand-soft)]/40">
          <input
            type="checkbox"
            checked={filters.in_stock}
            onChange={(e) => setFilters({ ...filters, in_stock: e.target.checked })}
            className="h-4 w-4 cursor-pointer accent-[var(--mk-brand)]"
          />
          <span>In stock only</span>
        </label>
      </FilterSection>
    </div>
  );
}

/* ---------- Active filter chips strip ---------- */
function ActiveFilters({
  filters, categoryName, onClear, onRemove,
}: {
  filters: FilterState;
  categoryName?: string;
  onClear: () => void;
  onRemove: (key: keyof FilterState) => void;
}) {
  const chips: Array<{ key: keyof FilterState; label: string }> = [];
  if (filters.category_id && categoryName) chips.push({ key: "category_id", label: categoryName });
  if (filters.price_min || filters.price_max) {
    chips.push({
      key: "price_min",
      label: `${filters.price_min ? `₹${filters.price_min}` : "₹0"}–${filters.price_max ? `₹${filters.price_max}` : "∞"}`,
    });
  }
  if (filters.in_stock) chips.push({ key: "in_stock", label: "In stock" });

  if (chips.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <span key={String(c.key) + c.label} className="inline-flex items-center gap-1 rounded-full bg-[var(--mk-brand-soft)] px-2.5 py-1 text-xs font-medium text-[var(--mk-brand-deep)]">
          {c.label}
          <button type="button" onClick={() => onRemove(c.key)} aria-label={`Remove ${c.label}`} className="rounded-full hover:bg-[var(--mk-brand)]/20">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="text-xs font-semibold text-[var(--mk-text-muted)] underline-offset-2 hover:text-[var(--mk-brand-deep)] hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}

function ProductInner() {
  const search = useSearchParams();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const isHydrated = useAuth((s) => s.isHydrated);
  const id = Number(search.get("id") || 0);

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantTypes, setVariantTypes] = useState<VType[]>([]);
  const [variantImages, setVariantImages] = useState<VariantImages>({});
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [imgIndex, setImgIndex] = useState(0);
  const [schema, setSchema] = useState<AttributeField[]>([]);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [vendorCategories, setVendorCategories] = useState<VendorCategory[]>([]);
  const [related, setRelated] = useState<MarketplaceProduct[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const initial = readFilters(search);
  const [filters, setFilters] = useState<FilterState>({
    category_id: initial.category_id ?? null,
    price_min: initial.price_min ?? "",
    price_max: initial.price_max ?? "",
    in_stock: initial.in_stock ?? false,
  });

  /* Load main product */
  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const res = await api.get(`/public/products/${id}`);
        const p = res.data.data?.item as Product;
        const vs = (res.data.data?.variants ?? []) as Variant[];
        const vt = (res.data.data?.variant_types ?? []) as VType[];
        const vi = (res.data.data?.variant_images ?? {}) as VariantImages;
        const sc = (res.data.data?.attribute_schema ?? []) as AttributeField[];
        if (!p) { toast.error("Not found"); router.replace("/shop-public"); return; }
        setProduct(p); setVariants(vs); setVariantTypes(vt); setVariantImages(vi); setSchema(sc);
        const seed = vs.find((v) => (v.stock ?? 0) > 0) ?? vs[0];
        if (seed?.options) setPicks({ ...seed.options });
        const cid = p.category_id != null ? Number(p.category_id) : null;
        setFilters((f) => ({ ...f, category_id: Number.isFinite(cid) ? cid : null }));
      } catch (e) {
        toast.error(apiErrorMessage(e));
        router.replace("/shop-public");
      } finally { setLoading(false); }
    })();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [id, router]);

  /* Load categories + vendor categories once */
  useEffect(() => {
    void (async () => {
      try {
        const r = await api.get("/public/products");
        const raw = (r.data.data?.categories ?? []) as Array<{ id: number | string; name: string; vendor_category_id?: number | string | null }>;
        setCategories(raw.map((c) => ({
          id: Number(c.id),
          name: c.name,
          vendor_category_id: c.vendor_category_id != null && c.vendor_category_id !== "" ? Number(c.vendor_category_id) : null,
        })));
      } catch { /* non-critical */ }
    })();
    void (async () => {
      try {
        const r = await api.get("/vendor-categories");
        const raw = (r.data?.data?.items ?? []) as Array<{ id: number | string; name: string }>;
        setVendorCategories(raw.map((v) => ({ id: Number(v.id), name: v.name })));
      } catch { /* non-critical */ }
    })();
  }, []);

  /* Debounced fetch of related products on filter change */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!product) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setRelatedLoading(true);
      const params: Record<string, string> = {};
      if (filters.category_id) params.category_id = String(filters.category_id);
      if (filters.price_min)   params.price_min   = filters.price_min;
      if (filters.price_max)   params.price_max   = filters.price_max;
      if (filters.in_stock)    params.in_stock    = "1";
      void api.get("/public/products", { params })
        .then((r) => {
          const raws = (r.data.data?.items ?? []) as ApiProduct[];
          setRelated(raws.filter((x) => x.id !== product.id).slice(0, 12).map(adaptRelated));
        })
        .catch(() => setRelated([]))
        .finally(() => setRelatedLoading(false));
    }, 320);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [filters, product]);

  /* URL sync (replace, not push — avoids clogging history) */
  useEffect(() => {
    if (!id) return;
    const sp = new URLSearchParams();
    sp.set("id", String(id));
    if (filters.category_id) sp.set("category_id", String(filters.category_id));
    if (filters.price_min)   sp.set("price_min",   filters.price_min);
    if (filters.price_max)   sp.set("price_max",   filters.price_max);
    if (filters.in_stock)    sp.set("in_stock",    "1");
    router.replace(`/product-public?${sp.toString()}`, { scroll: false });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [filters]);

  /* Per-category counts from the current related result set */
  const counts = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of related) {
      const cid = Number((r as unknown as { category_id?: number }).category_id ?? 0);
      if (cid) m.set(cid, (m.get(cid) ?? 0) + 1);
    }
    return m;
  }, [related]);

  useEffect(() => { setImgIndex(0); }, [picks]);

  const selectedVariant = variantTypes.length > 0 ? matchVariant(variants, picks) : undefined;
  const price = selectedVariant?.price ?? product?.price ?? 0;
  const stock = selectedVariant?.stock ?? product?.stock ?? 0;
  const selectedCatName = categories.find((c) => c.id === filters.category_id)?.name;

  const clearAll = useCallback(() => {
    setFilters({ category_id: null, price_min: "", price_max: "", in_stock: false });
  }, []);

  const handleCategoryClick = useCallback((cid: number) => {
    setFilters((f) => ({ ...f, category_id: cid }));
    setMobileFilterOpen(false);
  }, []);

  const removeFilter = useCallback((key: keyof FilterState) => {
    setFilters((f) => {
      const next = { ...f };
      if (key === "category_id") next.category_id = null;
      else if (key === "price_min" || key === "price_max") { next.price_min = ""; next.price_max = ""; }
      else if (key === "in_stock") next.in_stock = false;
      return next;
    });
  }, []);

  async function add() {
    if (!product) return;
    if (variantTypes.length > 0 && !selectedVariant) {
      toast.error("Pick all variant options first");
      return;
    }
    // Not signed in → bounce to /login with returnTo so they come back to this product.
    if (isHydrated && !user) {
      toast.message("Sign in to add items to your cart");
      router.push(`/login?returnTo=${encodeURIComponent(`/product-public?id=${product.id}`)}`);
      return;
    }
    try {
      await api.post("/cart/add", { product_id: product.id, variation_id: selectedVariant?.id ?? undefined, qty });
      cartBadge.bump(qty);
      toast.success("Added to cart");
      router.push("/cart");
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        toast.message("Sign in to add items to your cart");
        router.push(`/login?returnTo=${encodeURIComponent(`/product-public?id=${product.id}`)}`);
        return;
      }
      toast.error(apiErrorMessage(e));
    }
  }

  const hasAnyFilter = !!(filters.category_id || filters.price_min || filters.price_max || filters.in_stock);

  return (
    <div className="marketplace-theme min-h-screen">
      <TopInfoBar />
      <MarketplaceHeader />

      {loading ? (
        <section className="mx-auto flex max-w-md items-center justify-center p-8 text-sm text-[var(--mk-text-muted)]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </section>
      ) : !product ? null : (() => {
        const attrs = (product.attributes ?? {}) as Record<string, AttrValue>;
        const knownKeys = new Set(schema.map((f) => f.key));
        const hasValue = (v: AttrValue) =>
          v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
        const orderedEntries: Array<{ field?: AttributeField; key: string; value: AttrValue }> = [
          ...schema
            .filter((f) => hasValue(attrs[f.key]))
            .map((f) => ({ field: f, key: f.key, value: attrs[f.key] })),
          ...Object.entries(attrs)
            .filter(([k, v]) => !knownKeys.has(k) && hasValue(v))
            .map(([k, v]) => ({ key: k, value: v })),
        ];
        const imageEntries  = orderedEntries.filter((e) => e.field?.type === "image" && typeof e.value === "string");
        const detailEntries = orderedEntries.filter((e) => e.field?.type !== "image");

        let variantGallery: string[] = [];
        for (const t of variantTypes) {
          const opt = picks[t.name];
          if (!opt) continue;
          const list = variantImages[t.name]?.[opt];
          if (list && list.length) { variantGallery = list; break; }
        }
        const heroSrc = variantGallery.length > 0
          ? (variantGallery[Math.min(imgIndex, variantGallery.length - 1)] ?? variantGallery[0])
          : product.image;

        return (
          <section className="mx-auto max-w-7xl p-4 pb-24 md:p-8">
            <div className="grid gap-6 md:grid-cols-[260px_1fr]">
              {/* Filter sidebar (desktop) */}
              <aside className="hidden md:block">
                <div className="sticky top-4">
                  <FilterPanel categories={categories} vendorCategories={vendorCategories} counts={counts} filters={filters} setFilters={setFilters} onCategoryClick={handleCategoryClick} />
                </div>
              </aside>

              {/* Main column */}
              <div className="space-y-5">
                {(() => {
                  const productCatId = product.category_id != null ? Number(product.category_id) : null;
                  const browseMode = filters.category_id != null && productCatId !== null && filters.category_id !== productCatId;
                  if (browseMode) return null;
                  return (
                    <>
                      {/* Image left | Details right on md+ */}
                      <div className="grid gap-5 md:grid-cols-2">
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                          <LuxuryCard hoverLift={false} className="overflow-hidden">
                            <div className="aspect-square overflow-hidden rounded-xl">
                              <ProductImage src={heroSrc} alt={product.name} />
                            </div>
                          </LuxuryCard>
                          {variantGallery.length > 1 && (
                            <div className="mt-2 flex gap-2 overflow-x-auto">
                              {variantGallery.map((src, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setImgIndex(i)}
                                  className={cn(
                                    "h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                                    i === Math.min(imgIndex, variantGallery.length - 1) ? "border-brand" : "border-border",
                                  )}
                                >
                                  <img src={src} alt={`Thumbnail ${i + 1}`} className="h-full w-full object-cover" />
                                </button>
                              ))}
                            </div>
                          )}
                        </motion.div>

                        <div className="space-y-4">
                          <div>
                            <h2 className="text-2xl font-bold tracking-tight">{product.name}</h2>
                            {(product.vendor_name || product.category_name) && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {product.vendor_name}{product.vendor_name && product.category_name ? " · " : ""}{product.category_name}
                              </p>
                            )}
                            <p className="mt-3 text-3xl font-bold text-brand">{fmtINR(price)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Stock: {stock}</p>
                          </div>

                          {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}

                          {variantTypes.length > 0 && variantTypes.map((t) => (
                            <div key={t.name}>
                              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{t.name}</p>
                              <div className="flex flex-wrap gap-2">
                                {t.options.map((opt) => {
                                  const isPicked = picks[t.name] === opt;
                                  const available = isOptionAvailable(variants, picks, t.name, opt);
                                  return (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => setPicks((p) => pickValue(variants, p, t.name, opt))}
                                      disabled={!available && !isPicked}
                                      className={cn(
                                        "rounded-full border px-3 py-1.5 text-sm transition-colors",
                                        isPicked
                                          ? "border-brand bg-brand/10 text-brand brand-glow"
                                          : available
                                            ? "border-border bg-surface hover:border-brand/40"
                                            : "cursor-not-allowed border-border bg-surface text-muted-foreground line-through opacity-50",
                                      )}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}

                          {variantTypes.length > 0 && selectedVariant?.sku && (
                            <p className="text-[11px] text-muted-foreground">
                              SKU: <span className="font-mono">{selectedVariant.sku}</span>
                            </p>
                          )}

                          <div className="flex items-center gap-3 pt-1">
                            <div className="flex items-center rounded-xl border border-border bg-surface-2/40">
                              <button className="px-3 py-2 text-lg hover:text-brand" onClick={() => setQty(Math.max(1, qty - 1))}><Minus className="h-4 w-4" /></button>
                              <span className="px-3 font-medium">{qty}</span>
                              <button className="px-3 py-2 text-lg hover:text-brand" onClick={() => setQty(Math.min(stock, qty + 1))}><Plus className="h-4 w-4" /></button>
                            </div>
                            <GradientButton size="lg" className="flex-1" disabled={stock === 0 || (variantTypes.length > 0 && !selectedVariant)} onClick={() => void add()}>
                              <ShoppingCart className="h-4 w-4" /> {stock === 0 ? "Out of stock" : `Add · ${fmtINR(price * qty)}`}
                            </GradientButton>
                          </div>
                        </div>
                      </div>

                      {imageEntries.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Gallery</p>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {imageEntries.map((e) => (
                              <LuxuryCard key={e.key} hoverLift={false} className="overflow-hidden">
                                <div className="aspect-square">
                                  <img src={String(e.value)} alt={e.field?.label ?? e.key} className="h-full w-full object-cover" />
                                </div>
                                {e.field?.label && <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{e.field.label}</p>}
                              </LuxuryCard>
                            ))}
                          </div>
                        </div>
                      )}

                      {detailEntries.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Specifications</p>
                          <LuxuryCard hoverLift={false} className="divide-y divide-border text-sm">
                            {detailEntries.map((e) => {
                              const label = e.field?.label ?? e.key;
                              let display: string;
                              if (Array.isArray(e.value)) display = e.value.join(", ");
                              else if (e.field?.type === "toggle") display = e.value ? "Yes" : "No";
                              else if (e.field?.type === "number" && e.field.unit) display = `${e.value} ${e.field.unit}`;
                              else display = String(e.value);
                              return (
                                <div key={e.key} className="flex items-start justify-between gap-3 px-4 py-2.5">
                                  <span className="text-muted-foreground">{label}</span>
                                  <span className="text-right font-medium">{display}</span>
                                </div>
                              );
                            })}
                          </LuxuryCard>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Related products */}
                <div className="pt-4">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <h3 className="text-lg font-bold tracking-tight">
                      {selectedCatName ? `More in ${selectedCatName}` : "Related products"}
                    </h3>
                  </div>

                  <ActiveFilters
                    filters={filters}
                    categoryName={selectedCatName}
                    onClear={clearAll}
                    onRemove={removeFilter}
                  />

                  {relatedLoading ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)}
                    </div>
                  ) : related.length === 0 ? (
                    <p className="text-sm text-[var(--mk-text-muted)]">No products match your filters.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {related.map((p) => <ProductCard key={p.id} product={p} />)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile filter FAB + bottom sheet */}
            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              aria-label="Open filters"
              className="fixed bottom-6 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-[var(--mk-brand)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[var(--mk-brand)]/30 md:hidden"
            >
              <Filter className="h-4 w-4" /> Filters
              {hasAnyFilter && <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-[var(--mk-brand)]">•</span>}
            </button>

            <AnimatePresence>
              {mobileFilterOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => setMobileFilterOpen(false)}
                    className="fixed inset-0 z-40 bg-black/40 md:hidden"
                  />
                  <motion.div
                    initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 28, stiffness: 280 }}
                    className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl bg-[var(--mk-surface)] shadow-2xl md:hidden"
                  >
                    <div className="flex items-center justify-between border-b border-[var(--mk-border)] px-4 py-3">
                      <p className="text-base font-bold">Filters</p>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={clearAll} className="text-xs font-semibold text-[var(--mk-text-muted)] hover:text-[var(--mk-brand-deep)]">Clear all</button>
                        <button type="button" onClick={() => setMobileFilterOpen(false)} aria-label="Close" className="rounded-md p-1 hover:bg-[var(--mk-surface-2)]"><X className="h-5 w-5" /></button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3">
                      <FilterPanel categories={categories} vendorCategories={vendorCategories} counts={counts} filters={filters} setFilters={setFilters} onCategoryClick={handleCategoryClick} />
                    </div>
                    <div className="border-t border-[var(--mk-border)] bg-[var(--mk-surface)] p-3">
                      <button
                        type="button"
                        onClick={() => setMobileFilterOpen(false)}
                        className="w-full rounded-xl bg-[var(--mk-brand)] py-3 text-sm font-bold text-white shadow-sm hover:bg-[var(--mk-brand-deep)]"
                      >
                        Apply filters
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </section>
        );
      })()}

      <MarketplaceFooter />
    </div>
  );
}

export default function PublicProductPage() {
  return <Suspense fallback={null}><ProductInner /></Suspense>;
}
