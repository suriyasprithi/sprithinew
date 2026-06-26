"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Wallet as WalletIcon, Banknote, Clock, Sparkles, Users, Loader2, QrCode, ArrowDownLeft, ShieldCheck, ShieldAlert, Plus } from "lucide-react";
import { toast } from "sonner";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { AnimatedCounter } from "@/components/ui/custom/animated-counter";
import { EmptyState } from "@/components/data-table/empty-state";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { QrTransferButton } from "@/components/qr-transfer-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  // 1 token = ₹1 — tokens are spendable/withdrawable, so show them folded into
  // the wallet balance. State/district/taluk/vendor must keep a ₹2,500 floor
  // (withdrawal only; token distribute/approve ignores it).
  const combined = (user?.token_balance ?? 0) + (user?.wallet_balance ?? 0);
  const hasFloor = ["state", "district", "taluk", "vendor"].includes(user?.role ?? "");
  const withdrawable = Math.max(0, combined - 2500);

  const [pool, setPool] = useState<PoolPayload | null>(null);
  const [loadingPool, setLoadingPool] = useState(false);

  // Vendor QR wallet balance. One Transfer button moves the whole QR wallet to
  // the main wallet (no more per-purchase transfers).
  const qrBalance = user?.qr_wallet ?? 0;

  // Refresh balances from /auth/me on mount — the auth store can be stale after
  // purchases/transfers done on other pages, which made the wallet figures here
  // disagree with the (always-live) dashboard.
  useEffect(() => { void hydrate?.(); }, [hydrate]);

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

  // Main-wallet transaction history (all roles).
  type Txn = { id: number; amount: number; direction: "credit" | "debit"; type: string; notes: string; created_at: string };
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(true);
  async function loadHistory() {
    setLoadingTxns(true);
    try {
      const res = await api.get("/wallet/history", { params: { wallet: "wallet" } });
      setTxns((res.data.data?.items ?? []) as Txn[]);
    } catch { /* ignore */ } finally { setLoadingTxns(false); }
  }
  useEffect(() => { void loadHistory(); }, []);

  // Admin manual top-up.
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmt, setTopupAmt] = useState("");
  const [topupBusy, setTopupBusy] = useState(false);
  async function submitTopup() {
    const amt = Number(topupAmt);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    setTopupBusy(true);
    try {
      await api.post("/admin/wallet/topup", { amount: amt });
      toast.success(`Added ${fmtINR(amt)} to your wallet`);
      setTopupOpen(false); setTopupAmt("");
      await hydrate?.();
      await loadHistory();
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setTopupBusy(false); }
  }

  // Admin global-pool distribution (per month).
  const [distBusy, setDistBusy] = useState<string | null>(null);
  async function distributeGlobal(period: string) {
    setDistBusy(period);
    try {
      const res = await api.post("/admin/global/distribute", { period });
      const d = res.data.data as { recipients: number; per_user: number };
      toast.success(`Distributed ${fmtINR(d.per_user)} to ${d.recipients} customer(s)`);
      const pr = await api.get("/admin/wallet/global-pool");
      setPool(pr.data.data as PoolPayload);
      await hydrate?.();
      await loadHistory();
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setDistBusy(null); }
  }

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
                <AnimatedCounter value={combined} format={fmtINR} />
              </p>
              {hasFloor && (
                <p className="text-xs opacity-80">
                  Keep ₹2,500 minimum · Withdrawable {fmtINR(withdrawable)}
                </p>
              )}
            </div>
          </LuxuryCard>
        </motion.div>

        {/* Admin: manually top up the main wallet */}
        {isAdmin && (
          <div className="flex justify-end">
            <Button onClick={() => setTopupOpen(true)} className="gap-1.5 rounded-xl">
              <Plus className="h-4 w-4" /> Top up wallet
            </Button>
          </div>
        )}

        {/* Withdraw / KYC — floor roles (vendor/taluk/district/state) can cash out
            the amount above the ₹2,500 minimum once their KYC is verified. */}
        {hasFloor && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <LuxuryCard hoverLift={false} className="p-5">
              {user?.kyc_status === "verified" ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">Withdraw to bank / UPI</p>
                    <p className="text-xs text-muted-foreground">Withdrawable {fmtINR(withdrawable)} · keep ₹2,500 minimum</p>
                  </div>
                  <Link href="/wallet/withdraw" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl brand-gradient px-4 py-2.5 text-sm font-semibold text-brand-foreground brand-glow">
                    <ArrowDownLeft className="h-4 w-4" /> Withdraw
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                    <ShieldAlert className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">
                      {user?.kyc_status === "pending" ? "KYC under review" : "Complete KYC to withdraw"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user?.kyc_status === "pending"
                        ? "Withdrawals unlock once an admin verifies your documents."
                        : "Submit your Aadhaar, PAN and bank details to enable withdrawals."}
                    </p>
                  </div>
                  <Link href="/profile/kyc" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-sm font-semibold text-brand">
                    <ShieldCheck className="h-4 w-4" /> {user?.kyc_status === "pending" ? "View" : "KYC"}
                  </Link>
                </div>
              )}
            </LuxuryCard>
          </motion.div>
        )}

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
                    <p className="text-xs text-muted-foreground">In-store QR sales land here. Tap <span className="font-medium text-foreground">Transfer</span> to move the whole balance to your main wallet to spend or withdraw.</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tracking-tight">
                    <AnimatedCounter value={qrBalance} format={fmtINR} />
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <QrTransferButton balance={qrBalance} />
              </div>
            </LuxuryCard>
          </motion.div>
        )}

        {/* Sub-wallet breakdown — global, monthly, referral, etc. (hidden for vendors) */}
        {!isVendor && (() => {
          const breakdown = [
            { label: "Global wallet",   value: user?.global_wallet  ?? 0 },
            { label: "Lucky wallet",    value: user?.lucky_wallet   ?? 0 },
          ];
          return (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <LuxuryCard hoverLift={false} className="p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallet breakdown</p>
                <div className="grid grid-cols-2 gap-3">
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

        {/* Admin-only: earmarked reserves (held, not spendable) */}
        {isAdmin && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <LuxuryCard hoverLift={false} className="p-5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reserves (held)</p>
              <p className="mb-3 text-[11px] text-muted-foreground">Earmarked — not part of your spendable balance.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-surface-2/50 p-3">
                  <p className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">Buyback reserve</p>
                  <p className="mt-1 text-base font-bold tracking-tight">{fmtINR(user?.buyback_reserve ?? 0)}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Auto-fills future buyback cycles</p>
                </div>
                <div className="rounded-xl bg-surface-2/50 p-3">
                  <p className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">Level reserve</p>
                  <p className="mt-1 text-base font-bold tracking-tight">{fmtINR(user?.level_reserve ?? 0)}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Orphan L1/L2/L3 (no upline)</p>
                </div>
              </div>
            </LuxuryCard>
          </motion.div>
        )}

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
                            <td className="px-3 py-2.5 text-right font-medium">
                              {isDistributed ? fmtINR(m.per_user_amount) : m.collected > 0 ? (
                                <Button size="sm" disabled={distBusy === m.period} onClick={() => void distributeGlobal(m.period)} className="h-7 rounded-lg px-2.5 text-xs">
                                  {distBusy === m.period ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Distribute"}
                                </Button>
                              ) : "—"}
                            </td>
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

        <LuxuryCard hoverLift={false} className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
            <Clock className="h-4 w-4 text-muted-foreground" /> Transaction history
          </div>
          {loadingTxns ? (
            <div className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : txns.length === 0 ? (
            <EmptyState icon={Clock} title="No transactions yet" description="Wallet credits and debits will appear here." />
          ) : (
            <div className="divide-y divide-border">
              {txns.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{(t.notes || t.type).replace(/\s*\[[+-]\w+\]$/, "")}</p>
                    <p className="text-[11px] text-muted-foreground">{(t.created_at ?? "").replace("T", " ").slice(0, 16)}</p>
                  </div>
                  <p className={"shrink-0 text-sm font-bold " + (t.direction === "credit" ? "text-emerald-600" : "text-rose-500")}>
                    {t.direction === "credit" ? "+" : "−"}{fmtINR(t.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </LuxuryCard>
      </section>

      {/* Admin: manual wallet top-up */}
      <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Top up wallet</DialogTitle>
            <DialogDescription>Manually add an amount to your main wallet. It shows in your history.</DialogDescription>
          </DialogHeader>
          <Input
            type="number"
            inputMode="decimal"
            value={topupAmt}
            onChange={(e) => setTopupAmt(e.target.value)}
            placeholder="Amount (₹)"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTopupOpen(false)}>Cancel</Button>
            <Button onClick={() => void submitTopup()} disabled={topupBusy} className="gap-1.5">
              {topupBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
