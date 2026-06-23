"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowLeftRight, Coins, Loader2, Send, Wallet as WalletIcon, Lock } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { AnimatedCounter } from "@/components/ui/custom/animated-counter";
import { useAuth } from "@/stores/auth";
import { mock, type MockTxn } from "@/lib/mock";
import { WELCOME_UNLOCK, type WalletKey } from "@/lib/api";

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
const fmtN = (n: number) => new Intl.NumberFormat("en-IN").format(n);

type Tile = { key: WalletKey; label: string; value: number; transferable: boolean; locked?: boolean; progress?: string };

export default function WalletPage() {
  const { user } = useAuth();
  const [txns, setTxns] = useState<MockTxn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setTxns(await mock.getTransactions());
      setLoading(false);
    })();
  }, []);

  // Depth-tier referral counts drive the welcome-wallet unlocks.
  const counts: Record<1 | 2 | 3, number> = {
    1: user?.level_1_count ?? 0,
    2: user?.level_2_count ?? 0,
    3: user?.level_3_count ?? 0,
  };
  // Both purchase-commission (level_N) and welcome (welcome_N) wallets unlock
  // only when the depth-tier referral count reaches the threshold.
  const gatedTile = (key: WalletKey, label: string, lvl: 1 | 2 | 3, value: number): Tile => {
    const need = WELCOME_UNLOCK[lvl];
    const have = counts[lvl];
    const unlocked = have >= need;
    return {
      key,
      label,
      value,
      transferable: unlocked,
      locked: !unlocked,
      progress: unlocked ? `Unlocked · ${fmtN(have)} referrals` : `${fmtN(have)} / ${fmtN(need)} referrals`,
    };
  };

  const tiles: Tile[] = [
    { key: "wallet",  label: "Main wallet",     value: user?.wallet_balance ?? 0, transferable: false },
    { key: "level",   label: "Level wallet",    value: user?.level_wallet   ?? 0, transferable: true  },
    // Purchase commission — transfers freely to main wallet (no referral gate).
    { key: "level_1", label: "Level 1 (purchase)", value: user?.level_1_wallet ?? 0, transferable: true },
    { key: "level_2", label: "Level 2 (purchase)", value: user?.level_2_wallet ?? 0, transferable: true },
    { key: "level_3", label: "Level 3 (purchase)", value: user?.level_3_wallet ?? 0, transferable: true },
    // Referral (signup) bonus — gated by depth-tier referral count.
    gatedTile("welcome_1", "Referral L1 bonus", 1, user?.welcome_1_wallet ?? 0),
    gatedTile("welcome_2", "Referral L2 bonus", 2, user?.welcome_2_wallet ?? 0),
    gatedTile("welcome_3", "Referral L3 bonus", 3, user?.welcome_3_wallet ?? 0),
    { key: "buyback", label: "Buyback wallet",  value: user?.buyback_wallet ?? 0, transferable: true  },
    { key: "global",  label: "Global wallet",   value: user?.global_wallet  ?? 0, transferable: true  },
  ];

  return (
    <>
      <AppHeader title="Wallet" />
      <section className="mx-auto max-w-md space-y-5 p-4 pb-24 md:max-w-4xl md:p-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <LuxuryCard glow hoverLift={false} className="relative overflow-hidden p-6 brand-gradient text-brand-foreground">
            <div className="absolute inset-0 brand-gradient-soft opacity-40" />
            <div className="relative space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider opacity-80">Total wallet balance</p>
                <WalletIcon className="h-5 w-5 opacity-80" />
              </div>
              <p className="text-4xl font-bold tracking-tight">
                <AnimatedCounter value={user?.wallet_balance ?? 0} format={fmtINR} />
              </p>
              <p className="text-xs opacity-80">Tokens: <span className="font-semibold">{user?.token_balance ?? 0}</span></p>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <Link href="/wallet/send" className="flex items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 py-2.5 text-xs font-medium backdrop-blur hover:bg-white/20">
                  <Send className="h-4 w-4" /> Send
                </Link>
                <Link href="/wallet/transfer" className="flex items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 py-2.5 text-xs font-medium backdrop-blur hover:bg-white/20">
                  <ArrowLeftRight className="h-4 w-4" /> Transfer
                </Link>
                <Link href="/wallet/withdraw" className="flex items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-xs font-medium text-brand hover:bg-white/90">
                  <ArrowDownLeft className="h-4 w-4" /> Withdraw
                </Link>
              </div>
            </div>
          </LuxuryCard>
        </motion.div>

        <div className="space-y-2">
          {tiles.map((t, i) => (
            <motion.div key={t.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <LuxuryCard className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    {t.locked ? <Lock className="h-4 w-4" /> : <WalletIcon className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.label}</p>
                    <p className="mt-0.5 text-lg font-bold">{fmtINR(t.value)}</p>
                    {t.progress && (
                      <p className={`text-[10px] ${t.locked ? "text-amber-500" : "text-emerald-500"}`}>
                        {t.locked ? "🔒 " : "✓ "}{t.progress}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {t.key === "buyback" && (
                    <Link href="/buyback" className="inline-flex h-8 items-center rounded-lg border border-border bg-surface-2/40 px-3 text-xs font-medium hover:border-brand/40 hover:bg-surface-2 hover:text-brand">
                      View orders
                    </Link>
                  )}
                  {t.transferable && (
                    <Link href={`/wallet/transfer?from=${t.key}`} className="inline-flex h-8 items-center rounded-lg border border-border bg-surface-2/40 px-3 text-xs font-medium hover:border-brand/40 hover:bg-surface-2 hover:text-brand">
                      Transfer
                    </Link>
                  )}
                </div>
              </LuxuryCard>
            </motion.div>
          ))}
        </div>

        <div>
          <h3 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Recent transactions</h3>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : txns.length === 0 ? (
            <LuxuryCard hoverLift={false} className="p-6 text-center text-sm text-muted-foreground">No transactions yet.</LuxuryCard>
          ) : (
            <div className="space-y-2">
              {txns.map((t, i) => (
                <motion.div key={t.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                  <LuxuryCard className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                        <Coins className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">{t.notes || t.type}</p>
                        <p className="text-[10px] text-muted-foreground">{t.created_at} · {t.reference}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${t.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {t.amount >= 0 ? "+" : ""}{fmtINR(t.amount)}
                    </span>
                  </LuxuryCard>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
