"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Play, X } from "lucide-react";
import { fileUrl } from "@/lib/api";

export type HomeVideo = { id: number; title: string | null; video_url: string };

/**
 * Muted, autoplaying, looping video carousel for the home page. Slides
 * auto-advance every 6s. Tapping a slide opens a fit-to-screen player (with
 * sound + controls) that never crops portrait videos. Renders nothing when
 * there are no videos. Reuses the embla setup the hero carousel depends on.
 */
export function VideoCarousel({ title, videos }: { title: string; videos: HomeVideo[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: videos.length > 1, align: "start" },
    [Autoplay({ delay: 6000, stopOnInteraction: false, stopOnMouseEnter: true })]
  );
  const [idx, setIdx] = useState(0);
  const [preview, setPreview] = useState<HomeVideo | null>(null);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setIdx(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  // Close the player on Escape.
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPreview(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  if (videos.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--mk-text-muted)]">{title}</p>
      <div className="relative overflow-hidden rounded-2xl bg-black">
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex">
            {videos.map((v) => (
              <div key={v.id} className="group relative min-w-0 flex-[0_0_100%]">
                <button
                  type="button"
                  onClick={() => setPreview(v)}
                  aria-label={v.title ? `Play ${v.title}` : "Play video"}
                  className="relative block aspect-video w-full"
                >
                  <video
                    src={fileUrl(v.video_url) ?? ""}
                    className="h-full w-full object-contain"
                    muted
                    loop
                    autoPlay
                    playsInline
                    preload="metadata"
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition group-hover:bg-black/60">
                      <Play className="h-6 w-6 fill-white" />
                    </span>
                  </span>
                </button>
                {v.title && (
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 py-3 text-sm font-semibold text-white">
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

      {/* Fit-to-screen player — plays with sound, never crops (portrait or landscape). */}
      {preview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setPreview(null)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <video
              src={fileUrl(preview.video_url) ?? ""}
              className="max-h-[85vh] max-w-[92vw] rounded-xl bg-black sm:max-w-3xl"
              controls
              autoPlay
              playsInline
            />
            <button
              type="button"
              onClick={() => setPreview(null)}
              aria-label="Close"
              className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80"
            >
              <X className="h-5 w-5" />
            </button>
            {preview.title && (
              <p className="mt-2 text-center text-sm font-medium text-white">{preview.title}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
