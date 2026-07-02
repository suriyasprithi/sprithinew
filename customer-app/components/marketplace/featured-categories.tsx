"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { readSavedLocation } from "./location-picker";

type VendorCategory = {
  id: number;
  name: string;
  image?: string | null;
  product_count?: number | string;
  status: string;
};

const PALETTE = ["bg-[#FCEBC5]", "bg-[#FBE4DE]", "bg-[#E8F2D8]", "bg-[#FFEAD2]", "bg-[#FFD9CE]", "bg-[#F8C6BD]"];

// Fallback emoji for categories that don't have an image yet.
function emojiFor(name: string): string {
  const n = name.toLowerCase();
  if (/(pastry|pastries|croissant)/.test(n))    return "🥐";
  if (/(bakery|bread|cake)/.test(n))            return "🍞";
  if (/(drink|juice|beverage|smoothie)/.test(n)) return "🥤";
  if (/(vegetable|veg|veggi)/.test(n))          return "🥦";
  if (/(strawberry|berry|fruit)/.test(n))       return "🍓";
  if (/(meat|steak|chicken|mutton)/.test(n))    return "🥩";
  if (/grocery/.test(n))                        return "🛒";
  if (/electronic|gadget|mobile/.test(n))       return "🔌";
  if (/pharmac|medic|drug/.test(n))             return "💊";
  if (/salon|beauty|parlour|parlor/.test(n))    return "💇";
  if (/restaurant|food/.test(n))                return "🍽️";
  if (/pet/.test(n))                            return "🐶";
  if (/toy/.test(n))                            return "🧸";
  if (/travel/.test(n))                         return "✈️";
  return "🏪";
}

export function FeaturedCategories() {
  const [cats, setCats] = useState<VendorCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtered by chosen delivery location. Show up to 16 tiles in the grid.
  useEffect(() => {
    const fetchCats = async () => {
      setLoading(true);
      try {
        const loc = readSavedLocation();
        const params: Record<string, string> = {};
        if (loc?.taluk_id)         params.taluk_id    = String(loc.taluk_id);
        else if (loc?.district_id) params.district_id = String(loc.district_id);
        else if (loc?.state_id)    params.state_id    = String(loc.state_id);
        const res = await api.get("/vendor-categories", { params });
        const items = (res.data.data?.items ?? []) as VendorCategory[];
        setCats(items.slice(0, 16));
      } catch {
        setCats([]);
      } finally {
        setLoading(false);
      }
    };
    void fetchCats();
    if (typeof window !== "undefined") {
      const onChange = () => { void fetchCats(); };
      window.addEventListener("epey-location-changed", onChange);
      return () => window.removeEventListener("epey-location-changed", onChange);
    }
  }, []);

  // Reserve height with a matching skeleton grid so the page doesn't shift (CLS).
  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-[var(--mk-surface-3)]" />
          <div className="h-6 w-48 animate-pulse rounded bg-[var(--mk-surface-3)]" />
        </div>
        <div className="grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-6 lg:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="aspect-square w-full animate-pulse rounded-2xl bg-[var(--mk-surface-3)]" />
              <div className="h-3 w-12 animate-pulse rounded bg-[var(--mk-surface-3)]" />
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (cats.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mk-text-muted)]">Our Collection</p>
          <h2 className="text-xl font-bold tracking-tight md:text-2xl">Featured Categories</h2>
        </div>
        <Link
          href="/shop-public"
          className="shrink-0 text-sm font-semibold text-[var(--mk-brand)] transition-opacity hover:opacity-80"
        >
          See all
        </Link>
      </div>

      {/* Compact tile grid — rounded image square + name below */}
      <div className="grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-6 lg:grid-cols-8">
        {cats.map((c, i) => {
          const bg = PALETTE[i % PALETTE.length];
          const hasImage = typeof c.image === "string" && c.image.length > 0;
          return (
            <Link
              key={c.id}
              href={`/shop-public?vendor_category_id=${c.id}`}
              className="group flex flex-col items-center gap-1.5 text-center"
            >
              <div
                className={`aspect-square w-full overflow-hidden rounded-2xl shadow-[var(--mk-shadow-sm)] transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[var(--mk-shadow-md)] ${hasImage ? "bg-black" : bg}`}
              >
                {hasImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.image as string}
                    alt={c.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-3xl leading-none">
                    {emojiFor(c.name)}
                  </span>
                )}
              </div>
              <span className="line-clamp-2 text-xs font-medium leading-tight text-[var(--mk-text)] group-hover:text-[var(--mk-brand-deep)] md:text-sm">
                {c.name}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
