"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { TopInfoBar } from "@/components/marketplace/top-info-bar";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { CategoryNavBar } from "@/components/marketplace/category-nav-bar";
import { CouponBanner } from "@/components/marketplace/coupon-banner";
import { HeroCarousel } from "@/components/marketplace/hero-carousel";
import { FeaturedCategories } from "@/components/marketplace/featured-categories";
import { ProductCard, ProductCardSkeleton, type MarketplaceProduct } from "@/components/marketplace/product-card";
import { MarketplaceBottomNav } from "@/components/marketplace/mobile-bottom-nav";
import type { HomeVideo } from "@/components/marketplace/video-carousel";
import type { MarketplaceVendor } from "@/components/marketplace/vendors-row";
import { api } from "@/lib/api";
import { EMPTY_BANNERS, type BannersBySlot } from "@/lib/banners";
import { readSavedLocation } from "@/components/marketplace/location-picker";
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
  image: string | null;
  vendor_name?: string | null;
  stock?: number;
  has_variants?: boolean;
  default_variant_id?: number | null;
};
type ApiVendor = {
  id: number; name: string; shop_name?: string | null; area?: string | null; pincode?: string | null;
};

export default function PublicHomePage() {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [vendors,  setVendors]  = useState<MarketplaceVendor[]>([]);
  const [banners,  setBanners]  = useState<BannersBySlot>(EMPTY_BANNERS);
  const [customerVideos, setCustomerVideos] = useState<HomeVideo[]>([]);
  const [vendorVideos,   setVendorVideos]   = useState<HomeVideo[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const loc = readSavedLocation();
        const params: Record<string, string> = {};
        if (loc?.taluk_id)         params.taluk_id    = String(loc.taluk_id);
        else if (loc?.district_id) params.district_id = String(loc.district_id);
        else if (loc?.state_id)    params.state_id    = String(loc.state_id);

        const [hr, vr, br, cvr, vvr] = await Promise.all([
          api.get("/public/home",    { params }).catch(() => null),
          api.get("/public/vendors", { params }).catch(() => null),
          api.get("/public/banners").catch(() => null),
          api.get("/public/customer-videos").catch(() => null),
          api.get("/public/vendor-videos").catch(() => null),
        ]);
        if (br?.data.data?.by_slot) {
          setBanners({ ...EMPTY_BANNERS, ...br.data.data.by_slot });
        }
        setCustomerVideos((cvr?.data.data?.items ?? []) as HomeVideo[]);
        setVendorVideos((vvr?.data.data?.items ?? []) as HomeVideo[]);
        const featured = ((hr?.data.data?.featured ?? []) as ApiProduct[]).map((p): MarketplaceProduct => ({
          id: Number(p.id),
          name: p.name,
          price: Number(p.price),
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
          rating: 4.2 + Math.random() * 0.6,
          delivery_time: "15-30 min",
        }));
        setVendors(vs);
      } catch { /* ignore — render empty states */ }
      finally { setLoading(false); }
    };

    void fetchAll();
    if (typeof window !== "undefined") {
      const onChange = () => { void fetchAll(); };
      window.addEventListener("epey-location-changed", onChange);
      return () => window.removeEventListener("epey-location-changed", onChange);
    }
  }, []);

  return (
    <div className="marketplace-theme min-h-screen pb-24 md:pb-0">
      <TopInfoBar />
      <MarketplaceHeader cartCount={0} wishlistCount={0} unreadCount={0} />
      <CategoryNavBar />

      <CouponBanner banner={banners.coupon[0] ?? null} />

      <HeroCarousel
        centerSlides={banners.hero_center}
        leftBanner={banners.hero_left[0] ?? null}
        rightTop={banners.hero_right_top[0] ?? null}
        rightBottom={banners.hero_right_bottom[0] ?? null}
      />
      <FeaturedCategories />
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : products.length === 0
              ? <EmptyState />
              : products.slice(0, 8).map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* Flash sale (reuses products with synthetic discount badges + countdown) */}
      {products.length > 0 && <FlashSale products={products} loading={loading} />}

      <ServicesSection />

      <VendorsRow vendors={vendors} loading={loading} />

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
