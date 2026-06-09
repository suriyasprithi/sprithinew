"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wallet as WalletIcon, Banknote, Clock, Sparkles, Users, Loader2, QrCode, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { AnimatedCounter } from "@/components/ui/custom/animated-counter";
import { EmptyState } from "@/components/data-table/empty-state";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/stores/auth";
import { api, apiErrorMessage } from "@/lib/api";

type PoolMonth = {
  id: number;
  period: string;
  collected: number;
  distributed: number;
  eligible_count: number;
  per_user_amount: number;
  distributed_at: string | null;
};
type PoolPayload = {
  current_balance: number;
  total_collected: number;
  total_distributed: number;
  months: PoolMonth[];
};

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

const periodLabel = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  if (!y || !m) return p;
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "short", year: "numeric" });
};

export default function StaffWalletPage() {
  const { user, hydrate } = useAuth();
  const isAdmin = user?.role === "admin";
  const isVendor = user?.role === "vendor";

  const [pool, setPool] = useState<PoolPayload | null>(null);
  const [loadingPool, setLoadingPool] = useState(false);

  // Vendor QR wallet → main wallet transfer
  const qrBalance = user?.qr_wallet ?? 0;
  const [xferAmount, setXferAmount] = useState("");
  const [xferBusy, setXferBusy] = useState(false);

  async function transferToMain() {
    const amt = Number(xferAmount);
    if (!amt || amt <= 0) { toast.error("Enter an amount"); return; }
    if (amt > qrBalance) { toast.error("Amount exceeds QR wallet balance"); return; }
    setXferBusy(true);
    try {
      await api.post("/wallet/transfer", { from: "qr", to: "wallet", amount: amt });
      toast.success(`₹${amt} moved to main wallet`);
      setXferAmount("");
      await hydrate(); // refresh balances from /auth/me
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setXferBusy(false); }
  }

  useEffect(() => {
    if (!isAdmin) return;
    setLoadingPool(true);
    void (async () => {
      try {
        const res = await api.get("/admin/wallet/global-pool");
        setPool(res.data.data as PoolPayload);
      } catch (e) { toast.error(apiErrorMessage(e)); }
      finally { setLoadingPool(false); }
    })();
  }, [isAdmin]);

  return (
    <>
      <MobileHeader title="Wallet" />
      <section className="mx-auto max-w-4xl space-y-5 p-4 pb-24 md:p-8">
        <PageHeader
          eyebrow="Finance"
          icon={WalletIcon}
          title="Wallet"
          description={isAdmin ? "Your earnings, plus the platform's global pool." : "Your earnings balance and transaction history."}
        />

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <LuxuryCard glow hoverLift={false} className="relative overflow-hidden brand-gradient p-6 text-brand-foreground">
            <div className="absolute inset-0 brand-gradient-soft opacity-40" />
            <div className="relative space-y-3">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider opacity-80">
                <Banknote className="h-4 w-4" /> Wallet balance
              </p>
              <p className="text-4xl font-bold tracking-tight md:text-5xl">
                <AnimatedCounter value={user?.wallet_balance ?? 0} format={fmtINR} />
              </p>
            </div>
          </LuxuryCard>
        </motion.div>

        {/* Vendor QR wallet — in-store QR sales land here; transfer to main to spend */}
        {isVendor && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <LuxuryCard hoverLift={false} className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                    <QrCode className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[15px] font-bold">QR wallet</p>
                    <p className="text-xs text-muted-foreground">In-store QR sales land here. Transfer to your main wallet to spend or withdraw.</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tracking-tight">
                    <AnimatedCounter value={qrBalance} format={fmtINR} />
                  </p>
                </div>
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <label htmlFor="xfer" className="text-xs font-medium text-muted-foreground">Amount to move</label>
                  <Input
                    id="xfer"
                    type="number"
                    inputMode="decimal"
                    value={xferAmount}
                    onChange={(e) => setXferAmount(e.target.value)}
                    placeholder="0"
                    className="h-11 rounded-xl"
                    disabled={xferBusy || qrBalance <= 0}
                  />
                </div>
                <Button
                  type="button"
                  className="h-11 rounded-xl"
                  onClick={() => setXferAmount(String(qrBalance))}
                  variant="outline"
                  disabled={xferBusy || qrBalance <= 0}
                >
                  All
                </Button>
                <Button
                  type="button"
                  className="h-11 rounded-xl"
                  onClick={() => void transferToMain()}
                  disabled={xferBusy || qrBalance <= 0}
                >
                  {xferBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowRightLeft className="h-4 w-4" /> Transfer</>}
                </Button>
              </div>
            </LuxuryCard>
          </motion.div>
        )}

        {/* Sub-wallet breakdown — global, monthly, referral, etc. (hidden for vendors) */}
        {!isVendor && (() => {
          const breakdown = [
            { label: "Global wallet",   value: user?.global_wallet  ?? 0 },
            { label: "Monthly wallet",  value: user?.monthly_wallet ?? 0 },
            { label: "Lucky wallet",    value: user?.lucky_wallet   ?? 0 },
            { label: "Referral wallet", value: (user?.level_wallet ?? 0) + (user?.level_1_wallet ?? 0) + (user?.level_2_wallet ?? 0) + (user?.level_3_wallet ?? 0) },
            { label: "Buyback wallet",  value: user?.buyback_wallet ?? 0 },
          ];
          return (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <LuxuryCard hoverLift={false} className="p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallet breakdown</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {breakdown.map((w) => (
                    <div key={w.label} className="rounded-xl bg-surface-2/50 p-3">
                      <p className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">{w.label}</p>
                      <p className="mt-1 text-base font-bold tracking-tight">{fmtINR(w.value)}</p>
                    </div>
                  ))}
                </div>
              </LuxuryCard>
            </motion.div>
          );
        })()}

        {/* Admin-only: global pool snapshot + monthly history */}
        {isAdmin && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div
              className="rounded-[20px] border p-5"
              style={{
                background: "linear-gradient(135deg,#ffffff 0%,#fff7ed 100%)",
                borderColor: "rgba(245,158,11,0.18)",
                boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset, 0 6px 18px -10px rgba(15,23,42,0.10)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fef3c7] text-[#b45309]">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[15px] font-bold text-[#111827]">Global pool</p>
                    <p className="text-xs text-[#6b7280]">2.5% of every order accumulates here; distributed monthly to all eligible customers.</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[28px] font-bold leading-none tracking-tight text-[#111827]">
                    <AnimatedCounter value={pool?.current_balance ?? 0} format={fmtINR} />
                  </p>
                  <p className="mt-1 text-[11px] text-[#6b7280]">Awaiting distribution</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl bg-white/70 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-[#6b7280]">Total collected (last 12 mo.)</p>
                  <p className="mt-1 text-base font-bold text-[#111827]">{fmtINR(pool?.total_collected ?? 0)}</p>
                </div>
                <div className="rounded-xl bg-white/70 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-[#6b7280]">Total distributed</p>
                  <p className="mt-1 text-base font-bold text-emerald-600">{fmtINR(pool?.total_distributed ?? 0)}</p>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-xl border border-black/5 bg-white/70">
                {loadingPool ? (
                  <div className="flex items-center justify-center gap-2 p-6 text-xs text-[#6b7280]">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : !pool || pool.months.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#6b7280]">No monthly pool history yet.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-black/[0.025] text-left text-[11px] uppercase tracking-wider text-[#6b7280]">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Month</th>
                        <th className="px-3 py-2 font-semibold">Collected</th>
                        <th className="hidden px-3 py-2 font-semibold sm:table-cell">Distributed</th>
                        <th className="hidden px-3 py-2 font-semibold md:table-cell">
                          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> Recipients</span>
                        </th>
                        <th className="px-3 py-2 text-right font-semibold">Per user</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {pool.months.map((m) => {
                        const isDistributed = m.distributed > 0 && m.distributed_at;
                        return (
                          <tr key={m.id} className="transition-colors hover:bg-black/[0.025]">
                            <td className="px-3 py-2.5 font-medium text-[#111827]">{periodLabel(m.period)}</td>
                            <td className="px-3 py-2.5">{fmtINR(m.collected)}</td>
                            <td className="hidden px-3 py-2.5 sm:table-cell">
                              <span className={isDistributed ? "text-emerald-600 font-medium" : "text-[#6b7280]"}>
                                {fmtINR(m.distributed)}
                              </span>
                              {!isDistributed && <span className="ml-1 text-[11px] text-amber-600">pending</span>}
                            </td>
                            <td className="hidden px-3 py-2.5 md:table-cell">{m.eligible_count || "—"}</td>
                            <td className="px-3 py-2.5 text-right font-medium">{m.per_user_amount ? fmtINR(m.per_user_amount) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </motion.div>
        )}

        <LuxuryCard hoverLift={false} className="p-3">
          <EmptyState
            icon={Clock}
            title="Transaction history coming soon"
            description="Wallet history will appear here once Phase 4 backend lands."
          />
        </LuxuryCard>
      </section>
    </>
  );
}
