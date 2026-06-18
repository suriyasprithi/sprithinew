"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import type { Banner } from "@/lib/banners";
import { bannerGradient } from "@/lib/banners";
import { lucideOrFallback } from "@/lib/lucide-registry";

export function HeroCarousel({
  centerSlides,
  leftBanner,
  rightTop,
  rightBottom,
}: {
  centerSlides: Banner[];
  leftBanner?: Banner | null;
  rightTop?: Banner | null;
  rightBottom?: Banner | null;
}) {
  if (centerSlides.length === 0 && !leftBanner && !rightTop && !rightBottom) return null;

  return (
    <section className="w-full px-4 py-5">
      <div
        className="grid gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 md:grid-cols-[1.05fr_2.6fr_1.1fr] md:[grid-template-rows:1fr]"
      >
        {leftBanner ? <SideTallBanner banner={leftBanner} /> : <div className="hidden md:block" />}
        {centerSlides.length > 0 ? <MainCarousel slides={centerSlides} /> : <div />}
        <div className="grid gap-4 md:grid-rows-2">
          {rightTop ? <SideShortBanner banner={rightTop} /> : <div className="hidden md:block" />}
          {/* Second right banner is desktop-only — keeps the mobile hero height
              fixed (matches HeroCarouselSkeleton) to avoid layout shift. */}
          {rightBottom ? <div className="hidden md:block"><SideShortBanner banner={rightBottom} /></div> : <div className="hidden md:block" />}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Main carousel                                                              */
/* -------------------------------------------------------------------------- */

function MainCarousel({ slides }: { slides: Banner[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start" },
    [Autoplay({ delay: 4000, playOnInit: false, stopOnInteraction: false, stopOnMouseEnter: true })]
  );
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setIdx(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    // Defer autoplay so its timer/reflows don't add main-thread work (TBT)
    // during the initial load + Lighthouse measurement window.
    const t = setTimeout(() => {
      const ap = emblaApi.plugins()?.autoplay as { play?: () => void } | undefined;
      ap?.play?.();
    }, 5000);
    return () => { emblaApi.off("select", onSelect); clearTimeout(t); };
  }, [emblaApi]);

  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);
  const prev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const next = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    // Fixed height (matches HeroCarouselSkeleton) so the hero never resizes when
    // banners load or slides change — avoids layout shift (CLS).
    <div className="relative h-[300px] overflow-hidden rounded-3xl shadow-[0_24px_60px_-20px_rgba(180,40,20,.45)] md:h-[480px] lg:h-[520px]">
      <div ref={emblaRef} className="h-full overflow-hidden">
        <div className="flex h-full">
          {slides.map((s, i) => (
            <SlideContent key={s.id} slide={s} active={i === idx} eager={i === 0} />
          ))}
        </div>
      </div>

      <button
        aria-label="Previous slide"
        onClick={prev}
        className="absolute left-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white shadow-lg backdrop-blur-md ring-1 ring-white/20 transition hover:bg-white/25"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        aria-label="Next slide"
        onClick={next}
        className="absolute right-3 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white shadow-lg backdrop-blur-md ring-1 ring-white/20 transition hover:bg-white/25"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/20 px-3 py-1.5 backdrop-blur-md ring-1 ring-white/15">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            aria-label={`Slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${i === idx ? "w-7 bg-white" : "w-1.5 bg-white/50 hover:bg-white/70"}`}
          />
        ))}
      </div>
    </div>
  );
}

function SlideContent({ slide, active, eager = false }: { slide: Banner; active: boolean; eager?: boolean }) {
  const Icon = lucideOrFallback(slide.icon_name);
  const hasImg = Boolean(slide.image_url);
  return (
    <div
      className={hasImg
        ? "relative flex h-full min-w-0 flex-[0_0_100%] flex-col justify-end overflow-hidden px-7 py-8 text-white md:justify-center md:px-14 md:py-12"
        : "relative flex h-full min-w-0 flex-[0_0_100%] flex-col justify-center overflow-hidden px-7 py-8 text-white md:px-14 md:py-12"}
      style={{ backgroundImage: bannerGradient(slide) }}
    >
      {slide.image_url && (
        <>
          <img
            src={slide.image_url}
            alt=""
            className="absolute inset-0 z-0 h-full w-full object-cover md:object-contain"
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : "auto"}
            decoding="async"
            referrerPolicy="no-referrer"
          />
          {(slide.eyebrow || slide.title || slide.highlight || slide.subtitle || slide.cta_label) && (
            <span className="absolute inset-0 z-0 bg-black/35" aria-hidden />
          )}
        </>
      )}
      <span className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" aria-hidden />
      <span className="pointer-events-none absolute -bottom-32 -left-12 h-72 w-72 rounded-full bg-black/15 blur-3xl" aria-hidden />
      <span className="pointer-events-none absolute right-10 top-10 h-20 w-20 rotate-12 rounded-3xl bg-white/10 ring-1 ring-white/20 md:h-28 md:w-28" aria-hidden />
      <span className="pointer-events-none absolute right-32 bottom-12 h-12 w-12 rounded-2xl bg-white/15 ring-1 ring-white/30" aria-hidden />
      <Icon className="pointer-events-none absolute -right-6 top-6 h-56 w-56 text-white/15 md:-right-2 md:top-4 md:h-80 md:w-80" strokeWidth={1.2} />

      <div
        className={`relative max-w-xl transition-all duration-500 ease-out ${active ? "opacity-100 translate-y-0" : "opacity-40 translate-y-2"}`}
      >
        {slide.eyebrow && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur-md ring-1 ring-white/20">
            <Sparkles className="h-3 w-3" /> {slide.eyebrow}
          </span>
        )}
        <h2 className="mt-4 text-3xl font-bold leading-[1.1] md:text-5xl lg:text-[3.2rem]">
          {slide.title}
          {slide.highlight && (
            <>
              {" "}
              <span className="bg-gradient-to-r from-amber-200 to-yellow-100 bg-clip-text text-transparent">
                {slide.highlight}
              </span>
            </>
          )}
        </h2>
        {slide.subtitle && <p className="mt-3 max-w-md text-sm opacity-90 md:mt-4 md:text-base">{slide.subtitle}</p>}
        {slide.cta_label && (
          <Link
            href={slide.cta_href ?? "#"}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-[#9a1e1e] shadow-[0_10px_30px_-12px_rgba(0,0,0,.45)] transition-transform hover:-translate-y-0.5 md:text-base"
          >
            {slide.cta_label} <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Side banners                                                               */
/* -------------------------------------------------------------------------- */

function SideTallBanner({ banner }: { banner: Banner }) {
  const Icon = lucideOrFallback(banner.icon_name);
  const hasImg = Boolean(banner.image_url);
  return (
    <Link
      href={banner.cta_href ?? "#"}
      className="group relative flex h-[200px] flex-col justify-end overflow-hidden rounded-3xl p-5 text-white shadow-[0_24px_60px_-20px_rgba(120,20,20,.45)] transition-transform hover:-translate-y-1 md:h-[480px] lg:h-[520px] md:p-6"
      style={{ backgroundImage: bannerGradient(banner) }}
    >
      {banner.image_url && (
        <>
          <img
            src={banner.image_url}
            alt=""
            className="absolute inset-0 z-0 h-full w-full object-cover md:object-contain"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            referrerPolicy="no-referrer"
          />
          {(banner.eyebrow || banner.title || banner.subtitle || banner.cta_label) && (
            <span className="absolute inset-0 z-0 bg-black/35" aria-hidden />
          )}
        </>
      )}
      <span className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden />
      <span className="pointer-events-none absolute top-10 right-6 h-14 w-14 rounded-2xl bg-white/10 ring-1 ring-white/15" aria-hidden />
      <Icon className="pointer-events-none absolute -top-4 -right-2 h-48 w-48 text-white/20 transition-transform group-hover:rotate-6" strokeWidth={1.1} />
      <div className="relative z-10 flex flex-col">
        {banner.eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-90">{banner.eyebrow}</p>}
        {banner.title && <h3 className="mt-2 text-2xl font-bold leading-tight md:text-3xl">{banner.title}</h3>}
        {banner.subtitle && <p className="mt-2 max-w-[18ch] text-sm opacity-90">{banner.subtitle}</p>}
        {banner.cta_label && (
          <span className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold backdrop-blur-md ring-1 ring-white/25 transition group-hover:bg-white/25">
            {banner.cta_label} <ChevronRight className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </Link>
  );
}

function SideShortBanner({ banner }: { banner: Banner }) {
  const Icon = lucideOrFallback(banner.icon_name);
  const hasImg = Boolean(banner.image_url);
  return (
    <Link
      href={banner.cta_href ?? "#"}
      className="group relative flex h-[200px] flex-col justify-end overflow-hidden rounded-3xl p-4 text-white shadow-[0_18px_40px_-16px_rgba(120,20,20,.45)] transition-transform hover:-translate-y-1 md:h-full md:p-5"
      style={{ backgroundImage: bannerGradient(banner) }}
    >
      {banner.image_url && (
        <>
          <img
            src={banner.image_url}
            alt=""
            className="absolute inset-0 z-0 h-full w-full object-cover md:object-contain"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
          {(banner.eyebrow || banner.title || banner.subtitle || banner.cta_label) && (
            <span className="absolute inset-0 z-0 bg-black/35" aria-hidden />
          )}
        </>
      )}
      <span className="pointer-events-none absolute -top-10 -right-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" aria-hidden />
      <Icon className="pointer-events-none absolute -top-2 -right-2 h-28 w-28 text-white/20 transition-transform group-hover:rotate-6" strokeWidth={1.2} />
      <div className="relative z-10 flex flex-col">
        {banner.eyebrow && <p className="text-[9px] font-semibold uppercase tracking-[0.18em] opacity-90">{banner.eyebrow}</p>}
        {banner.title && <h3 className="mt-1 text-lg font-bold leading-tight md:text-xl">{banner.title}</h3>}
        {banner.subtitle && <p className="mt-1 text-xs opacity-90">{banner.subtitle}</p>}
        {banner.cta_label && (
          <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold backdrop-blur-md ring-1 ring-white/25 transition group-hover:bg-white/25">
            {banner.cta_label} <ChevronRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Skeleton                                                                   */
/* -------------------------------------------------------------------------- */

export function HeroCarouselSkeleton() {
  return (
    <section className="w-full px-4 py-5">
      <div className="grid gap-4 md:grid-cols-[1.05fr_2.6fr_1.1fr]">
        <div className="h-[200px] animate-pulse rounded-3xl bg-[var(--mk-surface-3)] md:h-[480px] lg:h-[520px]" />
        <div className="h-[300px] animate-pulse rounded-3xl bg-[var(--mk-surface-3)] md:h-[480px] lg:h-[520px]" />
        <div className="grid gap-4 md:grid-rows-2">
          <div className="h-[200px] animate-pulse rounded-3xl bg-[var(--mk-surface-3)]" />
          <div className="hidden h-[200px] animate-pulse rounded-3xl bg-[var(--mk-surface-3)] md:block" />
        </div>
      </div>
    </section>
  );
}
