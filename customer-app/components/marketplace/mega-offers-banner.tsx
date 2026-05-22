"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight, ShoppingCart, BadgeCheck, ShieldCheck, Truck, Award,
  Watch, Headphones, Speaker, Smartphone, Tv, Camera, Tablet,
  Wallet, RotateCcw, Lock, Headset,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Banner } from "@/lib/banners";
import { bannerGradient } from "@/lib/banners";
import { lucideOrFallback } from "@/lib/lucide-registry";

const TRUST_BADGES = [
  { label: "Premium Quality",      Icon: Award },
  { label: "Best Prices",          Icon: BadgeCheck },
  { label: "Trusted by Thousands", Icon: ShieldCheck },
  { label: "Fast Delivery",        Icon: Truck },
];

const FOOTER_ITEMS = [
  { label: "Cash on Delivery", sub: "Pay when you receive", Icon: Wallet },
  { label: "Easy Returns",     sub: "Hassle-free return",   Icon: RotateCcw },
  { label: "Secure Payments",  sub: "100% safe & secure",   Icon: Lock },
  { label: "24/7 Support",     sub: "We're here for you",   Icon: Headset },
];

// Fallback icon clusters when image_url is absent. Picked by slot.
const ORANGE_CLUSTER: LucideIcon[] = [Watch, Speaker, Headphones, Smartphone];
const PURPLE_CLUSTER: LucideIcon[] = [Tv, Tablet, Camera, Watch];

export function MegaOffersBanner({
  left, right,
}: {
  left?: Banner | null;
  right?: Banner | null;
}) {
  if (!left && !right) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden rounded-3xl shadow-[0_24px_60px_-24px_rgba(20,20,20,.5)]"
      >
        <div className="flex flex-col items-start justify-between gap-3 bg-[#2c2c33] px-6 py-4 text-white sm:flex-row sm:items-center">
          <h2 className="text-lg font-bold uppercase tracking-[0.18em] md:text-2xl">Online Shopping</h2>
          <div className="flex items-center gap-4">
            <p className="text-xs text-white/80 md:text-sm">
              Big Sale Up To <span className="font-bold text-white">50% OFF</span>
            </p>
            <Link
              href="/shop-public"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#ff5e2d]/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#ff7a45] transition hover:bg-[#ff5e2d]/15"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-px bg-[#2c2c33] md:grid-cols-2">
          {left && <MegaBanner banner={left} cluster={ORANGE_CLUSTER} ribbon="BEST DEALS" />}
          {right && <MegaBanner banner={right} cluster={PURPLE_CLUSTER} ribbon="TOP PICKS" />}
        </div>
      </motion.div>
    </section>
  );
}

function MegaBanner({
  banner, cluster, ribbon,
}: {
  banner: Banner;
  cluster: LucideIcon[];
  ribbon: string;
}) {
  const BrandIcon = lucideOrFallback(banner.icon_name, ShoppingCart);
  return (
    <div className="relative overflow-hidden p-6 text-white sm:p-8" style={{ backgroundImage: bannerGradient(banner) }}>
      <span className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" aria-hidden />
      <span className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-black/40 blur-3xl" aria-hidden />

      <div className="relative flex items-start justify-between">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold tracking-wider">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-white/15">
            <BrandIcon className="h-3.5 w-3.5 text-white" />
          </span>
          EPEY
          <span className="ml-2 text-[9px] font-medium tracking-widest opacity-70">SMART CHOICES, BETTER LIVING</span>
        </span>
        <span className="hidden rounded-bl-2xl bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white ring-1 ring-white/30 sm:inline-block">
          ★ {ribbon} ★
        </span>
      </div>

      <div className="relative mt-4 grid grid-cols-1 items-center gap-5 sm:grid-cols-[1.2fr_1fr]">
        <div>
          {banner.eyebrow && <p className="text-xs font-medium uppercase tracking-[0.2em] opacity-80">{banner.eyebrow}</p>}
          {banner.title && (
            <h3 className="mt-1.5 text-3xl font-extrabold leading-[0.95] tracking-tight text-white md:text-5xl">
              {banner.title}
            </h3>
          )}
          {banner.highlight && (
            <div className="mt-3 inline-flex rounded-md bg-black/30 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ring-1 ring-white/15 backdrop-blur-sm">
              {banner.highlight}
            </div>
          )}

          <div className="mt-5 grid grid-cols-4 gap-2">
            {TRUST_BADGES.map((b) => {
              const Icon = b.Icon;
              return (
                <div key={b.label} className="flex flex-col items-center text-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="mt-1.5 text-[9px] font-semibold uppercase leading-tight tracking-wider opacity-90">{b.label}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-center gap-4">
            {banner.cta_label && (
              <Link
                href={banner.cta_href ?? "#"}
                className="inline-flex items-center gap-2 rounded-full bg-white/20 px-5 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-lg ring-1 ring-white/25 transition hover:-translate-y-0.5 hover:bg-white/30"
              >
                <ShoppingCart className="h-4 w-4" /> {banner.cta_label}
                <span className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20"><ArrowRight className="h-3.5 w-3.5" /></span>
              </Link>
            )}
            <div className="text-xs">
              <p className="opacity-70">Starting at</p>
              <p className="text-xl font-bold">₹199</p>
            </div>
          </div>
        </div>

        <div className="relative flex h-44 items-center justify-center sm:h-56">
          {banner.subtitle && (
            <div className="absolute -top-2 right-0 z-20 flex h-20 w-20 -rotate-12 items-center justify-center rounded-full bg-[#ff4d1c] px-2 text-center text-white shadow-[0_10px_28px_-8px_rgba(255,77,28,.7)] ring-4 ring-white/20 sm:h-24 sm:w-24">
              <p className="text-[10px] font-extrabold uppercase leading-tight tracking-wider">{banner.subtitle}</p>
            </div>
          )}

          {banner.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={banner.image_url}
              alt=""
              className="relative z-10 max-h-full max-w-full object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,.4)]"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="relative z-10 grid grid-cols-2 gap-3">
              {cluster.map((Icon, i) => (
                <span
                  key={i}
                  className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 shadow-xl ring-1 ring-white/20 backdrop-blur-sm sm:h-20 sm:w-20"
                  style={{ transform: `translateY(${(i % 2) * 8 - 4}px)` }}
                >
                  <Icon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.5} />
                </span>
              ))}
            </div>
          )}
          <span className="pointer-events-none absolute bottom-2 left-1/2 h-6 w-44 -translate-x-1/2 rounded-full bg-black/60 blur-xl" aria-hidden />
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-3 rounded-xl bg-black/30 p-3 ring-1 ring-white/10 backdrop-blur-sm sm:grid-cols-4">
        {FOOTER_ITEMS.map((f) => {
          const Icon = f.Icon;
          return (
            <div key={f.label} className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[11px] font-bold uppercase tracking-wider">{f.label}</p>
                <p className="truncate text-[9px] opacity-70">{f.sub}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
