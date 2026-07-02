"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, ShoppingCart, LayoutGrid, ChevronRight, Store, Pill, Package, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { cartBadge } from "@/lib/cart";
import { ProductCard, type MarketplaceProduct } from "@/components/marketplace/product-card";
import { readSavedLocation } from "@/components/marketplace/location-picker";

type VendorCategory = { id: number; name: string; image?: string | null; product_count?: number | string; status?: string };
type Shop = { id: number; name: string; shop_name?: string | null; image?: string | null; area?: string | null; pincode?: string | null; product_count?: number | string; requires_prescription?: boolean };
type ProductCategory = { id: number; name: string; status?: string };

// Location → API geo params (most specific wins).
function geoParams(): Record<string, string> {
  const loc = readSavedLocation();
  const p: Record<string, string> = {};
  if (loc?.taluk_id)         p.taluk_id    = String(loc.taluk_id);
  else if (loc?.district_id) p.district_id = String(loc.district_id);
  else if (loc?.state_id)    p.state_id    = String(loc.state_id);
  return p;
}

const ALL = 0; // sentinel for "All Shops" / "All Products"
const PAGE_SIZE = 24;

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

  // ---- cart bar ----
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => {
    const sync = () => setCartCount(cartBadge.get());
    sync();
    return cartBadge.subscribe(sync);
  }, []);

  // Vendor categories (left rail, vendor level). Re-fetch on location change.
  useEffect(() => {
    const run = async () => {
      setCatsLoading(true);
      try {
        const res = await api.get("/vendor-categories", { params: geoParams() });
        setCats((res.data.data?.items ?? []) as VendorCategory[]);
      } catch { setCats([]); } finally { setCatsLoading(false); }
    };
    void run();
    if (typeof window !== "undefined") {
      const vc = Number(new URLSearchParams(window.location.search).get("vc") || 0);
      if (vc > 0) setActiveCat(vc);
      const onLoc = () => { void run(); };
      window.addEventListener("epey-location-changed", onLoc);
      return () => window.removeEventListener("epey-location-changed", onLoc);
    }
  }, []);

  // Shops for the active vendor category.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setShopsLoading(true);
      try {
        const params = geoParams();
        if (activeCat !== ALL) params.vendor_category_id = String(activeCat);
        const res = await api.get("/public/vendors", { params });
        if (!cancelled) setShops((res.data.data?.items ?? []) as Shop[]);
      } catch { if (!cancelled) setShops([]); } finally { if (!cancelled) setShopsLoading(false); }
    };
    void run();
    if (typeof window !== "undefined" && level === "vendor") {
      window.history.replaceState(null, "", activeCat === ALL ? "/browse" : `/browse?vc=${activeCat}`);
    }
    return () => { cancelled = true; };
  }, [activeCat]);

  // Products for the active shop + product category (page 1). The PUBLIC
  // /public/products response also carries the shop's real product categories
  // (only the ones it actually stocks) — use those for the left rail instead of
  // the auth-gated /catalog/shops/:id, so guests can browse without a login bounce.
  useEffect(() => {
    if (level !== "shop" || !activeShop) return;
    let cancelled = false;
    setProdLoading(true);
    setProducts([]);
    const params: Record<string, string | number> = { vendor_id: activeShop.id, page: 1, limit: PAGE_SIZE };
    if (activeProdCat !== ALL) params.category_id = activeProdCat;
    api.get("/public/products", { params })
      .then((res) => {
        if (cancelled) return;
        const data = res.data.data ?? {};
        setProducts((data.items ?? []) as MarketplaceProduct[]);
        setHasMore(Boolean(data.has_more));
        setPage(1);
        // Rail categories come from the unfiltered (All Products) response only,
        // where the payload lists every category the shop stocks.
        if (activeProdCat === ALL) setShopCats((data.categories ?? []) as ProductCategory[]);
      })
      .catch(() => { if (!cancelled) { setProducts([]); setHasMore(false); } })
      .finally(() => { if (!cancelled) setProdLoading(false); });
    return () => { cancelled = true; };
  }, [level, activeShop, activeProdCat]);

  // Current selection, tracked in a ref so an in-flight loadMore can detect that
  // the shop/category changed while its request was pending and discard the stale
  // page (otherwise it would append the old category's items onto the new list).
  const selRef = useRef<{ shopId: number; cat: number }>({ shopId: 0, cat: ALL });
  useEffect(() => { selRef.current = { shopId: activeShop?.id ?? 0, cat: activeProdCat }; }, [activeShop, activeProdCat]);

  // Hardware back while in a shop → return to the vendor/shop-list level.
  useEffect(() => {
    const onPop = () => { setLevel("vendor"); setActiveShop(null); setShopCats([]); setProducts([]); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  async function loadMore() {
    if (!activeShop || loadingMore || prodLoading || !hasMore) return;
    const shopId = activeShop.id, cat = activeProdCat, next = page + 1;
    setLoadingMore(true);
    try {
      const params: Record<string, string | number> = { vendor_id: shopId, page: next, limit: PAGE_SIZE };
      if (cat !== ALL) params.category_id = cat;
      const res = await api.get("/public/products", { params });
      // Selection changed while this page was loading — drop the stale result.
      if (selRef.current.shopId !== shopId || selRef.current.cat !== cat) return;
      setProducts((cur) => [...cur, ...((res.data.data?.items ?? []) as MarketplaceProduct[])]);
      setHasMore(Boolean(res.data.data?.has_more));
      setPage(next);
    } catch { /* keep current list */ } finally { setLoadingMore(false); }
  }

  function openShop(shop: Shop) {
    setActiveShop(shop);
    setActiveProdCat(ALL);
    setShopCats([]);
    setLevel("shop");
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
      window.history.pushState(null, "", `/browse?vc=${activeCat}&shop=${shop.id}`);
    }
  }
  function backToVendor() {
    // Unwind the entry that openShop() pushed; the popstate handler resets the
    // level + clears shop state, keeping the URL and the UI in sync.
    if (typeof window !== "undefined") window.history.back();
  }

  const activeVendorName = useMemo(
    () => (activeCat === ALL ? "All Shops" : cats.find((c) => c.id === activeCat)?.name ?? "Shops"),
    [activeCat, cats],
  );
  const activeShopName = activeShop?.shop_name || activeShop?.name || "Shop";
  const activeProdCatName = activeProdCat === ALL ? "All Products" : shopCats.find((c) => c.id === activeProdCat)?.name ?? "Products";

  return (
    <div className="min-h-dvh bg-[var(--mk-surface)] pb-16">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-[var(--mk-border)] bg-[var(--mk-brand)] px-3 py-2.5 text-white">
        <button
          type="button"
          onClick={() => (level === "shop" ? backToVendor() : router.back())}
          aria-label="Back"
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 truncate text-base font-bold">{level === "shop" ? activeShopName : "Browse"}</h1>
        {level === "vendor" && (
          <Link href="/shop-public" aria-label="Search" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15">
            <Search className="h-5 w-5" />
          </Link>
        )}
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
          {level === "vendor" ? (
            <>
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="truncate text-lg font-bold">{activeVendorName}</h2>
                {!shopsLoading && shops.length > 0 && <span className="shrink-0 text-xs font-medium text-[var(--mk-text-muted)]">{shops.length} shops</span>}
              </div>
              {shopsLoading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[84px] animate-pulse rounded-2xl bg-[var(--mk-surface-3)]" />)}
                </div>
              ) : shops.length === 0 ? (
                <EmptyState icon={<Store className="h-6 w-6" />} title={`No shops in ${activeVendorName}`} sub="Nothing here for your delivery area yet. Try another category or change your location." />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {shops.map((s) => <ShopCard key={s.id} shop={s} onOpen={() => openShop(s)} />)}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="truncate text-lg font-bold">{activeProdCatName}</h2>
                {!prodLoading && products.length > 0 && <span className="shrink-0 text-xs font-medium text-[var(--mk-text-muted)]">{products.length} items</span>}
              </div>
              {prodLoading ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-[var(--mk-surface-3)]" />)}
                </div>
              ) : products.length === 0 ? (
                <EmptyState icon={<Package className="h-6 w-6" />} title="No products here" sub="This shop has no products in this category yet." />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {products.map((p) => <ProductCard key={p.id} product={p} />)}
                  </div>
                  {hasMore && (
                    <div className="mt-5 flex justify-center">
                      <button
                        type="button"
                        onClick={() => void loadMore()}
                        disabled={loadingMore}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--mk-border)] bg-white px-5 py-2 text-sm font-semibold text-[var(--mk-text)] shadow-[var(--mk-shadow-sm)] hover:border-[var(--mk-brand)]/40 hover:text-[var(--mk-brand-deep)] disabled:opacity-60"
                      >
                        {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load more"}
                      </button>
                    </div>
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
