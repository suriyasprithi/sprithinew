"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, ShoppingCart, Heart, LayoutGrid, ChevronRight, Store, Pill, Package, Loader2, X } from "lucide-react";
import { api } from "@/lib/api";
import { cartBadge } from "@/lib/cart";
import { wishlist } from "@/lib/wishlist";
import { ProductCard, type MarketplaceProduct } from "@/components/marketplace/product-card";
import { readSavedLocation } from "@/components/marketplace/location-picker";

type VendorCategory = { id: number; name: string; image?: string | null; product_count?: number | string; status?: string };
type Shop = { id: number; name: string; shop_name?: string | null; image?: string | null; area?: string | null; pincode?: string | null; product_count?: number | string; requires_prescription?: boolean };
type ProductCategory = { id: number; name: string; status?: string };
type ApiProduct = {
  id: number | string; name: string; price: number | string; old_price?: number | string | null;
  image: string | null; stock?: number | string; vendor_name?: string | null; has_variants?: boolean;
  default_variant_id?: number | string | null; min_price?: number | string | null; max_price?: number | string | null;
  variant_axes?: { name: string; count: number; options?: string[] }[];
  category_id?: number | string | null; category_name?: string | null;
  sub_category_id?: number | string | null; sub_category_name?: string | null;
};

// CI4/MySQLi returns numeric columns as STRINGS. Coerce them: the wishlist stores
// numeric ids and drops non-numbers (so a string id silently never persists), and
// the price/discount math needs real numbers too.
function adapt(raw: ApiProduct): MarketplaceProduct {
  return {
    id: Number(raw.id),
    name: raw.name,
    price: Number(raw.price),
    old_price: raw.old_price != null ? Number(raw.old_price) : undefined,
    image: raw.image,
    vendor_name: raw.vendor_name ?? null,
    stock: raw.stock != null ? Number(raw.stock) : undefined,
    has_variants: !!raw.has_variants,
    default_variant_id: raw.default_variant_id != null ? Number(raw.default_variant_id) : null,
    min_price: raw.min_price != null ? Number(raw.min_price) : undefined,
    max_price: raw.max_price != null ? Number(raw.max_price) : undefined,
    variant_axes: Array.isArray(raw.variant_axes) ? raw.variant_axes : undefined,
    category_id: raw.category_id != null ? Number(raw.category_id) : null,
    category_name: raw.category_name ?? null,
    sub_category_id: raw.sub_category_id != null ? Number(raw.sub_category_id) : null,
    sub_category_name: raw.sub_category_name ?? null,
  };
}

// Location → API geo params (most specific wins).
function geoParams(): Record<string, string> {
  const loc = readSavedLocation();
  const p: Record<string, string> = {};
  if (loc?.taluk_id)         p.taluk_id    = String(loc.taluk_id);
  else if (loc?.district_id) p.district_id = String(loc.district_id);
  else if (loc?.state_id)    p.state_id    = String(loc.state_id);
  return p;
}

// Session cache so switching back to a vendor category is instant (no refetch).
// Cleared when the delivery location changes. Products are not cached (paginated
// + searchable), only the vendor rail and the per-category shop lists.
const browseCache: { vendorCats: VendorCategory[] | null; shops: Map<number, Shop[]> } = { vendorCats: null, shops: new Map() };

const ALL = 0; // sentinel for "All Shops" / "All Products"
const PAGE_SIZE = 24;

// Static export is served under a basePath (/customer on web) with trailing
// slashes. Raw history.pushState/replaceState do NOT apply either, so the URL
// must be built with both — otherwise a refresh hits a path the server can't
// resolve and 404s.
const BP = process.env.NEXT_PUBLIC_BASE_PATH || "";
const browseUrl = (vc: number, shop?: number) => {
  const p = new URLSearchParams();
  if (vc !== ALL) p.set("vc", String(vc));
  if (shop) p.set("shop", String(shop));
  const qs = p.toString();
  return `${BP}/browse/${qs ? `?${qs}` : ""}`;
};

export default function BrowsePage() {
  const router = useRouter();
  const [level, setLevel] = useState<"vendor" | "shop">("vendor");

  // ---- vendor level ----
  const [cats, setCats] = useState<VendorCategory[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<number>(ALL);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopsLoading, setShopsLoading] = useState(true);

  // ---- shop level ----
  const [activeShop, setActiveShop] = useState<Shop | null>(null);
  const [shopCats, setShopCats] = useState<ProductCategory[]>([]);
  const [activeProdCat, setActiveProdCat] = useState<number>(ALL);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // ---- search (one box; filters shops on the vendor level, products on the shop level) ----
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  // ---- cart bar ----
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => {
    const sync = () => setCartCount(cartBadge.get());
    sync();
    return cartBadge.subscribe(sync);
  }, []);
  const [wishCount, setWishCount] = useState(0);
  useEffect(() => {
    const sync = () => setWishCount(wishlist.ids().length);
    sync();
    return wishlist.subscribe(sync);
  }, []);

  // Vendor categories (left rail). Cached for the session; re-fetch on location change.
  useEffect(() => {
    const run = async (force = false) => {
      if (!force && browseCache.vendorCats) { setCats(browseCache.vendorCats); setCatsLoading(false); return; }
      setCatsLoading(true);
      try {
        const res = await api.get("/vendor-categories", { params: geoParams() });
        const items = (res.data.data?.items ?? []) as VendorCategory[];
        browseCache.vendorCats = items;
        setCats(items);
      } catch { setCats([]); } finally { setCatsLoading(false); }
    };
    void run();
    if (typeof window !== "undefined") {
      // Restore from the URL (e.g. redirected here from /shop-public).
      const sp = new URLSearchParams(window.location.search);
      const vc = Number(sp.get("vc") || 0);
      if (vc > 0) setActiveCat(vc);
      const q = sp.get("q") || "";
      if (q) setQuery(q);
      const shopId = Number(sp.get("shop") || 0);
      if (shopId > 0) { setActiveShop({ id: shopId, name: "" }); setLevel("shop"); } // name fills from products
      const onLoc = () => { browseCache.vendorCats = null; browseCache.shops.clear(); void run(true); };
      window.addEventListener("epey-location-changed", onLoc);
      return () => window.removeEventListener("epey-location-changed", onLoc);
    }
  }, []);

  // Shops for the active vendor category (cached per category).
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const cached = browseCache.shops.get(activeCat);
      if (cached) { setShops(cached); setShopsLoading(false); return; }
      setShopsLoading(true);
      try {
        const params = geoParams();
        if (activeCat !== ALL) params.vendor_category_id = String(activeCat);
        const res = await api.get("/public/vendors", { params });
        const items = (res.data.data?.items ?? []) as Shop[];
        if (cancelled) return;
        browseCache.shops.set(activeCat, items);
        setShops(items);
      } catch { if (!cancelled) setShops([]); } finally { if (!cancelled) setShopsLoading(false); }
    };
    void run();
    if (typeof window !== "undefined" && level === "vendor") {
      window.history.replaceState(null, "", browseUrl(activeCat));
    }
    return () => { cancelled = true; };
  }, [activeCat]);

  // Products for the active shop + product category + search (page 1). The PUBLIC
  // /public/products response also carries the shop's real product categories —
  // use those for the rail (guest-safe; only categories the shop actually stocks).
  useEffect(() => {
    if (level !== "shop" || !activeShop) return;
    let cancelled = false;
    setProdLoading(true);
    setProducts([]);
    const params: Record<string, string | number> = { vendor_id: activeShop.id, page: 1, limit: PAGE_SIZE };
    if (activeProdCat !== ALL) params.category_id = activeProdCat;
    if (debouncedQ) params.q = debouncedQ;
    api.get("/public/products", { params })
      .then((res) => {
        if (cancelled) return;
        const data = res.data.data ?? {};
        setProducts(((data.items ?? []) as ApiProduct[]).map(adapt));
        setHasMore(Boolean(data.has_more));
        setPage(1);
        // Rail categories only from the unfiltered (All Products, no search) response.
        if (activeProdCat === ALL && !debouncedQ) setShopCats((data.categories ?? []) as ProductCategory[]);
      })
      .catch(() => { if (!cancelled) { setProducts([]); setHasMore(false); } })
      .finally(() => { if (!cancelled) setProdLoading(false); });
    return () => { cancelled = true; };
  }, [level, activeShop, activeProdCat, debouncedQ]);

  // Current selection (+ search), tracked in a ref so an in-flight loadMore can
  // detect a change and discard its stale page.
  const selRef = useRef<{ shopId: number; cat: number; q: string }>({ shopId: 0, cat: ALL, q: "" });
  useEffect(() => { selRef.current = { shopId: activeShop?.id ?? 0, cat: activeProdCat, q: debouncedQ }; }, [activeShop, activeProdCat, debouncedQ]);

  // Hardware back while in a shop → return to the vendor/shop-list level.
  useEffect(() => {
    const onPop = () => { setLevel("vendor"); setActiveShop(null); setShopCats([]); setProducts([]); setQuery(""); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  async function loadMore() {
    if (!activeShop || loadingMore || prodLoading || !hasMore) return;
    const shopId = activeShop.id, cat = activeProdCat, q = debouncedQ, next = page + 1;
    setLoadingMore(true);
    try {
      const params: Record<string, string | number> = { vendor_id: shopId, page: next, limit: PAGE_SIZE };
      if (cat !== ALL) params.category_id = cat;
      if (q) params.q = q;
      const res = await api.get("/public/products", { params });
      if (selRef.current.shopId !== shopId || selRef.current.cat !== cat || selRef.current.q !== q) return; // stale
      setProducts((cur) => [...cur, ...((res.data.data?.items ?? []) as ApiProduct[]).map(adapt)]);
      setHasMore(Boolean(res.data.data?.has_more));
      setPage(next);
    } catch { /* keep current list */ } finally { setLoadingMore(false); }
  }

  // Infinite scroll — auto-load the next page when the sentinel nears the viewport.
  // loadMore's own guards make repeat firings safe no-ops. A CALLBACK ref attaches
  // the observer the instant the sentinel mounts (it only renders once products
  // exist), so scrolling actually triggers the next page.
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;
  const observerRef = useRef<IntersectionObserver | null>(null);
  const setSentinel = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    if (!el || typeof IntersectionObserver === "undefined") return;
    observerRef.current = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) void loadMoreRef.current(); },
      { rootMargin: "600px" },
    );
    observerRef.current.observe(el);
  }, []);

  function openShop(shop: Shop) {
    setActiveShop(shop);
    setActiveProdCat(ALL);
    setShopCats([]);
    setQuery("");
    setLevel("shop");
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
      window.history.pushState(null, "", browseUrl(activeCat, shop.id));
    }
  }
  function backToVendor() {
    // In-page transition + replaceState (not pushState) so the URL matches the
    // level without growing the history stack — works whether the shop was opened
    // in-page (openShop pushed) or reached via a ?shop= deep link (no push).
    setLevel("vendor");
    setActiveShop(null);
    setShopCats([]);
    setProducts([]);
    setQuery("");
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", browseUrl(activeCat));
    }
  }

  const activeVendorName = useMemo(
    () => (activeCat === ALL ? "All Shops" : cats.find((c) => c.id === activeCat)?.name ?? "Shops"),
    [activeCat, cats],
  );
  // Deep-linked shops (?shop=) start nameless — fill the header from the products.
  const activeShopName = activeShop?.shop_name || activeShop?.name || products[0]?.vendor_name || "Shop";
  const activeProdCatName = activeProdCat === ALL ? "All Products" : shopCats.find((c) => c.id === activeProdCat)?.name ?? "Products";
  // Pharmacy/medicine shop → offer a prescription-only order (same as /shop-public).
  // Falls back to the loaded shop list for deep-linked (?shop=) opens where the
  // activeShop stub has no requires_prescription flag yet.
  const activeShopRx = !!(activeShop && (activeShop.requires_prescription ?? shops.find((s) => s.id === activeShop.id)?.requires_prescription));

  // Vendor-level shop search is client-side over the (≤100) loaded shops.
  const shownShops = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter((s) => (s.shop_name || s.name || "").toLowerCase().includes(q) || (s.area || "").toLowerCase().includes(q));
  }, [shops, query]);

  return (
    <div className="marketplace-theme min-h-dvh bg-[var(--mk-bg)] pb-16">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-[var(--mk-border)] bg-[var(--mk-brand)] px-3 py-2.5 text-white">
        <button
          type="button"
          onClick={() => (level === "shop" ? backToVendor() : router.push("/home"))}
          aria-label="Back"
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 truncate text-base font-bold">{level === "shop" ? activeShopName : "Browse"}</h1>
        <Link href="/wishlist" aria-label="Wishlist" className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-white/15">
          <Heart className="h-5 w-5" />
          {wishCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-[var(--mk-brand)]">
              {wishCount > 9 ? "9+" : wishCount}
            </span>
          )}
        </Link>
        <Link href="/cart" aria-label="Cart" className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-white/15">
          <ShoppingCart className="h-5 w-5" />
          {cartCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[10px] font-bold text-[var(--mk-brand)]">
              {cartCount > 9 ? "9+" : cartCount}
            </span>
          )}
        </Link>
      </header>

      {/* Split: sticky left rail + right content */}
      <div className="mx-auto grid max-w-7xl grid-cols-[84px_1fr] md:grid-cols-[220px_1fr]">
        {/* LEFT rail — vendor categories OR product categories */}
        <nav className="sticky top-[53px] h-[calc(100dvh-53px)] overflow-y-auto border-r border-[var(--mk-border)] bg-white">
          {level === "vendor" ? (
            <>
              <RailItem active={activeCat === ALL} label="All Shops" onClick={() => setActiveCat(ALL)} icon={<LayoutGrid className="h-5 w-5" />} />
              {catsLoading
                ? <RailSkeleton />
                : cats.map((c) => (
                    <RailItem
                      key={c.id}
                      active={activeCat === c.id}
                      label={c.name}
                      onClick={() => setActiveCat(c.id)}
                      image={typeof c.image === "string" && c.image.length > 0 ? c.image : undefined}
                      icon={<Store className="h-5 w-5" />}
                    />
                  ))}
            </>
          ) : (
            <>
              <RailItem active={activeProdCat === ALL} label="All Products" onClick={() => setActiveProdCat(ALL)} icon={<Package className="h-5 w-5" />} />
              {shopCats.filter((c) => (c.status ?? "active") === "active").map((c) => (
                <RailItem key={c.id} active={activeProdCat === c.id} label={c.name} onClick={() => setActiveProdCat(c.id)} icon={<Package className="h-5 w-5" />} />
              ))}
            </>
          )}
        </nav>

        {/* RIGHT content */}
        <section className="min-h-[calc(100dvh-53px)] px-3 py-4 md:px-5">
          {/* Search box (adapts to the current level) */}
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--mk-text-muted)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={level === "shop" ? `Search in ${activeShopName}…` : "Search shops…"}
              className="h-11 w-full rounded-xl border border-[var(--mk-border)] bg-white pl-9 pr-9 text-sm outline-none focus:border-[var(--mk-brand)]/50"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[var(--mk-text-muted)] hover:bg-[var(--mk-surface-2)]">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {level === "vendor" ? (
            <>
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="truncate text-lg font-bold">{activeVendorName}</h2>
                {!shopsLoading && shownShops.length > 0 && <span className="shrink-0 text-xs font-medium text-[var(--mk-text-muted)]">{shownShops.length} shops</span>}
              </div>
              {shopsLoading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[84px] animate-pulse rounded-2xl bg-[var(--mk-surface-3)]" />)}
                </div>
              ) : shownShops.length === 0 ? (
                <EmptyState icon={<Store className="h-6 w-6" />} title={query ? "No shops match your search" : `No shops in ${activeVendorName}`} sub={query ? "Try a different name." : "Nothing here for your delivery area yet. Try another category or change your location."} />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {shownShops.map((s) => <ShopCard key={s.id} shop={s} onOpen={() => openShop(s)} />)}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Prescription banner — shown for pharmacy/medicine shops regardless of
                  the product-category selected below. */}
              {activeShopRx && (
                <div className="mb-3 flex flex-col items-start gap-3 rounded-2xl border border-[var(--mk-brand)]/30 bg-[var(--mk-brand-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-bold"><Pill className="h-4 w-4 text-[var(--mk-brand)]" /> Have a prescription?</p>
                    <p className="mt-0.5 text-xs text-[var(--mk-text-muted)]">Upload it and place the order — the shop adds the medicines and bill.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/prescription-order?vendor_id=${activeShop!.id}&shop=${encodeURIComponent(activeShopName)}`)}
                    className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[var(--mk-brand)] px-4 text-sm font-semibold text-white shadow-[var(--mk-shadow-sm)] transition-colors hover:bg-[var(--mk-brand-deep)]"
                  >
                    Order with prescription
                  </button>
                </div>
              )}

              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="truncate text-lg font-bold">{debouncedQ ? `“${debouncedQ}”` : activeProdCatName}</h2>
                {!prodLoading && products.length > 0 && <span className="shrink-0 text-xs font-medium text-[var(--mk-text-muted)]">{products.length}{hasMore ? "+" : ""} items</span>}
              </div>
              {prodLoading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-[var(--mk-surface-3)]" />)}
                </div>
              ) : products.length === 0 ? (
                <EmptyState icon={<Package className="h-6 w-6" />} title={debouncedQ ? "No matching products" : "No products here"} sub={debouncedQ ? "Try another search term." : "This shop has no products in this category yet."} />
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {products.map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>
                  {/* Infinite-scroll sentinel + spinner */}
                  <div ref={setSentinel} className="h-10" />
                  {loadingMore && (
                    <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin text-[var(--mk-brand)]" /></div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>

      {/* Sticky cart bar */}
      {cartCount > 0 && (
        <Link
          href="/cart"
          className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-7xl items-center justify-between gap-3 bg-[var(--mk-brand)] px-4 py-3 text-white shadow-[0_-6px_20px_-8px_rgba(0,0,0,0.35)]"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingCart className="h-4 w-4" />
            {cartCount} {cartCount === 1 ? "item" : "items"} in cart
          </span>
          <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-sm font-bold">
            View Cart <ChevronRight className="h-4 w-4" />
          </span>
        </Link>
      )}
    </div>
  );
}

function RailSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 px-2 py-3 md:flex-row md:gap-3">
          <div className="h-11 w-11 animate-pulse rounded-xl bg-[var(--mk-surface-3)]" />
          <div className="hidden h-3 w-20 animate-pulse rounded bg-[var(--mk-surface-3)] md:block" />
        </div>
      ))}
    </>
  );
}

function RailItem({ active, label, onClick, image, icon }: { active: boolean; label: string; onClick: () => void; image?: string; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active}
      className={`relative flex w-full flex-col items-center gap-1.5 px-2 py-3 text-center transition-colors md:flex-row md:gap-3 md:text-left ${
        active ? "bg-[var(--mk-brand-soft)]" : "hover:bg-[var(--mk-surface-2)]"
      }`}
    >
      {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-[var(--mk-brand)]" />}
      <span className={`grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl ${active ? "bg-white text-[var(--mk-brand)] ring-1 ring-[var(--mk-brand)]/30" : "bg-[var(--mk-surface-2)] text-[var(--mk-text-muted)]"}`}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={label} loading="lazy" className="h-full w-full object-cover" />
        ) : icon}
      </span>
      <span className={`line-clamp-2 text-[11px] font-medium leading-tight md:text-sm ${active ? "text-[var(--mk-brand-deep)]" : "text-[var(--mk-text)]"}`}>{label}</span>
    </button>
  );
}

function ShopCard({ shop, onOpen }: { shop: Shop; onOpen: () => void }) {
  const name = shop.shop_name || shop.name || "Shop";
  const hasImage = typeof shop.image === "string" && shop.image.length > 0;
  const place = [shop.area, shop.pincode].filter(Boolean).join(" · ");
  const count = Number(shop.product_count ?? 0);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-2xl border border-[var(--mk-border)] bg-white p-3 text-left shadow-[var(--mk-shadow-sm)] transition-all hover:-translate-y-0.5 hover:border-[var(--mk-brand)]/30 hover:shadow-[var(--mk-shadow-md)]"
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--mk-brand-soft)] text-lg font-bold text-[var(--mk-brand)]">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.image as string} alt={name} loading="lazy" className="h-full w-full object-cover" />
        ) : name.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-[var(--mk-text)] group-hover:text-[var(--mk-brand-deep)]">{name}</span>
          {shop.requires_prescription && <Pill className="h-3.5 w-3.5 shrink-0 text-[var(--mk-brand)]" />}
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-xs text-[var(--mk-text-muted)]">
          {count > 0 && <span>{count} products</span>}
          {place && <span className="truncate">· {place}</span>}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-[var(--mk-text-muted)] transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--mk-border)] bg-white px-6 py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--mk-surface-2)] text-[var(--mk-text-muted)]">{icon}</span>
      <p className="mt-3 text-sm font-semibold text-[var(--mk-text)]">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-[var(--mk-text-muted)]">{sub}</p>
      <Link href="/home" className="mt-4 rounded-full bg-[var(--mk-brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Back to Home</Link>
    </div>
  );
}
