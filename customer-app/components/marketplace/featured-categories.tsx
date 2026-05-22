"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";

type VendorCategory = {
  id: number;
  name: string;
  image?: string | null;
  product_count?: number | string;
  status: string;
};

const PALETTE = ["bg-[#FCEBC5]", "bg-[#FBE4DE]", "bg-[#E8F2D8]", "bg-[#FFEAD2]", "bg-[#FFD9CE]", "bg-[#F8C6BD]"];

// Pick a sensible emoji from the category name. Tweak as you add categories.
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

  // Show up to 12 in the carousel so there's something to swipe through when the
  // user has more than fit on screen at once.
  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/vendor-categories");
        const items = (res.data.data?.items ?? []) as VendorCategory[];
        setCats(items.slice(0, 12));
      } catch {
        // Backend unreachable — hide the section rather than show stale demo data.
        setCats([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Don't render the section while loading or when empty
  if (loading || cats.length === 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-6">
        <PromoBanners />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <CategoryCarousel cats={cats} />
      <PromoBanners />
    </section>
  );
}

function CategoryCarousel({ cats }: { cats: VendorCategory[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: false,
    containScroll: "trimSnaps",
    dragFree: true,
  });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    if (!emblaApi) return;
    const update = () => {
      setCanPrev(emblaApi.canScrollPrev());
      setCanNext(emblaApi.canScrollNext());
    };
    emblaApi.on("select", update);
    emblaApi.on("reInit", update);
    update();
    return () => {
      emblaApi.off("select", update);
      emblaApi.off("reInit", update);
    };
  }, [emblaApi]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mk-text-muted)]">Our Collection</p>
          <h2 className="text-xl font-bold tracking-tight md:text-2xl">Featured Categories</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={scrollPrev}
            disabled={!canPrev}
            aria-label="Previous categories"
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-[var(--mk-border)] bg-white text-[var(--mk-text)] transition-opacity hover:border-[var(--mk-brand)]/40 disabled:opacity-30 sm:flex"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={scrollNext}
            disabled={!canNext}
            aria-label="Next categories"
            className="hidden h-9 w-9 items-center justify-center rounded-full border border-[var(--mk-border)] bg-white text-[var(--mk-text)] transition-opacity hover:border-[var(--mk-brand)]/40 disabled:opacity-30 sm:flex"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <Link
            href="/shop-public"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--mk-brand)] text-white hover:opacity-90"
            aria-label="See all categories"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex gap-3 md:gap-4">
          {cats.map((c, i) => {
            const bg = PALETTE[i % PALETTE.length];
            const count = Number(c.product_count ?? 0);
            const hasImage = typeof c.image === "string" && c.image.length > 0;
            return (
              <Link
                key={c.id}
                href={`/shop-public?vendor_category_id=${c.id}`}
                className={`group relative flex min-w-0 shrink-0 grow-0 basis-1/2 overflow-hidden rounded-2xl shadow-[var(--mk-shadow-sm)] transition-transform hover:-translate-y-1 hover:shadow-[var(--mk-shadow-md)] sm:basis-1/3 md:basis-1/4 lg:basis-1/6 ${hasImage ? "bg-black" : bg}`}
              >
                <div className="aspect-[3/4] w-full">
                  {hasImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.image as string}
                      alt={c.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="text-6xl leading-none">{emojiFor(c.name)}</span>
                    </div>
                  )}
                </div>
                {/* Bottom gradient + text overlay */}
                <div className={`pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-3 pt-10 ${hasImage ? "bg-gradient-to-t from-black/95 via-black/70 to-transparent text-white" : "bg-gradient-to-t from-white/95 via-white/75 to-transparent text-[var(--mk-text)]"}`}>
                  <p
                    className="text-sm font-bold leading-tight md:text-base"
                    style={hasImage ? { textShadow: "0 1px 2px rgba(0,0,0,0.7)" } : undefined}
                  >
                    {c.name}
                  </p>
                  <p
                    className={`text-[11px] font-medium ${hasImage ? "text-white/95" : "text-[var(--mk-text-muted)]"}`}
                    style={hasImage ? { textShadow: "0 1px 2px rgba(0,0,0,0.6)" } : undefined}
                  >
                    {count} {count === 1 ? "Product" : "Products"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PromoBanners() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
      <PromoBanner
        tag="Fresh Vegetables"
        title="Home Delivery of Fresh Fruits & Vegetables."
        theme="green"
        img="https://picsum.photos/seed/epey-vegetables/600/400"
      />
      <PromoBanner
        tag="Premium Cuts"
        title="Delicious Steaks From Our Top Chef."
        theme="purple"
        img="https://picsum.photos/seed/epey-steak/600/400"
      />
    </div>
  );
}

function PromoBanner({
  tag, title, theme, img,
}: {
  tag: string;
  title: string;
  theme: "green" | "purple";
  img: string;
}) {
  const themeMap = {
    green:  { card: "bg-[#1F7A4D] text-white", tag: "bg-white/15 text-white", btn: "bg-white text-[#1F7A4D]" },
    purple: { card: "bg-[#5C2B6F] text-white", tag: "bg-white/15 text-white", btn: "bg-white text-[#5C2B6F]" },
  }[theme];

  return (
    <div className={`relative flex min-h-[180px] overflow-hidden rounded-2xl ${themeMap.card}`}>
      <div className="relative z-10 flex-1 p-5 sm:p-6">
        <span className={`inline-block rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${themeMap.tag}`}>
          {tag}
        </span>
        <h3 className="mt-3 max-w-[18ch] text-xl font-bold leading-tight sm:text-2xl">{title}</h3>
        <Link
          href="/shop-public"
          className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${themeMap.btn}`}
        >
          Shop Now <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="relative w-2/5 shrink-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-90"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <div className={`absolute inset-y-0 left-0 w-12 bg-gradient-to-r ${theme === "green" ? "from-[#1F7A4D]" : "from-[#5C2B6F]"} to-transparent`} />
      </div>
    </div>
  );
}
