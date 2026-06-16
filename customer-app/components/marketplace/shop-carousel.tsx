"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Store } from "lucide-react";
import { fileUrl } from "@/lib/api";

export type ShopBanner = { id: number; name: string; image: string };

/**
 * Auto-playing carousel of vendor shop cover images for the customer dashboard.
 * Each slide links to that shop's detail page. Renders nothing when empty.
 * Reuses the embla setup the home hero already depends on (no new package).
 */
export function ShopCarousel({ shops }: { shops: ShopBanner[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: shops.length > 1, align: "start" },
    [Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })]
  );
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setIdx(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  if (shops.length === 0) return null;

  return (
    <div>
      <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#6b7280]">Shops</h3>
      <div className="relative overflow-hidden rounded-2xl">
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex">
            {shops.map((s) => (
              <Link
                key={s.id}
                href={`/shops/detail?id=${s.id}`}
                className="relative block min-w-0 flex-[0_0_100%]"
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#f3f4f6]">
                  <img
                    src={fileUrl(s.image) ?? ""}
                    alt={s.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 py-3">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                      <Store className="h-4 w-4" /> {s.name}
                    </span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {shops.length > 1 && (
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/25 px-2.5 py-1 backdrop-blur-md">
            {shops.map((_, i) => (
              <button
                key={i}
                onClick={() => scrollTo(i)}
                aria-label={`Shop ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/70"}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
