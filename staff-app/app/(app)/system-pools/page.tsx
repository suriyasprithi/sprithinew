"use client";

import { useEffect, useState } from "react";
import { PiggyBank, Gift } from "lucide-react";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { AnimatedCounter } from "@/components/ui/custom/animated-counter";
import { Shimmer } from "@/components/ui/custom/shimmer";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { mock, type SystemPool } from "@/lib/mock";
import { cn } from "@/lib/utils";

const fmtINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

export default function SystemPoolsPage() {
  const [pools, setPools] = useState<SystemPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [welcome, setWelcome] = useState({ count: 0, total: 0 });

  useEffect(() => {
    void (async () => {
      setPools(await mock.systemPools());
      setWelcome({ count: 14, total: 210 });
      setLoading(false);
    })();
  }, []);

  return (
    <>
      <MobileHeader title="System pools" />
      <section className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Finance"
          icon={PiggyBank}
          title="System pools"
          description="All system-wide balances and aggregates."
        />

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="luxe-card p-6 space-y-3">
                <Shimmer className="h-4 w-32" />
                <Shimmer className="h-8 w-40" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pools.map((p) => (
              <LuxuryCard key={p.pool_key} className="p-6">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{p.pool_key}</p>
                <p className={cn("mt-2 text-3xl font-semibold tracking-tight", p.balance < 0 ? "text-rose-400" : "text-emerald-400")}>
                  <AnimatedCounter value={p.balance} format={fmtINR} />
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.balance < 0 ? "Bonuses paid out exceed receipts" : "Healthy balance"}
                </p>
              </LuxuryCard>
            ))}

            <LuxuryCard className="p-6 sm:col-span-2">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <Gift className="h-6 w-6" />
                </span>
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Welcome bonuses paid</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">
                    <AnimatedCounter value={welcome.count} /> <span className="text-base font-normal text-muted-foreground">bonuses</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Total value: <span className="font-semibold text-emerald-400">{fmtINR(welcome.total)}</span> · Derived from <code className="rounded bg-surface-2 px-1 py-0.5 text-[10px]">wallet_transactions</code>
                  </p>
                </div>
              </div>
            </LuxuryCard>
          </div>
        )}
      </section>
    </>
  );
}
