"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Sparkles, Navigation } from "lucide-react";
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
import { getCustomerCoordsQuiet, readCustomerCoords, distanceToVendor, formatDistance, COORDS_EVENT, type Coords } from "@/lib/geo";

type ApiProduct = {
  id: number; name: string; price: number | string; old_price?: number | string | null; image: string | null;
  stock: number; category_id: number | null; category_name?: string | null;
  sub_category_id?: number | null; sub_category_name?: string | null;
  vendor_id?: number | string | null; vendor_name?: string | null;
  has_variants?: boolean;
  default_variant_id?: number | null;
  min_price?: number | string | null;
  max_price?: number | string | null;
  variant_axes?: { name: string; count: number; options?: string[] }[];
};
type Category = { id: number; name: string };
type VendorCategory = { id: number; name: string };

// Products fetched per scroll page (infinite scroll on the "All products" grid).
const PAGE_SIZE = 24;
type Vendor = { id: number; name: string; shop_name?: string | null; requires_prescription?: boolean; latitude?: number | null; longitude?: number | null };

function adapt(raw: ApiProduct): MarketplaceProduct {
  return {
    id: Number(raw.id),
    name: raw.name,
    price: Number(raw.price),
    old_price: raw.old_price != null ? Number(raw.old_price) : undefined,
    image: raw.image,
    vendor_id: raw.vendor_id != null ? Number(raw.vendor_id) : null,
    vendor_name: raw.vendor_name ?? null,
    stock: raw.stock,
    has_variants: !!raw.has_variants,
    default_variant_id: raw.default_variant_id ?? null,
    min_price: raw.min_price != null ? Number(raw.min_price) : undefined,
    max_price: raw.max_price != null ? Number(raw.max_price) : undefined,
    variant_axes: Array.isArray(raw.variant_axes) ? raw.variant_axes : undefined,
    category_id: raw.category_id != null ? Number(raw.category_id) : null,
    category_name: raw.category_name ?? null,
    sub_category_id: raw.sub_category_id != null ? Number(raw.sub_category_id) : null,
    sub_category_name: raw.sub_category_name ?? null,
  };
}

export default function PublicShopPage() {
  return (
    <Suspense fallback={<div className="marketplace-theme flex min-h-screen items-center justify-center text-sm text-[var(--mk-text-muted)]">Loading…</div>}>
      <ShopPublicGate />
    </Suspense>
  );
}

// Category / shop browsing now lives on the unified /browse page, so redirect
// those links there (vendor_category_id→vc, vendor_id→shop, q carried along).
// A bare page and global product search (?q only) keep the shop-public UI, since
// /browse searches within a single shop, not across all shops.
function ShopPublicGate() {
  const router = useRouter();
  const [render, setRender] = useState(false);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const vc = sp.get("vendor_category_id");
    const shop = sp.get("vendor_id");
    if (vc || shop) {
      const out = new URLSearchParams();
      if (vc) out.set("vc", vc);
      if (shop) out.set("shop", shop);
      const q = sp.get("q"); if (q) out.set("q", q);
      router.replace(`/browse?${out.toString()}`);
    } else {
      setRender(true);
    }
  }, [router]);
  if (!render) return <div className="marketplace-theme flex min-h-dvh items-center justify-center text-sm text-[var(--mk-text-muted)]">Opening…</div>;
  return <PublicShopInner />;
}

function PublicShopInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [items, setItems] = useState<MarketplaceProduct[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [vcats, setVcats] = useState<VendorCategory[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [coords, setCoords] = useState<Coords | null>(null);
  // Product-category filter tabs shown under the Shops row (derived from the
  // products in view); the active one filters the grid client-side.
  const [activeCat, setActiveCat] = useState<number | null>(null);
  // Infinite-scroll pagination state. `page` is the last page fetched.
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  // Guards against the IntersectionObserver firing loadMore twice before
  // `loadingMore` state has flushed; the ref flips synchronously.
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<() => void>(() => {});
  // catId is derived from the URL so the dropdown <Link> clicks (which only
  // change the query string) actually re-filter the products.
  const catId = sp?.get("category_id") ? Number(sp.get("category_id")) : null;
  // Pincode scoping still honoured from the URL (?pincode=) + saved location;
  // the manual pincode box was removed from the filter bar.
  const pincode = sp?.get("pincode") ?? "";
  const [q, setQ] = useState(sp?.get("q") ?? "");
  const [loading, setLoading] = useState(true);
  // Bumped when the saved delivery location changes, to re-scope the products.
  const [locVersion, setLocVersion] = useState(0);

  // The tab row uses the vendor-category taxonomy (same as "Shop by Category"
  // and Featured Categories), so the tab you arrived from stays highlighted.
  function setVendorCategory(id: number | null) {
    const params = new URLSearchParams(sp?.toString() ?? "");
    if (id === null) params.delete("vendor_category_id");
    else params.set("vendor_category_id", String(id));
    const qs = params.toString();
    router.push(`/shop-public${qs ? `?${qs}` : ""}`);
  }

  // Product click → open its detail INSIDE the unified /browse shop view (keeps
  // the shop's category rail). Opens the product's own shop so closing the detail
  // lands on that shop's grid; falls back to a shopless product view if unknown.
  function openInBrowse(id: number) {
    const p = items.find((x) => x.id === id);
    const out = new URLSearchParams();
    if (p?.vendor_id) out.set("shop", String(p.vendor_id));
    out.set("product", String(id));
    router.push(`/browse?${out.toString()}`);
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
  // "Products" nav opens a clean, products-only listing (?products=1): hide the
  // browse chrome — vendor-category tabs, Shops pills, category/sub-category tabs —
  // and keep just the search bar + "All products" grid + infinite scroll.
  const productsOnly = sp?.get("products") === "1";
  // The shop currently in view (when scoped to one). Pharmacies accept a
  // prescription-only order, so we surface that entry below.
  const selectedVendor = vendorId ? vendors.find((v) => v.id === vendorId) ?? null : null;
  const vendorDistance = distanceToVendor(coords, selectedVendor ?? {});
  // Active in-shop sub-category tab (client-side, only when a category is active).
  const [activeSub, setActiveSub] = useState<number | null>(null);
  // Grid filtered by the active product-category tab, then the sub-category tab.
  const shownItems = (() => {
    let base = activeCat != null ? items.filter((p) => p.category_id === activeCat) : items;
    if (activeCat != null && activeSub != null) base = base.filter((p) => p.sub_category_id === activeSub);
    return base;
  })();
  // Sub-categories present in the loaded items for the active category → 2nd row.
  const subCats = useMemo<Category[]>(() => {
    if (activeCat == null) return [];
    const m = new Map<number, string>();
    items.forEach((p) => {
      if (p.category_id === activeCat && p.sub_category_id != null && p.sub_category_name) {
        m.set(Number(p.sub_category_id), p.sub_category_name);
      }
    });
    return [...m].map(([id, name]) => ({ id, name }));
  }, [items, activeCat]);
  // Infinite scroll is active only while browsing all products (no in-shop tab,
  // since that filters the loaded set client-side and the server can't page it).
  const canPaginate = !loading && items.length > 0 && activeCat == null;
  // Distinct product categories present in the loaded items → in-shop filter
  // tabs. Derived (not state) so it grows as more pages are appended on scroll.
  const productCats = useMemo<Category[]>(() => {
    const m = new Map<number, string>();
    items.forEach((p) => {
      if (p.category_id != null && p.category_name) m.set(Number(p.category_id), p.category_name);
    });
    return [...m].map(([id, name]) => ({ id, name }));
  }, [items]);

  // Build the shared filter params (geo + category + search) for a given page.
  function buildParams(effectiveQ: string, pageNum: number): Record<string, string> {
    const params: Record<string, string> = { page: String(pageNum), limit: String(PAGE_SIZE) };
    if (catId)             params.category_id        = String(catId);
    if (vendorCategoryId)  params.vendor_category_id = String(vendorCategoryId);
    if (vendorId)          params.vendor_id          = String(vendorId);
    if (effectiveQ)        params.q = effectiveQ;

    // Geo scope: URL params win (set when the location picker is applied here);
    // otherwise fall back to the saved delivery location — same source the
    // header, shop pills and category tabs use — so products stay scoped to
    // the chosen area even when arriving without geo query params.
    const urlHasGeo = !!(talukId || districtId || stateId || pincode);
    const loc = urlHasGeo ? null : readSavedLocation();
    const geoTaluk    = talukId    ?? loc?.taluk_id    ?? null;
    const geoDistrict = districtId ?? loc?.district_id ?? null;
    const geoState    = stateId    ?? loc?.state_id    ?? null;
    if (pincode)     params.pincode     = pincode;
    if (geoTaluk)    params.taluk_id    = String(geoTaluk);
    if (geoDistrict) params.district_id = String(geoDistrict);
    if (geoState)    params.state_id    = String(geoState);
    return params;
  }

  async function load(overrideQ?: string) {
    setLoading(true);
    try {
      const effectiveQ = overrideQ ?? q;
      const r = await api.get("/public/products", { params: buildParams(effectiveQ, 1) });
      const raws = (r.data.data?.items ?? []) as ApiProduct[];
      setItems(raws.map(adapt));
      setCats(((r.data.data?.categories ?? []) as Array<{ id: number | string; name: string }>).map((c) => ({ id: Number(c.id), name: c.name })));
      setPage(1);
      setHasMore(Boolean(r.data.data?.has_more));
      setTotal(Number(r.data.data?.total ?? raws.length));
      setActiveCat(null);
      setActiveSub(null);
    } catch (err) { toast.error(apiErrorMessage(err)); }
    finally { setLoading(false); }
  }

  // Fetch the next page and append. Re-entrancy guarded by fetchingRef so the
  // observer can't double-fire while a page is in flight.
  async function loadMore() {
    if (fetchingRef.current || !hasMore || loading) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const r = await api.get("/public/products", { params: buildParams(q, next) });
      const raws = (r.data.data?.items ?? []) as ApiProduct[];
      setItems((prev) => [...prev, ...raws.map(adapt)]);
      setPage(next);
      setHasMore(Boolean(r.data.data?.has_more));
    } catch (err) { toast.error(apiErrorMessage(err)); }
    finally { fetchingRef.current = false; setLoadingMore(false); }
  }
  // Sync `q` from the URL whenever it changes (header search submits via
  // router.push, which updates ?q= without remounting this component).
  const urlQ = sp?.get("q") ?? "";
  useEffect(() => { setQ(urlQ); }, [urlQ]);
  useEffect(() => { void load(urlQ); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [catId, vendorId, vendorCategoryId, talukId, districtId, stateId, urlQ, locVersion]);

  // Keep the observer pointed at the freshest loadMore (current page/filters).
  loadMoreRef.current = () => { void loadMore(); };
  // Infinite scroll: when the bottom sentinel nears the viewport, fetch more.
  // Re-runs when canPaginate flips so the observer attaches once the sentinel
  // is actually in the DOM (it isn't during the initial loading state).
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMoreRef.current(); },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [canPaginate]);

  // Re-scope products when the delivery location changes (picker apply/clear),
  // even if it didn't alter the URL — mirrors the shop pills / category tabs.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onChange = () => setLocVersion((v) => v + 1);
    window.addEventListener("epey-location-changed", onChange);
    return () => window.removeEventListener("epey-location-changed", onChange);
  }, []);

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
        // Coerce id to Number — the API returns it as a string, which broke the
        // active-tab highlight (number vendorCategoryId !== string id).
        const raw = (res.data.data?.items ?? []) as Array<{ id: number | string; name: string }>;
        setVcats(raw.map((v) => ({ id: Number(v.id), name: v.name })));
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

  // Customer location for the vendor-store "X km away" line (quiet, no prompt).
  useEffect(() => {
    void getCustomerCoordsQuiet().then((c) => { if (c) setCoords(c); });
    if (typeof window === "undefined") return;
    const onCoords = () => setCoords(readCustomerCoords());
    window.addEventListener(COORDS_EVENT, onCoords);
    return () => window.removeEventListener(COORDS_EVENT, onCoords);
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
            <button
              type="submit"
              aria-label="Search"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--mk-brand)] px-4 text-white shadow-[var(--mk-shadow-sm)] transition-colors hover:bg-[var(--mk-brand-deep)]"
            >
              <Search className="h-5 w-5" />
            </button>
          </form>
        </div>
      </section>

      {/* Category tabs (vendor categories — same taxonomy as Shop by Category) */}
      {!productsOnly && vcats.length > 0 && (
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
      {!productsOnly && vendors.length > 0 && (
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

      {/* Product-category tabs — filter the products in view by their category */}
      {!productsOnly && productCats.length > 1 && (
        <section className="mx-auto max-w-7xl px-4 pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--mk-text-muted)]">Categories</p>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CategoryPill active={activeCat === null} onClick={() => { setActiveCat(null); setActiveSub(null); }}>All</CategoryPill>
            {productCats.map((c) => (
              <CategoryPill key={c.id} active={activeCat === c.id} onClick={() => { setActiveCat(c.id); setActiveSub(null); }}>{c.name}</CategoryPill>
            ))}
          </div>
        </section>
      )}

      {/* Sub-category tabs — only when a category with sub-categories is active */}
      {!productsOnly && activeCat != null && subCats.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-2">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--mk-text-muted)]">Sub-categories</p>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CategoryPill active={activeSub === null} onClick={() => setActiveSub(null)}>All</CategoryPill>
            {subCats.map((s) => (
              <CategoryPill key={s.id} active={activeSub === s.id} onClick={() => setActiveSub(s.id)}>{s.name}</CategoryPill>
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
            {vendorId && vendorDistance != null && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-[var(--mk-brand-deep)]">
                <Navigation className="h-3.5 w-3.5" /> {formatDistance(vendorDistance)} away
              </p>
            )}
          </div>
          {!loading && (
            <p className="text-sm text-[var(--mk-text-muted)]">
              {activeCat == null && total > items.length
                ? `${items.length} of ${total}`
                : `${shownItems.length} item${shownItems.length === 1 ? "" : "s"}`}
            </p>
          )}
        </div>
      </section>

      {/* Pharmacy: order with just a prescription, no item picking. */}
      {selectedVendor?.requires_prescription && (
        <section className="mx-auto max-w-7xl px-4 pt-4">
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-[var(--mk-brand)]/30 bg-[var(--mk-brand-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-bold">Have a prescription?</p>
              <p className="text-xs text-[var(--mk-text-muted)]">Upload it and place the order — the shop adds the medicines and bill.</p>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/prescription-order?vendor_id=${selectedVendor.id}&shop=${encodeURIComponent(selectedVendor.shop_name || selectedVendor.name)}`)}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--mk-brand)] px-4 text-sm font-semibold text-white shadow-[var(--mk-shadow-sm)] transition-colors hover:bg-[var(--mk-brand-deep)]"
            >
              Order with prescription
            </button>
          </div>
        </section>
      )}

      {/* Product grid */}
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        ) : shownItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--mk-border)] bg-[var(--mk-surface)] p-12 text-center">
            <Sparkles className="mx-auto mb-3 h-10 w-10 text-[var(--mk-brand)]" />
            <p className="text-sm font-semibold">No products match your filters</p>
            <p className="mt-1 text-xs text-[var(--mk-text-muted)]">Try a different search, pincode or category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {shownItems.map((p) => <ProductCard key={p.id} product={p} onSelect={openInBrowse} />)}
          </div>
        )}

        {/* Infinite scroll: sentinel + status. Only while browsing all products
            (no in-shop category tab active, so the loaded set isn't filtered). */}
        {!loading && items.length > 0 && (
          <>
            {canPaginate && <div ref={sentinelRef} className="h-1 w-full" aria-hidden />}
            {loadingMore && (
              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-[var(--mk-text-muted)]">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--mk-brand)] border-t-transparent" />
                Loading more…
              </div>
            )}
            {activeCat == null && !hasMore && (
              <p className="mt-6 text-center text-xs text-[var(--mk-text-muted)]">You&apos;ve reached the end · {items.length} products</p>
            )}
          </>
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
