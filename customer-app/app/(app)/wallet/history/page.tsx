"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Loader2, Sparkles, Wallet as WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { AnimatedCounter } from "@/components/ui/custom/animated-counter";
import { api, apiErrorMessage } from "@/lib/api";

type Item = {
  id: number;
  amount: number;
  direction: "credit" | "debit";
  type: string;
  reference: string | null;
  notes: string;
  created_at: string;
};

type Payload = {
  wallet: string;
  balance: number;
  total_credit: number;
  total_debit: number;
  items: Item[];
};

const LABELS: Record<string, string> = {
  wallet:  "Main wallet",
  monthly: "Monthly wallet",
  level:   "Level wallet",
  level_1: "Level 1 wallet",
  level_2: "Level 2 wallet",
  level_3: "Level 3 wallet",
  global:  "Global wallet",
  buyback: "Buyback wallet",
};

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

export default function WalletHistoryPage() {
  return (
    <Suspense fallback={<><AppHeader title="History" /><div className="flex items-center justify-center p-10 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div></>}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const sp = useSearchParams();
  const wallet = (sp?.get("wallet") ?? "wallet").trim();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/wallet/history", { params: { wallet } });
        setData(res.data.data as Payload);
      } catch (e) { toast.error(apiErrorMessage(e)); }
      finally { setLoading(false); }
    })();
  }, [wallet]);

  const title = LABELS[wallet] ?? "Wallet history";

  return (
    <>
      <AppHeader title={title} />
      <section className="mx-auto max-w-md space-y-4 p-4 pb-24 md:max-w-3xl md:p-8">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <LuxuryCard hoverLift={false} glow className="relative overflow-hidden p-6 brand-gradient text-brand-foreground">
            <div className="absolute inset-0 brand-gradient-soft opacity-40" />
            <div className="relative space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider opacity-80">{title} balance</p>
                <WalletIcon className="h-5 w-5 opacity-80" />
              </div>
              <p className="text-3xl font-bold tracking-tight md:text-4xl">
                <AnimatedCounter value={data?.balance ?? 0} format={fmtINR} />
              </p>
              <div className="flex flex-wrap gap-3 pt-1 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 backdrop-blur">
                  <ArrowDownLeft className="h-3 w-3" /> Credited {fmtINR(data?.total_credit ?? 0)}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 backdrop-blur">
                  <ArrowUpRight className="h-3 w-3" /> Debited {fmtINR(data?.total_debit ?? 0)}
                </span>
              </div>
            </div>
          </LuxuryCard>
        </motion.div>

        {(wallet === "level" || wallet === "buyback" || wallet === "global") && (
          <Link
            href={`/wallet/transfer?from=${wallet}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-xs font-semibold text-brand transition-colors hover:bg-brand/15"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" /> Transfer to main
          </Link>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !data || data.items.length === 0 ? (
          <LuxuryCard hoverLift={false} className="p-10 text-center">
            <Sparkles className="mx-auto mb-3 h-10 w-10 text-brand" />
            <p className="text-sm font-medium">No {title.toLowerCase()} activity yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Movements into this wallet will appear here.
            </p>
          </LuxuryCard>
        ) : (
          <div className="space-y-2">
            {data.items.map((it, i) => (
              <motion.div
                key={it.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <LuxuryCard className="flex items-center gap-3 p-3">
                  <span className={
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg " +
                    (it.direction === "credit"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-rose-500/10 text-rose-500")
                  }>
                    {it.direction === "credit" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {it.notes || it.type}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {it.created_at}{it.reference ? ` · ${it.reference}` : ""}
                    </p>
                  </div>
                  <p className={
                    "shrink-0 text-sm font-bold " +
                    (it.direction === "credit" ? "text-emerald-500" : "text-rose-500")
                  }>
                    {it.direction === "credit" ? "+" : "−"}{fmtINR(it.amount)}
                  </p>
                </LuxuryCard>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
