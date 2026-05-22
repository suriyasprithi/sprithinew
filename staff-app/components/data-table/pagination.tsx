"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  page: number;
  pageCount: number;
  onPageChange: (p: number) => void;
  total: number;
  pageSize: number;
};

export function Pagination({ page, pageCount, onPageChange, total, pageSize }: Props) {
  if (pageCount <= 1) {
    return (
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{total} record{total === 1 ? "" : "s"}</span>
      </div>
    );
  }
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">Showing {from}–{to} of {total}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-2/60 hover:bg-surface-2 disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {Array.from({ length: pageCount }).map((_, i) => {
          const p = i + 1;
          const active = p === page;
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                "h-8 min-w-8 rounded-lg px-2 text-xs font-medium",
                active ? "brand-gradient text-brand-foreground brand-glow" : "border border-border bg-surface-2/60 hover:bg-surface-2",
              )}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-2/60 hover:bg-surface-2 disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
