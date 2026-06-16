"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { fileUrl } from "@/lib/api";

export type HomeVideo = { id: number; title: string | null; video_url: string };

/**
 * Muted, autoplaying, looping video carousel for the home page. Slides
 * auto-advance every 6s. Renders nothing when there are no videos.
 * Reuses the embla setup the hero carousel already depends on (no new package).
 */
export function VideoCarousel({ title, videos }: { title: string; videos: HomeVideo[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: videos.length > 1, align: "start" },
    [Autoplay({ delay: 6000, stopOnInteraction: false, stopOnMouseEnter: true })]
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

  if (videos.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--mk-text-muted)]">{title}</p>
      <div className="relative overflow-hidden rounded-2xl bg-black">
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex">
            {videos.map((v) => (
              <div key={v.id} className="relative min-w-0 flex-[0_0_100%]">
                <div className="aspect-video w-full">
                  <video
                    src={fileUrl(v.video_url) ?? ""}
                    className="h-full w-full object-cover"
                    muted
                    loop
                    autoPlay
                    playsInline
                    preload="metadata"
                  />
                </div>
                {v.title && (
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 py-3 text-sm font-semibold text-white">
                    {v.title}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {videos.length > 1 && (
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/30 px-2.5 py-1 backdrop-blur-md">
            {videos.map((_, i) => (
              <button
                key={i}
                onClick={() => scrollTo(i)}
                aria-label={`Video ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/70"}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
