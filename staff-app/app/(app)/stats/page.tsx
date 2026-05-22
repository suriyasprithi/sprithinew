"use client";

import { useEffect, useState } from "react";
import { BarChart3, Users, Store, ShoppingCart, Banknote, CreditCard, Wallet, type LucideIcon } from "lucide-react";
import { Shimmer } from "@/components/ui/custom/shimmer";
import { StatCard, type StatTone } from "@/components/dashboard/stat-card";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { mock, type StaffStats } from "@/lib/mock";

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

type Tile = { label: string; value: number; icon: LucideIcon; tone: StatTone; spark: number[]; format?: (v: number) => string };

const SPARKS = {
  up: [3, 4, 5, 5, 6, 7, 7, 8],
  wave: [4, 6, 5, 7, 5, 8, 6, 9],
  flat: [3, 3, 3, 3, 3, 3, 3, 3],
};

export default function StatsPage() {
  const [s, setS] = useState<StaffStats>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setS(await mock.stats("admin"));
      setLoading(false);
    })();
  }, []);

  const tiles: Tile[] = [
    { label: "Total customers",    value: s.customers ?? 0,            icon: Users,        tone: "brand",   spark: SPARKS.up },
    { label: "Total vendors",      value: s.vendors ?? 0,              icon: Store,        tone: "emerald", spark: SPARKS.up },
    { label: "Today's orders",     value: s.todays_orders ?? 0,        icon: ShoppingCart, tone: "amber",   spark: SPARKS.wave },
    { label: "Today's revenue",    value: s.todays_revenue ?? 0,       icon: Banknote,     tone: "violet",  spark: SPARKS.up, format: fmtINR },
    { label: "Pending top-ups",    value: s.pending_payments ?? 0,     icon: CreditCard,   tone: "pink",    spark: SPARKS.flat },
    { label: "Pending withdrawals",value: s.pending_withdrawals ?? 0,  icon: Wallet,       tone: "cyan",    spark: SPARKS.flat },
  ];

  return (
    <>
      <MobileHeader title="Stats" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 pb-24 md:p-8">
        <PageHeader
          eyebrow="Overview"
          icon={BarChart3}
          title="Stats"
          description="Platform-wide metrics at a glance."
        />

        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="luxe-card p-5">
                <Shimmer className="h-10 w-10 rounded-xl" />
                <div className="mt-4 space-y-2">
                  <Shimmer className="h-3 w-20" />
                  <Shimmer className="h-7 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tiles.map((t) => (
              <StatCard key={t.label} label={t.label} value={t.value} icon={t.icon} tone={t.tone} spark={t.spark} format={t.format} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
