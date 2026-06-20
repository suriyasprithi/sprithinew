"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Filter, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { TopInfoBar } from "@/components/marketplace/top-info-bar";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { CategoryNavBar } from "@/components/marketplace/category-nav-bar";
import { CouponBanner } from "@/components/marketplace/coupon-banner";
import { ProductCard, ProductCardSkeleton, type MarketplaceProduct } from "@/components/marketplace/product-card";
import { FloatingActions } from "@/components/marketplace/floating-actions";
import { MarketplaceBottomNav } from "@/components/marketplace/mobile-bottom-nav";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { api, apiErrorMessage } from "@/lib/api";
import { readSavedLocation } from "@/components/marketplace/location-picker";

type ApiProduct = {
  id: number; name: string; price: number | string; old_price?: number | string | null; image: string | null;
  stock: number; category_id: number | null; vendor_name?: string | null;
  has_variants?: boolean;
  default_variant_id?: number | null;
};
type Category = { id: number; name: string };
type VendorCategory = { id: number; name: string };
type Vendor = { id: number; name: string; shop_name?: string | null };

function adapt(raw: ApiProduct): MarketplaceProduct {
  return {
    id: Number(raw.id),
    name: raw.name,
    price: Number(raw.price),
    old_price: raw.old_price != null ? Number(raw.old_price) : undefined,
    image: raw.image,
    vendor_name: raw.vendor_name ?? null,
    stock: raw.stock,
    has_variants: !!raw.has_variants,
    default_variant_id: raw.default_variant_id ?? null,
  };
}

export default function PublicShopPage() {
  return (
    <Suspense fallback={<div className="marketplace-theme flex min-h-screen items-center justify-center text-sm text-[var(--mk-text-muted)]">Loading…</div>}>
      <PublicShopInner />
    </Suspense>
  );
}

function PublicShopInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [items, setItems] = useState<MarketplaceProduct[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [vcats, setVcats] = useState<VendorCategory[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  // catId is derived from the URL so the dropdown <Link> clicks (which only
  // change the query string) actually re-filter the products.
  const catId = sp?.get("category_id") ? Number(sp.get("category_id")) : null;
  const [pincode, setPincode] = useState(sp?.get("pincode") ?? "");
  const [q, setQ] = useState(sp?.get("q") ?? "");
  const [loading, setLoading] = useState(true);

  // The tab row uses the vendor-category taxonomy (same as "Shop by Category"
  // and Featured Categories), so the tab you arrived from stays highlighted.
  function setVendorCategory(id: number | null) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    if (id === null) params.delete("vendor_category_id");
    else params.set("vendor_category_id", String(id));
    const qs = params.toString();
    router.push(`/shop-public${qs ? `?${qs}` : ""}`);
  }

  // Scope products to one shop via ?vendor_id=N (vendor pill click).
  function setVendor(id: number | null) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    if (id === null) params.delete("vendor_id");
    else params.set("vendor_id", String(id));
    const qs = params.toString();
    router.push(`/shop-public${qs ? `?${qs}` : ""}`);
  }

  // Vendor scope from ?vendor_id=N — vendor click on home jumps here. Name is
  // derived from the first product's vendor_name (no separate API call needed).
  const vendorId = sp?.get("vendor_id") ? Number(sp.get("vendor_id")) : null;
  const vendorName = vendorId ? items.find((p) => p.vendor_name)?.vendor_name ?? null : null;
  // Geo filters from the location picker.
  const talukId    = sp?.get("taluk_id")    ? Number(sp.get("taluk_id"))    : null;
  const districtId = sp?.get("district_id") ? Number(sp.get("district_id")) : null;
  const stateId    = sp?.get("state_id")    ? Number(sp.get("state_id"))    : null;
  // Vendor-category scope (Featured Categories click).
  const vendorCategoryId = sp?.get("vendor_category_id") ? Number(sp.get("vendor_category_id")) : null;

  async function load(overrideQ?: string) {
    setLoading(true);
    try {
      const effectiveQ = overrideQ ?? q;
      const params: Record<string, string> = {};
      if (catId)             params.category_id        = String(catId);
      if (vendorCategoryId)  params.vendor_category_id = String(vendorCategoryId);
      if (vendorId)          params.vendor_id          = String(vendorId);
      if (effectiveQ)        params.q = effectiveQ;
      if (pincode)           params.pincode    = pincode;
      if (talukId)           params.taluk_id    = String(talukId);
      if (districtId)        params.district_id = String(districtId);
      if (stateId)           params.state_id    = String(stateId);
      const r = await api.get("/public/products", { params });
      const raws = (r.data.data?.items ?? []) as ApiProduct[];
      setItems(raws.map(adapt));
      setCats((r.data.data?.categories ?? []) as Category[]);
    } catch (err) { toast.error(apiErrorMessage(err)); }
    finally { setLoading(false); }
  }
  // Sync `q` from the URL whenever it changes (header search submits via
  // router.push, which updates ?q= without remounting this component).
  const urlQ = sp?.get("q") ?? "";
  useEffect(() => { setQ(urlQ); }, [urlQ]);
  useEffect(() => { void load(urlQ); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [catId, vendorId, vendorCategoryId, talukId, districtId, stateId, urlQ]);

  // Load the vendor-category tabs (location-scoped, same source as the nav bar).
  useEffect(() => {
    const fetchVcats = async () => {
      try {
        const loc = readSavedLocation();
        const params: Record<string, string> = {};
        if (loc?.taluk_id)         params.taluk_id    = String(loc.taluk_id);
        else if (loc?.district_id) params.district_id = String(loc.district_id);
        else if (loc?.state_id)    params.state_id    = String(loc.state_id);
        const res = await api.get("/vendor-categories", { params });
        setVcats((res.data.data?.items ?? []) as VendorCategory[]);
      } catch { setVcats([]); }
    };
    void fetchVcats();
    if (typeof window !== "undefined") {
      const onChange = () => { void fetchVcats(); };
      window.addEventListener("epey-location-changed", onChange);
      return () => window.removeEventListener("epey-location-changed", onChange);
    }
  }, []);

  // Load the shop (vendor) pills — same location scope as the category tabs.
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const loc = readSavedLocation();
        const params: Record<string, string> = {};
        if (loc?.taluk_id)         params.taluk_id    = String(loc.taluk_id);
        else if (loc?.district_id) params.district_id = String(loc.district_id);
        else if (loc?.state_id)    params.state_id    = String(loc.state_id);
        const res = await api.get("/public/vendors", { params });
        setVendors((res.data.data?.items ?? []) as Vendor[]);
      } catch { setVendors([]); }
    };
    void fetchVendors();
    if (typeof window !== "undefined") {
      const onChange = () => { void fetchVendors(); };
      window.addEventListener("epey-location-changed", onChange);
      return () => window.removeEventListener("epey-location-changed", onChange);
    }
  }, []);

  return (
    <div className="marketplace-theme min-h-screen pb-24 md:pb-0">
      <TopInfoBar />
      <MarketplaceHeader />
      <CategoryNavBar />
      <CouponBanner />

      {/* Filters */}
      <section className="mx-auto max-w-7xl px-4 pt-5">
        <div className="rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-3 shadow-[var(--mk-shadow-sm)]">
          <form onSubmit={(e) => { e.preventDefault(); void load(); }} className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--mk-text-muted)]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products or shops…"
                className="h-11 w-full rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface-2)] pl-9 pr-3 text-sm text-[var(--mk-text)] outline-none focus:border-[var(--mk-brand)]"
              />
            </div>
            <input
              value={pincode}
              inputMode="numeric"
              maxLength={6}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Pincode"
              className="h-11 w-36 rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface-2)] px-3 text-sm text-[var(--mk-text)] outline-none focus:border-[var(--mk-brand)]"
            />
            <button
              type="submit"
              className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[var(--mk-brand)] px-4 text-sm font-semibold text-white shadow-[var(--mk-shadow-sm)] transition-colors hover:bg-[var(--mk-brand-deep)]"
            >
              <Filter className="h-4 w-4" /> Filter
            </button>
          </form>
        </div>
      </section>

      {/* Category tabs (vendor categories — same taxonomy as Shop by Category) */}
      {vcats.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-4">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CategoryPill active={vendorCategoryId === null} onClick={() => setVendorCategory(null)}>All</CategoryPill>
            {vcats.map((c) => (
              <CategoryPill key={c.id} active={vendorCategoryId === c.id} onClick={() => setVendorCategory(c.id)}>{c.name}</CategoryPill>
            ))}
          </div>
        </section>
      )}

      {/* Shop (vendor) pills — pick a shop to see only its products */}
      {vendors.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--mk-text-muted)]">Shops</p>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CategoryPill active={vendorId === null} onClick={() => setVendor(null)}>All shops</CategoryPill>
            {vendors.map((v) => (
              <CategoryPill key={v.id} active={vendorId === v.id} onClick={() => setVendor(v.id)}>{v.shop_name || v.name}</CategoryPill>
            ))}
          </div>
        </section>
      )}

      {/* Header */}
      <section className="mx-auto max-w-7xl px-4 pt-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mk-text-muted)]">
              {vendorId ? "Vendor store" : "Shop"}
            </p>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">
              {vendorId
                ? (vendorName ?? "Vendor products")
                : vendorCategoryId
                  ? vcats.find((c) => c.id === vendorCategoryId)?.name ?? "Products"
                  : catId
                    ? cats.find((c) => c.id === catId)?.name ?? "Products"
                    : "All products"}
            </h1>
          </div>
          {!loading && (
            <p className="text-sm text-[var(--mk-text-muted)]">{items.length} item{items.length === 1 ? "" : "s"}</p>
          )}
        </div>
      </section>

      {/* Product grid */}
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--mk-border)] bg-[var(--mk-surface)] p-12 text-center">
            <Sparkles className="mx-auto mb-3 h-10 w-10 text-[var(--mk-brand)]" />
            <p className="text-sm font-semibold">No products match your filters</p>
            <p className="mt-1 text-xs text-[var(--mk-text-muted)]">Try a different search, pincode or category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      <MarketplaceFooter />
      <FloatingActions />
      <MarketplaceBottomNav />
    </div>
  );
}

function CategoryPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors " +
        (active
          ? "border-[var(--mk-brand)] bg-[var(--mk-brand)] text-white shadow-[var(--mk-shadow-sm)]"
          : "border-[var(--mk-border)] bg-[var(--mk-surface)] text-[var(--mk-text)] hover:border-[var(--mk-brand)]/40 hover:bg-[var(--mk-brand-soft)]")
      }
    >
      {children}
    </button>
  );
}
