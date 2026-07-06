"use client";

import { useEffect, useMemo, useState } from "react";
import { Flame, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { readSavedLocation } from "./location-picker";
import { ProductCard, ProductCardSkeleton, type MarketplaceProduct } from "./product-card";

type FlashProduct = MarketplaceProduct & { flash_end: string };

type ApiFlash = {
  id: number;
  name: string;
  price: number | string;
  old_price?: number | string | null;
  image: string | null;
  vendor_name?: string | null;
  stock?: number | string | null;
  has_variants?: boolean;
  default_variant_id?: number | null;
  flash_end?: string | null;
  discount_percent?: number | string | null;
  savings?: number | string | null;
};

// One shared 1s ticker drives every countdown + the live expiry filter.
function useTick(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function FlashSale() {
  const [items, setItems] = useState<FlashProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const now = useTick(1000);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const loc = readSavedLocation();
      const params: Record<string, string> = {};
      if (loc?.taluk_id)         params.taluk_id    = String(loc.taluk_id);
      else if (loc?.district_id) params.district_id = String(loc.district_id);
      else if (loc?.state_id)    params.state_id    = String(loc.state_id);
      try {
        const r = await api.get("/public/flash-sale", { params });
        const rows = (r.data.data?.items ?? []) as ApiFlash[];
        setItems(
          rows
            .filter((p) => p.flash_end)
            .map((p): FlashProduct => ({
              id: Number(p.id),
              name: p.name,
              price: Number(p.price),
              old_price: p.old_price != null ? Number(p.old_price) : undefined,
              image: p.image,
              vendor_name: p.vendor_name ?? null,
              stock: p.stock != null ? Number(p.stock) : undefined,
              has_variants: !!p.has_variants,
              default_variant_id: p.default_variant_id ?? null,
              badge: "FLASH SALE",
              flash_end: String(p.flash_end),
            })),
        );
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
    if (typeof window !== "undefined") {
      const onChange = () => void load();
      window.addEventListener("epey-location-changed", onChange);
      return () => window.removeEventListener("epey-location-changed", onChange);
    }
  }, []);

  // Live: drop any product whose sale has ended; ending-soonest first; cap at 8.
  const active = useMemo(
    () =>
      items
        .filter((p) => new Date(p.flash_end).getTime() > now)
        .sort((a, b) => new Date(a.flash_end).getTime() - new Date(b.flash_end).getTime())
        .slice(0, 8),
    [items, now],
  );

  // Hide the whole section once nothing is on sale (but keep it during first load).
  if (!loading && active.length === 0) return null;

  const soonest = active.length ? new Date(active[0].flash_end).getTime() : 0;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-[var(--mk-brand)] to-[var(--mk-brand-deep)] p-1">
        <div className="rounded-[14px] bg-[var(--mk-surface)] p-4 md:p-6">
          {/* Header */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--mk-brand)] to-[var(--mk-brand-deep)] text-white shadow-md">
                <Flame className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mk-text-muted)]">Limited time</p>
                <h2 className="text-xl font-bold tracking-tight md:text-2xl">Flash sale</h2>
              </div>
            </div>

            {soonest > 0 && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--mk-brand)]" />
                <span className="text-xs font-medium text-[var(--mk-text-muted)]">Ends in</span>
                <Countdown endMs={soonest} now={now} />
              </div>
            )}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : active.map((p) => (
                  <ProductCard key={p.id} product={p} flashEndMs={new Date(p.flash_end).getTime()} />
                ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Countdown({ endMs, now }: { endMs: number; now: number }) {
  const diff = Math.max(0, endMs - now);
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="flex items-center gap-1">
      {d > 0 && (
        <>
          <Pill>{pad(d)}d</Pill>
          <Sep />
        </>
      )}
      <Pill>{pad(h)}</Pill>
      <Sep />
      <Pill>{pad(m)}</Pill>
      <Sep />
      <Pill>{pad(s)}</Pill>
    </div>
  );
}

function Sep() {
  return <span className="font-bold text-[var(--mk-text)]">:</span>;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 min-w-8 items-center justify-center rounded-md bg-[var(--mk-brand)] px-1.5 font-mono text-xs font-bold text-white">
      {children}
    </span>
  );
}
