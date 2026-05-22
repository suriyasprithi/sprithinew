"use client";

import { useEffect, useState } from "react";
import { Flame, Clock } from "lucide-react";
import { ProductCard, ProductCardSkeleton, type MarketplaceProduct } from "./product-card";

function useCountdown(endTs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, endTs - now);
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return { h, m, s, done: diff === 0 };
}

export function FlashSale({ products, loading }: { products: MarketplaceProduct[]; loading?: boolean }) {
  // End 4 hours from initial mount — stable enough for static export.
  const [endTs] = useState(() => Date.now() + 4 * 60 * 60 * 1000);
  const { h, m, s } = useCountdown(endTs);

  const items = products.slice(0, 8);

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

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[var(--mk-brand)]" />
              <span className="text-xs font-medium text-[var(--mk-text-muted)]">Ends in</span>
              <Pill>{String(h).padStart(2, "0")}</Pill>
              <span className="font-bold text-[var(--mk-text)]">:</span>
              <Pill>{String(m).padStart(2, "0")}</Pill>
              <span className="font-bold text-[var(--mk-text)]">:</span>
              <Pill>{String(s).padStart(2, "0")}</Pill>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : items.map((p, i) => (
                  <ProductCard
                    key={p.id}
                    product={{
                      ...p,
                      badge: i % 2 === 0 ? "TRENDING" : "20% OFF",
                      old_price: p.old_price ?? Math.round(p.price * 1.25),
                      stock: p.stock ?? (i === 0 ? 3 : undefined),
                    }}
                  />
                ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 min-w-8 items-center justify-center rounded-md bg-[var(--mk-brand)] px-1.5 font-mono text-xs font-bold text-white">
      {children}
    </span>
  );
}
