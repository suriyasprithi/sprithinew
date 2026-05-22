"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Store, ArrowRight } from "lucide-react";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { cn } from "@/lib/utils";
import type { AdminDashboard } from "@/lib/admin-stats";

type Vendor = AdminDashboard["latest_vendors"][number];

export function LatestVendors({ rows }: { rows: Vendor[] }) {
  return (
    <LuxuryCard className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Store className="h-4 w-4" />
          </span>
          <p className="text-sm font-medium">Latest vendors</p>
        </div>
        <Link href="/manage-vendors" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-brand">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
          No vendors yet.
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.map((v, i) => {
            const initial = v.name.charAt(0).toUpperCase();
            const active = v.status === "active";
            return (
              <motion.li
                key={v.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 py-2"
              >
                {v.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.image} alt={v.name} className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-sm font-semibold text-brand">
                    {initial}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{v.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{v.category ?? "Uncategorised"}</p>
                </div>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium",
                  active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>
                  {v.status}
                </span>
              </motion.li>
            );
          })}
        </ul>
      )}
    </LuxuryCard>
  );
}
