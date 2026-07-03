"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { readSavedLocation } from "./location-picker";

type VendorCategory = {
  id: number;
  name: string;
  image?: string | null;
  product_count?: number | string;
  status: string;
};

// How many tiles to show collapsed on the mobile/tablet grid — 2 rows.
const COLLAPSED = 8;

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

// One category tile — rounded image square + name below. Shared by the
// mobile grid and the desktop slider.
function CategoryTile({ c, i }: { c: VendorCategory; i: number }) {
  const bg = PALETTE[i % PALETTE.length];
  const hasImage = typeof c.image === "string" && c.image.length > 0;
  return (
    <Link
      href={`/browse?vc=${c.id}`}
      className="group flex flex-col items-center gap-2 text-center"
    >
      <div
        className={`aspect-square w-full overflow-hidden rounded-2xl ring-1 ring-black/5 shadow-[var(--mk-shadow-sm)] transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-[var(--mk-shadow-md)] group-hover:ring-[var(--mk-brand)]/30 ${hasImage ? "bg-[var(--mk-surface-2)]" : bg}`}
      >
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.image as string}
            alt={c.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-3xl leading-none">
            {emojiFor(c.name)}
          </span>
        )}
      </div>
      {/* Fixed 2-line height so every tile in a row lines up neatly. */}
      <span className="line-clamp-2 min-h-[2.1rem] text-xs font-medium leading-tight text-[var(--mk-text)] transition-colors group-hover:text-[var(--mk-brand-deep)] md:text-[13px]">
        {c.name}
      </span>
    </Link>
  );
}

export function FeaturedCategories() {
  const [cats, setCats] = useState<VendorCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const sliderRef = useRef<HTMLDivElement | null>(null);

  // Filtered by chosen delivery location.
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
        setCats(items);
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
        <div className="grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-6 lg:grid-cols-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
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

  const hiddenCount = cats.length - COLLAPSED;
  // Collapsed grid leaves the last slot for the in-grid "More" tile, so the row
  // stays full (7 categories + More) instead of a lonely button below the grid.
  const mobileList = expanded || hiddenCount <= 0 ? cats : cats.slice(0, COLLAPSED - 1);

  // Desktop slider: scroll by ~85% of the visible width per arrow tap.
  const slide = (dir: number) => {
    const el = sliderRef.current;
    if (el) el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mk-text-muted)]">Our Collection</p>
          <h2 className="text-xl font-bold tracking-tight md:text-2xl">Featured Categories</h2>
        </div>
        <Link
          href="/browse"
          className="shrink-0 text-sm font-semibold text-[var(--mk-brand)] transition-opacity hover:opacity-80"
        >
          See all
        </Link>
      </div>

      {/* Mobile / tablet: grid with the More / Show-less control as an in-grid
          tile (last slot) so it reads as part of the collection, not a stray
          button. */}
      <div className="grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-6 lg:hidden">
        {mobileList.map((c, i) => <CategoryTile key={c.id} c={c} i={i} />)}
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="group flex flex-col items-center gap-2 text-center"
          >
            <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-[var(--mk-brand-soft)] ring-1 ring-[var(--mk-brand)]/20 shadow-[var(--mk-shadow-sm)] transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-[var(--mk-shadow-md)] group-hover:ring-[var(--mk-brand)]/40">
              <span className="flex flex-col items-center leading-none text-[var(--mk-brand-deep)]">
                <ChevronDown className={`h-6 w-6 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
                {!expanded && <span className="mt-0.5 text-sm font-bold">+{hiddenCount}</span>}
              </span>
            </div>
            <span className="line-clamp-2 min-h-[2.1rem] text-xs font-semibold leading-tight text-[var(--mk-brand-deep)]">
              {expanded ? "Show less" : "More"}
            </span>
          </button>
        )}
      </div>

      {/* Desktop (PC): horizontal slider — scroll through every category with
          prev/next arrows instead of the grid + "More" expander. */}
      <div className="relative hidden lg:block">
        <div
          ref={sliderRef}
          className="flex gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {cats.map((c, i) => (
            <div key={c.id} className="w-36 shrink-0">
              <CategoryTile c={c} i={i} />
            </div>
          ))}
        </div>
        <button
          type="button"
          aria-label="Previous categories"
          onClick={() => slide(-1)}
          className="absolute -left-4 top-[72px] z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--mk-border)] bg-white text-[var(--mk-text)] shadow-[var(--mk-shadow-md)] transition-colors hover:border-[var(--mk-brand)]/40 hover:text-[var(--mk-brand-deep)]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Next categories"
          onClick={() => slide(1)}
          className="absolute -right-4 top-[72px] z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--mk-border)] bg-white text-[var(--mk-text)] shadow-[var(--mk-shadow-md)] transition-colors hover:border-[var(--mk-brand)]/40 hover:text-[var(--mk-brand-deep)]"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}
