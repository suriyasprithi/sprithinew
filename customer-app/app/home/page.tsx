"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { TopInfoBar } from "@/components/marketplace/top-info-bar";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { CategoryNavBar } from "@/components/marketplace/category-nav-bar";
import { CouponBanner } from "@/components/marketplace/coupon-banner";
import { HeroCarousel, HeroCarouselSkeleton } from "@/components/marketplace/hero-carousel";
import { FeaturedCategories } from "@/components/marketplace/featured-categories";
import { ProductCard, ProductCardSkeleton, type MarketplaceProduct } from "@/components/marketplace/product-card";
import { MarketplaceBottomNav } from "@/components/marketplace/mobile-bottom-nav";
import type { HomeVideo } from "@/components/marketplace/video-carousel";
import type { MarketplaceVendor } from "@/components/marketplace/vendors-row";
import { api } from "@/lib/api";
import { EMPTY_BANNERS, type BannersBySlot } from "@/lib/banners";
import { readSavedLocation } from "@/components/marketplace/location-picker";
import { requestCustomerLocationOnce, readCustomerCoords, distanceToVendor, COORDS_EVENT, type Coords } from "@/lib/geo";
import Link from "next/link";
import { Sparkles } from "lucide-react";

// Below-the-fold sections — code-split out of the initial bundle (client-only)
// so the first paint and hydration stay light. They mount after the page loads.
const VideoCarousel    = dynamic(() => import("@/components/marketplace/video-carousel").then((m) => m.VideoCarousel), { ssr: false });
const FlashSale        = dynamic(() => import("@/components/marketplace/flash-sale").then((m) => m.FlashSale), { ssr: false });
const VendorsRow       = dynamic(() => import("@/components/marketplace/vendors-row").then((m) => m.VendorsRow), { ssr: false });
const ServicesSection  = dynamic(() => import("@/components/marketplace/services-section").then((m) => m.ServicesSection), { ssr: false });
const FloatingActions  = dynamic(() => import("@/components/marketplace/floating-actions").then((m) => m.FloatingActions), { ssr: false });
const MarketplaceFooter = dynamic(() => import("@/components/marketplace/marketplace-footer").then((m) => m.MarketplaceFooter), { ssr: false });

type ApiProduct = {
  id: number;
  name: string;
  price: number | string;
  old_price?: number | string | null;
  image: string | null;
  vendor_name?: string | null;
  stock?: number;
  has_variants?: boolean;
  default_variant_id?: number | null;
  sold_count?: number | string | null;
};
type ApiVendor = {
  id: number; name: string; shop_name?: string | null; area?: string | null; pincode?: string | null;
  latitude?: number | null; longitude?: number | null;
};

// Same URL axios builds for /public/banners. An inline <script> (below) kicks
// this fetch off during HTML parse — before the JS bundle finishes downloading —
// so the hero banner (mobile LCP element) is ready sooner.
const BANNERS_URL = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/v1/public/banners`;

export default function PublicHomePage() {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [topProducts, setTopProducts] = useState<MarketplaceProduct[]>([]);
  const [newArrivals, setNewArrivals] = useState<MarketplaceProduct[]>([]);
  const [vendors,  setVendors]  = useState<MarketplaceVendor[]>([]);
  const [banners,  setBanners]  = useState<BannersBySlot>(EMPTY_BANNERS);
  const [customerVideos, setCustomerVideos] = useState<HomeVideo[]>([]);
  const [vendorVideos,   setVendorVideos]   = useState<HomeVideo[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [coords, setCoords] = useState<Coords | null>(null);

  useEffect(() => {
    // Hero banners gate the mobile LCP — fetch them on their own so the hero
    // paints as soon as banners arrive, rather than waiting for the slower
    // product/vendor/video calls to all resolve.
    const fetchBanners = () => {
      setBannersLoading(true);
      // Reuse the fetch started in the inline <head>-script (HTML-parse time) if
      // present; otherwise fetch normally. Either way it resolves to the API
      // envelope { data: { by_slot } }.
      const early = typeof window !== "undefined"
        ? (window as unknown as { __epeyBanners?: Promise<{ data?: { by_slot?: Partial<BannersBySlot> } } | null> }).__epeyBanners
        : null;
      const p = early ? Promise.resolve(early) : api.get("/public/banners").then((r) => r.data);
      if (typeof window !== "undefined") {
        (window as unknown as { __epeyBanners?: unknown }).__epeyBanners = undefined; // one-shot
      }
      p.then((env) => { if (env?.data?.by_slot) setBanners({ ...EMPTY_BANNERS, ...env.data.by_slot }); })
        .catch(() => { /* keep empty banners */ })
        .finally(() => setBannersLoading(false));
    };

    const fetchRest = async () => {
      setLoading(true);
      const loc = readSavedLocation();
      const params: Record<string, string> = {};
      if (loc?.taluk_id)         params.taluk_id    = String(loc.taluk_id);
      else if (loc?.district_id) params.district_id = String(loc.district_id);
      else if (loc?.state_id)    params.state_id    = String(loc.state_id);
      try {
        const [hr, vr, cvr, vvr, tsr, nar] = await Promise.all([
          api.get("/public/home",         { params }).catch(() => null),
          api.get("/public/vendors",      { params }).catch(() => null),
          api.get("/public/customer-videos").catch(() => null),
          api.get("/public/vendor-videos").catch(() => null),
          api.get("/public/top-selling",  { params }).catch(() => null),
          api.get("/public/new-arrivals", { params }).catch(() => null),
        ]);
        setNewArrivals(((nar?.data.data?.items ?? []) as ApiProduct[]).map((p): MarketplaceProduct => ({
          id: Number(p.id),
          name: p.name,
          price: Number(p.price),
          old_price: p.old_price != null ? Number(p.old_price) : undefined,
          image: p.image,
          vendor_name: p.vendor_name ?? null,
          stock: p.stock,
          has_variants: !!p.has_variants,
          default_variant_id: p.default_variant_id ?? null,
        })));
        setTopProducts(((tsr?.data.data?.items ?? []) as ApiProduct[]).map((p): MarketplaceProduct => ({
          id: Number(p.id),
          name: p.name,
          price: Number(p.price),
          old_price: p.old_price != null ? Number(p.old_price) : undefined,
          image: p.image,
          vendor_name: p.vendor_name ?? null,
          stock: p.stock,
          has_variants: !!p.has_variants,
          default_variant_id: p.default_variant_id ?? null,
          sold_count: p.sold_count != null ? Number(p.sold_count) : null,
        })));
        setCustomerVideos((cvr?.data.data?.items ?? []) as HomeVideo[]);
        setVendorVideos((vvr?.data.data?.items ?? []) as HomeVideo[]);
        const featured = ((hr?.data.data?.featured ?? []) as ApiProduct[]).map((p): MarketplaceProduct => ({
          id: Number(p.id),
          name: p.name,
          price: Number(p.price),
          old_price: p.old_price != null ? Number(p.old_price) : undefined,
          image: p.image,
          vendor_name: p.vendor_name ?? null,
          stock: p.stock,
          has_variants: !!p.has_variants,
          default_variant_id: p.default_variant_id ?? null,
        }));
        setProducts(featured);

        const vs = ((vr?.data.data?.items ?? []) as ApiVendor[]).map((v): MarketplaceVendor => ({
          id: Number(v.id),
          name: v.name,
          shop_name: v.shop_name ?? null,
          area: v.area ?? null,
          pincode: v.pincode ?? null,
          latitude: v.latitude != null ? Number(v.latitude) : null,
          longitude: v.longitude != null ? Number(v.longitude) : null,
          rating: 4.2 + Math.random() * 0.6,
        }));
        setVendors(vs);
      } catch { /* ignore — render empty states */ }
      finally { setLoading(false); }
    };

    const run = () => { fetchBanners(); void fetchRest(); };
    run();
    if (typeof window !== "undefined") {
      const onChange = () => { run(); };
      window.addEventListener("epey-location-changed", onChange);
      return () => window.removeEventListener("epey-location-changed", onChange);
    }
  }, []);

  // Customer location for the "X km away" distances on vendor cards. Quietly
  // reuses cached/granted coords (no surprise prompt); refreshes when the user
  // taps "Use current location" in the picker (which fires COORDS_EVENT).
  useEffect(() => {
    void requestCustomerLocationOnce().then((c) => { if (c) setCoords(c); });
    if (typeof window === "undefined") return;
    const onCoords = () => setCoords(readCustomerCoords());
    window.addEventListener(COORDS_EVENT, onCoords);
    return () => window.removeEventListener(COORDS_EVENT, onCoords);
  }, []);

  // Attach distance and sort nearest-first when we know where the customer is.
  const vendorsForDisplay = useMemo(() => {
    if (!coords) return vendors;
    return vendors
      .map((v) => ({ ...v, distance_km: distanceToVendor(coords, v) }))
      .sort((a, b) => {
        if (a.distance_km == null) return b.distance_km == null ? 0 : 1;
        if (b.distance_km == null) return -1;
        return a.distance_km - b.distance_km;
      });
  }, [vendors, coords]);

  return (
    <div className="marketplace-theme min-h-screen pb-24 md:pb-0">
      {/* Start the hero-banners fetch during HTML parse (before the JS bundle
          finishes) so the LCP banner is ready sooner on mobile. fetchBanners()
          reuses window.__epeyBanners. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `try{window.__epeyBanners=fetch(${JSON.stringify(BANNERS_URL)},{headers:{Accept:"application/json"}}).then(function(r){return r.json()}).catch(function(){return null})}catch(e){}`,
        }}
      />
      <TopInfoBar />
      <MarketplaceHeader cartCount={0} wishlistCount={0} unreadCount={0} />
      <CategoryNavBar />

      <CouponBanner banner={banners.coupon[0] ?? null} />

      {bannersLoading ? (
        <HeroCarouselSkeleton />
      ) : (
        <HeroCarousel
          centerSlides={banners.hero_center}
          leftBanner={banners.hero_left[0] ?? null}
          rightTop={banners.hero_right_top[0] ?? null}
          rightBottom={banners.hero_right_bottom[0] ?? null}
        />
      )}
      <FeaturedCategories />

      {/* Local vendors — placed directly under Featured Categories */}
      <VendorsRow vendors={vendorsForDisplay} loading={loading} />

      {/* New Arrivals — recent products interleaved across shops (mixed), below Local vendors */}
      {(loading || newArrivals.length > 0) && (
        <section className="mx-auto max-w-7xl px-4 py-6">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mk-text-muted)]">Just in</p>
              <h2 className="text-xl font-bold tracking-tight md:text-2xl">New Arrivals</h2>
            </div>
            <Link href="/shop-public" className="text-sm font-semibold text-[var(--mk-brand)] hover:underline">See all →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : newArrivals.slice(0, 10).map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {(customerVideos.length > 0 || vendorVideos.length > 0) && (
        <section className="mx-auto max-w-7xl px-4 py-6">
          <div className={`grid gap-4 ${customerVideos.length > 0 && vendorVideos.length > 0 ? "md:grid-cols-2" : "grid-cols-1"}`}>
            <VideoCarousel title="Featured videos" videos={customerVideos} />
            <VideoCarousel title="From our vendors" videos={vendorVideos} />
          </div>
        </section>
      )}

      {/* Top selling products */}
      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mk-text-muted)]">Best of the week</p>
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">Top selling products</h2>
          </div>
          <Link href="/shop-public" className="text-sm font-semibold text-[var(--mk-brand)] hover:underline">See all →</Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : (() => {
                // Real bestsellers by sold quantity; fall back to recent only when
                // there are no sales yet, so the section is never blank.
                const list = topProducts.length > 0 ? topProducts : products;
                return list.length === 0
                  ? <EmptyState />
                  : list.slice(0, 10).map((p) => <ProductCard key={p.id} product={p} />);
              })()}
        </div>
      </section>

      {/* Flash sale — self-fetches live limited-time discounts; hides itself when none */}
      <FlashSale />

      <ServicesSection />

      <MarketplaceFooter />
      <FloatingActions />
      <MarketplaceBottomNav cartCount={0} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-[var(--mk-border)] bg-[var(--mk-surface)] py-12 text-center text-sm text-[var(--mk-text-muted)]">
      <Sparkles className="mx-auto mb-2 h-8 w-8 text-[var(--mk-brand)]" />
      No featured products yet. Check back soon.
    </div>
  );
}
