"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, ShoppingCart, LayoutGrid, ChevronRight, Store, Pill } from "lucide-react";
import { api } from "@/lib/api";
import { readSavedLocation } from "@/components/marketplace/location-picker";

type VendorCategory = {
  id: number;
  name: string;
  image?: string | null;
  product_count?: number | string;
  status?: string;
};

type Shop = {
  id: number;
  name: string;
  shop_name?: string | null;
  image?: string | null;
  area?: string | null;
  pincode?: string | null;
  requires_prescription?: boolean;
};

// Location → API geo params (most specific wins), shared by both requests.
function geoParams(): Record<string, string> {
  const loc = readSavedLocation();
  const p: Record<string, string> = {};
  if (loc?.taluk_id)         p.taluk_id    = String(loc.taluk_id);
  else if (loc?.district_id) p.district_id = String(loc.district_id);
  else if (loc?.state_id)    p.state_id    = String(loc.state_id);
  return p;
}

const ALL = 0; // sentinel vendor-category id for "All Shops"

export default function BrowsePage() {
  const router = useRouter();
  const [cats, setCats] = useState<VendorCategory[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);
  const [activeCat, setActiveCat] = useState<number>(ALL);

  const [shops, setShops] = useState<Shop[]>([]);
  const [shopsLoading, setShopsLoading] = useState(true);

  // Vendor categories for the left rail. Re-fetch on location change.
  useEffect(() => {
    const run = async () => {
      setCatsLoading(true);
      try {
        const res = await api.get("/vendor-categories", { params: geoParams() });
        setCats((res.data.data?.items ?? []) as VendorCategory[]);
      } catch {
        setCats([]);
      } finally {
        setCatsLoading(false);
      }
    };
    void run();
    // Deep-link: /browse?vc=39 preselects a vendor category.
    if (typeof window !== "undefined") {
      const vc = Number(new URLSearchParams(window.location.search).get("vc") || 0);
      if (vc > 0) setActiveCat(vc);
      const onLoc = () => { void run(); };
      window.addEventListener("epey-location-changed", onLoc);
      return () => window.removeEventListener("epey-location-changed", onLoc);
    }
  }, []);

  // Shops for the active vendor category (All Shops = no vendor_category_id).
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setShopsLoading(true);
      try {
        const params = geoParams();
        if (activeCat !== ALL) params.vendor_category_id = String(activeCat);
        const res = await api.get("/public/vendors", { params });
        if (!cancelled) setShops((res.data.data?.items ?? []) as Shop[]);
      } catch {
        if (!cancelled) setShops([]);
      } finally {
        if (!cancelled) setShopsLoading(false);
      }
    };
    void run();
    // Keep the URL shareable without a full navigation (static-export safe).
    if (typeof window !== "undefined") {
      const url = activeCat === ALL ? "/browse" : `/browse?vc=${activeCat}`;
      window.history.replaceState(null, "", url);
    }
    return () => { cancelled = true; };
  }, [activeCat]);

  const activeName = useMemo(
    () => (activeCat === ALL ? "All Shops" : cats.find((c) => c.id === activeCat)?.name ?? "Shops"),
    [activeCat, cats],
  );

  return (
    <div className="min-h-dvh bg-[var(--mk-surface)]">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-[var(--mk-border)] bg-[var(--mk-brand)] px-3 py-2.5 text-white">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 truncate text-base font-bold">Browse</h1>
        <Link href="/shop-public" aria-label="Search" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15">
          <Search className="h-5 w-5" />
        </Link>
        <Link href="/cart" aria-label="Cart" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15">
          <ShoppingCart className="h-5 w-5" />
        </Link>
      </header>

      {/* Split: sticky left rail + right content */}
      <div className="mx-auto grid max-w-7xl grid-cols-[84px_1fr] md:grid-cols-[220px_1fr]">
        {/* LEFT — vendor category rail */}
        <nav className="sticky top-[52px] h-[calc(100dvh-52px)] overflow-y-auto border-r border-[var(--mk-border)] bg-white">
          <RailItem
            active={activeCat === ALL}
            label="All Shops"
            onClick={() => setActiveCat(ALL)}
            icon={<LayoutGrid className="h-5 w-5" />}
          />
          {catsLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 px-2 py-3 md:flex-row md:gap-3">
                  <div className="h-11 w-11 animate-pulse rounded-xl bg-[var(--mk-surface-3)]" />
                  <div className="hidden h-3 w-20 animate-pulse rounded bg-[var(--mk-surface-3)] md:block" />
                </div>
              ))
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
        </nav>

        {/* RIGHT — shops */}
        <section className="min-h-[calc(100dvh-52px)] px-3 py-4 md:px-5">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="truncate text-lg font-bold">{activeName}</h2>
            {!shopsLoading && shops.length > 0 && (
              <span className="shrink-0 text-xs font-medium text-[var(--mk-text-muted)]">{shops.length} shops</span>
            )}
          </div>

          {shopsLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[84px] animate-pulse rounded-2xl bg-[var(--mk-surface-3)]" />
              ))}
            </div>
          ) : shops.length === 0 ? (
            <EmptyShops categoryName={activeName} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shops.map((s) => (
                <ShopCard key={s.id} shop={s} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function RailItem({
  active,
  label,
  onClick,
  image,
  icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  image?: string;
  icon: React.ReactNode;
}) {
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
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl ${
          active ? "bg-white text-[var(--mk-brand)] ring-1 ring-[var(--mk-brand)]/30" : "bg-[var(--mk-surface-2)] text-[var(--mk-text-muted)]"
        }`}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={label} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          icon
        )}
      </span>
      <span
        className={`line-clamp-2 text-[11px] font-medium leading-tight md:text-sm ${
          active ? "text-[var(--mk-brand-deep)]" : "text-[var(--mk-text)]"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

function ShopCard({ shop }: { shop: Shop }) {
  const name = shop.shop_name || shop.name || "Shop";
  const hasImage = typeof shop.image === "string" && shop.image.length > 0;
  const place = [shop.area, shop.pincode].filter(Boolean).join(" · ");
  return (
    <Link
      href={`/shop-public?vendor_id=${shop.id}`}
      className="group flex items-center gap-3 rounded-2xl border border-[var(--mk-border)] bg-white p-3 shadow-[var(--mk-shadow-sm)] transition-all hover:-translate-y-0.5 hover:border-[var(--mk-brand)]/30 hover:shadow-[var(--mk-shadow-md)]"
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--mk-brand-soft)] text-lg font-bold text-[var(--mk-brand)]">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shop.image as string} alt={name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-[var(--mk-text)] group-hover:text-[var(--mk-brand-deep)]">{name}</span>
          {shop.requires_prescription && <Pill className="h-3.5 w-3.5 shrink-0 text-[var(--mk-brand)]" />}
        </span>
        {place && <span className="mt-0.5 block truncate text-xs text-[var(--mk-text-muted)]">{place}</span>}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-[var(--mk-text-muted)] transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function EmptyShops({ categoryName }: { categoryName: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--mk-border)] bg-white px-6 py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--mk-surface-2)] text-[var(--mk-text-muted)]">
        <Store className="h-6 w-6" />
      </span>
      <p className="mt-3 text-sm font-semibold text-[var(--mk-text)]">No shops in {categoryName}</p>
      <p className="mt-1 max-w-xs text-xs text-[var(--mk-text-muted)]">
        Nothing here for your delivery area yet. Try a different category or change your location.
      </p>
      <Link href="/home" className="mt-4 rounded-full bg-[var(--mk-brand)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
        Back to Home
      </Link>
    </div>
  );
}
