"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ShoppingCart, ArrowRight, Loader2 } from "lucide-react";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { cn } from "@/lib/utils";
import type { AdminDashboard } from "@/lib/admin-stats";

type Order = AdminDashboard["recent_orders"][number];

type Props = {
  rows: Order[];
  onLoadMore?: () => Promise<void> | void;
  hasMore?: boolean;
  loadingMore?: boolean;
};

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const STATUS_TONE: Record<string, string> = {
  pending:   "bg-amber-500/10 text-amber-500",
  paid:      "bg-emerald-500/10 text-emerald-500",
  shipped:   "bg-sky-500/10 text-sky-500",
  delivered: "bg-violet-500/10 text-violet-500",
  cancelled: "bg-rose-500/10 text-rose-500",
};

export function RecentOrders({ rows, onLoadMore, hasMore = false, loadingMore = false }: Props) {
  const sentinelRef = useRef<HTMLTableRowElement | null>(null);
  const scrollRef   = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!onLoadMore || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore) {
          void onLoadMore();
        }
      },
      { root: scrollRef.current, rootMargin: "60px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, loadingMore]);

  return (
    <LuxuryCard className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <ShoppingCart className="h-4 w-4" />
          </span>
          <p className="text-sm font-medium">Recent orders</p>
        </div>
        <Link href="/orders" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-brand">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
          No orders yet.
        </p>
      ) : (
        <div ref={scrollRef} className="max-h-[360px] overflow-y-auto rounded-lg border border-border/60 [scrollbar-width:thin]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Vendor</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-3 py-2.5 font-medium">#{r.id}</td>
                  <td className="px-3 py-2.5 truncate">{r.customer}</td>
                  <td className="hidden px-3 py-2.5 truncate text-muted-foreground md:table-cell">{r.vendor}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{fmtINR(r.total)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_TONE[r.status] ?? "bg-muted text-muted-foreground")}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {hasMore && (
                <tr ref={sentinelRef}>
                  <td colSpan={5} className="px-3 py-3 text-center text-xs text-muted-foreground">
                    {loadingMore ? (
                      <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</span>
                    ) : (
                      <span className="opacity-60">Scroll for more</span>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </LuxuryCard>
  );
}
