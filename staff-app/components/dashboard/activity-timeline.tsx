"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { cn } from "@/lib/utils";

type Row = { name: string; sub: string; amount?: string; delta?: number };

type Props = {
  title: string;
  rows: Row[];
  /** When defined + hasMore=true, the widget fires this when the bottom sentinel scrolls into view. */
  onLoadMore?: () => Promise<void> | void;
  hasMore?: boolean;
  loadingMore?: boolean;
};

export function ActivityTimeline({ title, rows, onLoadMore, hasMore = false, loadingMore = false }: Props) {
  const sentinelRef = useRef<HTMLLIElement | null>(null);

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
      { root: el.parentElement, rootMargin: "60px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, loadingMore]);

  return (
    <LuxuryCard className="p-5">
      <p className="mb-3 text-sm font-medium">{title}</p>
      <ul className="max-h-[360px] space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
        {rows.map((r, i) => (
          <motion.li
            key={`${r.name}-${i}`}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i, 7) * 0.04 }}
            className="relative flex items-center gap-3 py-2.5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-xs font-semibold text-brand">
              {r.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.name}</p>
              <p className="truncate text-xs text-muted-foreground">{r.sub}</p>
            </div>
            <div className="text-right">
              {r.amount && <p className="text-sm font-medium">{r.amount}</p>}
              {typeof r.delta === "number" && (
                <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium",
                  r.delta >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {r.delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(r.delta).toFixed(1)}%
                </span>
              )}
            </div>
          </motion.li>
        ))}

        {/* Sentinel — when scrolled into view AND hasMore, the IntersectionObserver
            above fires onLoadMore. Renders a thin loader so users see something. */}
        {hasMore && (
          <li ref={sentinelRef} className="flex items-center justify-center py-3 text-xs text-muted-foreground">
            {loadingMore ? (
              <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</span>
            ) : (
              <span className="opacity-60">Scroll for more</span>
            )}
          </li>
        )}
      </ul>
    </LuxuryCard>
  );
}
