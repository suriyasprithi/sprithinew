"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles, Wallet as WalletIcon, Users } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { AnimatedCounter } from "@/components/ui/custom/animated-counter";
import { api, apiErrorMessage } from "@/lib/api";

type Item = {
  id: number;
  period: string;
  amount: number;
  pool_collected: number;
  pool_distributed: number;
  eligible_count: number;
  per_user_amount: number;
  created_at: string;
};

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

const periodLabel = (p: string) => {
  // p is "YYYY-MM" — turn into "Jan 2026"
  const [y, m] = p.split("-").map(Number);
  if (!y || !m) return p;
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "short", year: "numeric" });
};

export default function GlobalHistoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/wallet/global-history");
        setItems((res.data.data?.items ?? []) as Item[]);
        setTotal(Number(res.data.data?.total ?? 0));
      } catch (e) { toast.error(apiErrorMessage(e)); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <>
      <AppHeader title="Global pool history" />
      <section className="mx-auto max-w-md space-y-4 p-4 pb-24 md:max-w-3xl md:p-8">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <LuxuryCard hoverLift={false} glow className="relative overflow-hidden p-6 brand-gradient text-brand-foreground">
            <div className="absolute inset-0 brand-gradient-soft opacity-40" />
            <div className="relative space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider opacity-80">Total credited from global pool</p>
                <Sparkles className="h-5 w-5 opacity-80" />
              </div>
              <p className="text-3xl font-bold tracking-tight md:text-4xl">
                <AnimatedCounter value={total} format={fmtINR} />
              </p>
              <p className="text-xs opacity-80">
                Across {items.length} {items.length === 1 ? "month" : "months"}
              </p>
            </div>
          </LuxuryCard>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <LuxuryCard hoverLift={false} className="p-10 text-center">
            <Sparkles className="mx-auto mb-3 h-10 w-10 text-brand" />
            <p className="text-sm font-medium">No global pool credits yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Stay active — distributions land on the first of each month.
            </p>
          </LuxuryCard>
        ) : (
          <div className="space-y-2">
            {items.map((it, i) => (
              <motion.div
                key={it.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <LuxuryCard className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{periodLabel(it.period)}</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Users className="h-3 w-3" /> Pool split between {it.eligible_count} eligible users
                      </p>
                    </div>
                    <p className="shrink-0 text-base font-bold text-brand">+{fmtINR(it.amount)}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-3">
                    <span><WalletIcon className="mr-1 inline h-3 w-3" />Pool collected · {fmtINR(it.pool_collected)}</span>
                    <span>Per user · {fmtINR(it.per_user_amount)}</span>
                    <span>Distributed · {fmtINR(it.pool_distributed)}</span>
                  </div>
                </LuxuryCard>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
