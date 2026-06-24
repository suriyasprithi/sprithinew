"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowLeftRight, Bell, Gift, Lock, ShoppingBag, Send, Sparkles, Store, Users, Wallet as WalletIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { AnimatedCounter } from "@/components/ui/custom/animated-counter";
import { ShopCarousel, type ShopBanner } from "@/components/marketplace/shop-carousel";
import { VideoSubmitCard } from "@/components/marketplace/video-submit-card";
import { useAuth } from "@/stores/auth";
import { api, WELCOME_UNLOCK, type WalletKey } from "@/lib/api";

const QUICK = [
  { href: "/wallet/send",     label: "Send",     icon: Send,          tone: "brand" },
  { href: "/wallet/withdraw", label: "Withdraw", icon: ArrowDownLeft, tone: "amber" },
  { href: "/refer",           label: "Refer",    icon: Gift,          tone: "pink" },
  { href: "/vendors-public",  label: "Shops",    icon: Store,         tone: "violet" },
] as const;

// Quick-action icon palette (small badges only)
const TONE: Record<string, string> = {
  brand:  "bg-[#fee2e2] text-[#b91c1c]",
  amber:  "bg-[#fef3c7] text-[#b45309]",
  pink:   "bg-[#fce7f3] text-[#be185d]",
  violet: "bg-[#ede9fe] text-[#6d28d9]",
  sky:    "bg-[#dbeafe] text-[#1d4ed8]",
  rose:   "bg-[#ffe4e6] text-[#be123c]",
};

// Wallet card full-tone palette: icon chip + gradient bg + border
type WalletPalette = { chip: string; bg: string; border: string };
const WALLET_TONE: Record<string, WalletPalette> = {
  brand:  { chip: "bg-[#fee2e2] text-[#b91c1c]", bg: "linear-gradient(135deg,#ffffff 0%,#fff1f2 100%)", border: "rgba(237,28,36,0.10)" },
  sky:    { chip: "bg-[#dbeafe] text-[#1d4ed8]", bg: "linear-gradient(135deg,#ffffff 0%,#eff6ff 100%)", border: "rgba(29,78,216,0.10)" },
  violet: { chip: "bg-[#ede9fe] text-[#6d28d9]", bg: "linear-gradient(135deg,#ffffff 0%,#f5f3ff 100%)", border: "rgba(139,92,246,0.12)" },
  rose:   { chip: "bg-[#ffe4e6] text-[#be123c]", bg: "linear-gradient(135deg,#ffffff 0%,#fff1f2 100%)", border: "rgba(190,18,60,0.10)" },
  amber:  { chip: "bg-[#fef3c7] text-[#b45309]", bg: "linear-gradient(135deg,#ffffff 0%,#fff7ed 100%)", border: "rgba(245,158,11,0.16)" },
};

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

type Tile = { key: WalletKey; label: string; value: number; tone: keyof typeof WALLET_TONE; transferable: boolean };

/** Which referral level a welcome-view credit belongs to — from its source
 *  (matched wallet tag level_N / welcome_N), else its notes. Mirrors the Digital
 *  Point page so both screens classify rows identically. */
function levelOf(it: { source?: string | null; notes?: string | null }): 1 | 2 | 3 | null {
  const s = (it.source ?? "").toLowerCase();
  if (s === "level_1" || s === "welcome_1") return 1;
  if (s === "level_2" || s === "welcome_2") return 2;
  if (s === "level_3" || s === "welcome_3") return 3;
  const n = (it.notes ?? "").toLowerCase();
  if (n.includes("level 1") || /\bl1\b/.test(n)) return 1;
  if (n.includes("level 2") || /\bl2\b/.test(n)) return 2;
  if (n.includes("level 3") || /\bl3\b/.test(n)) return 3;
  return null;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const balance = user?.wallet_balance ?? 0;

  // Shop cover images (admin-approved) for the carousel below the balance card.
  const [shops, setShops] = useState<ShopBanner[]>([]);
  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/catalog/shop-banners");
        setShops((res.data.data?.items ?? []) as ShopBanner[]);
      } catch { /* dashboard still works without the carousel */ }
    })();
  }, []);

  // Per-level referral-bonus totals, computed exactly like the "Referral Bonus
  // Digital Point" page (sum of welcome-view credits per level) so the LEVELS
  // cards here always show the same L1 / L2 / L3 amounts as that page.
  const [refByLevel, setRefByLevel] = useState<Record<1 | 2 | 3, number>>({ 1: 0, 2: 0, 3: 0 });
  useEffect(() => {
    void (async () => {
      try {
        const r = await api.get("/wallet/history", { params: { wallet: "welcome" } });
        const items = (r.data.data?.items ?? []) as Array<{ source?: string | null; notes?: string | null; direction: string; amount: number }>;
        const t: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
        for (const it of items) {
          const lvl = levelOf(it);
          if (lvl && it.direction === "credit") t[lvl] += it.amount;
        }
        setRefByLevel(t);
      } catch { /* cards fall back to 0 */ }
    })();
  }, []);

  const wallets: Tile[] = [
    { key: "wallet",  label: "Main",    value: user?.wallet_balance ?? 0, tone: "brand",  transferable: false },
    { key: "level",   label: "Level",   value: user?.level_commission ?? 0, tone: "sky", transferable: true },
    { key: "buyback", label: "Buyback", value: user?.buyback_wallet ?? 0, tone: "rose",   transferable: true  },
    { key: "global",  label: "Global",  value: user?.global_wallet  ?? 0, tone: "amber",  transferable: true  },
  ];

  // Each level card shows that tier's referral-bonus total — identical to the
  // "Referral Bonus Digital Point" page. Transfer unlocks only when the depth-tier
  // referral count reaches the threshold (L1 ≥ 100, L2 ≥ 10k, L3 ≥ 10 lakh).
  const levelCards = ([1, 2, 3] as const).map((lvl) => {
    const value = refByLevel[lvl];
    const users = lvl === 1 ? user?.level_1_count  : lvl === 2 ? user?.level_2_count  : user?.level_3_count;
    const have  = users ?? 0;
    const need  = WELCOME_UNLOCK[lvl];
    return { lvl, key: `welcome_${lvl}` as WalletKey, label: `L${lvl}`, value, users: have, need, unlocked: have >= need, tone: (lvl === 1 ? "sky" : lvl === 2 ? "amber" : "rose") as keyof typeof WALLET_TONE };
  });

  return (
    <>
      <AppHeader />
      <section className="mx-auto max-w-md space-y-7 p-4 pb-24 md:max-w-6xl md:p-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">Welcome back</p>
          <h2 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-[#111827] md:text-[34px]">{user?.name}</h2>
          <p className="mt-2 text-base text-[#6b7280]">Here is your wallet snapshot.</p>
        </div>

        <VideoSubmitCard />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <LuxuryCard glow hoverLift={false} className="relative overflow-hidden p-6 brand-gradient text-brand-foreground">
            <div className="absolute inset-0 brand-gradient-soft opacity-40" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider opacity-80">Total balance</p>
                <WalletIcon className="h-5 w-5 opacity-80" />
              </div>
              <p className="text-4xl font-bold tracking-tight md:text-5xl">
                <AnimatedCounter value={balance} format={fmtINR} />
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/wallet/transfer" className="flex items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm font-medium backdrop-blur hover:bg-white/20">
                  <ArrowLeftRight className="h-4 w-4" /> Transfer
                </Link>
                <Link href="/wallet/send" className="flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-sm font-medium text-brand hover:bg-white/90">
                  <Send className="h-4 w-4" /> Send
                </Link>
              </div>
            </div>
          </LuxuryCard>
        </motion.div>

        <ShopCarousel shops={shops} />

        <div>
          <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#6b7280]">My wallets</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {wallets.map((w, i) => {
              const palette = WALLET_TONE[w.tone];
              return (
                <motion.div
                  key={w.key}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ y: -3 }}
                  className="flex h-full flex-col overflow-hidden rounded-[20px] border p-4 transition-shadow hover:shadow-[0_14px_36px_-12px_rgba(15,23,42,0.18)]"
                  style={{
                    background: palette.bg,
                    borderColor: palette.border,
                    boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset, 0 6px 18px -10px rgba(15,23,42,0.10)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${palette.chip}`}>
                      <WalletIcon className="h-4 w-4" />
                    </span>
                  </div>
                  <p className="mt-3 text-[13px] font-bold uppercase tracking-wider text-[#6b7280]">{w.label}</p>
                  <p className="mt-1 text-[28px] font-bold leading-none tracking-tight text-[#111827]">
                    <AnimatedCounter value={w.value} format={fmtINR} />
                  </p>
                  <div className="mt-auto space-y-1 pt-3">
                    <Link
                      href={w.key === "level" ? "/digital-point?section=referral" : (w.key === "buyback" || w.key === "global") ? `/digital-point?section=${w.key}` : `/wallet/history?wallet=${w.key}`}
                      className="block w-full rounded-lg border border-black/10 bg-white/70 py-1.5 text-center text-xs font-semibold text-[#374151] hover:border-brand/40 hover:text-brand"
                    >
                      History →
                    </Link>
                    {w.transferable && (
                      <Link href={`/wallet/transfer?from=${w.key}`} className="block w-full rounded-lg border border-brand/30 bg-brand/10 py-1.5 text-center text-xs font-semibold text-brand hover:bg-brand/15">Transfer</Link>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Level wallets (L1–L3) combined into a single card */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-3 overflow-hidden rounded-[20px] border p-4"
            style={{
              background: WALLET_TONE.violet.bg,
              borderColor: WALLET_TONE.violet.border,
              boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset, 0 6px 18px -10px rgba(15,23,42,0.10)",
            }}
          >
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${WALLET_TONE.violet.chip}`}>
                <WalletIcon className="h-4 w-4" />
              </span>
              <p className="text-[13px] font-bold uppercase tracking-wider text-[#6b7280]">Levels</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {levelCards.map((lc) => (
                <div
                  key={lc.key}
                  className="rounded-xl border p-3 text-center"
                  style={{ background: WALLET_TONE[lc.tone].bg, borderColor: WALLET_TONE[lc.tone].border }}
                >
                  <p className="text-[12px] font-bold uppercase tracking-wider text-[#6b7280]">{lc.label}</p>
                  <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-[#111827]">
                    <AnimatedCounter value={lc.value} format={fmtINR} />
                  </p>
                  <p className="mt-1 inline-flex items-center justify-center gap-1 text-[11px] font-semibold text-[#be185d]">
                    <Users className="h-3 w-3" /> <AnimatedCounter value={lc.users} /> users
                  </p>
                  {lc.lvl === 1 && (
                    <Link
                      href="/digital-point"
                      className="mt-2 block rounded-lg border border-black/10 bg-white/70 py-1 text-center text-[11px] font-semibold text-[#374151] hover:border-brand/40 hover:text-brand"
                    >
                      History →
                    </Link>
                  )}
                  {lc.unlocked ? (
                    <Link
                      href={`/wallet/transfer?from=${lc.key}`}
                      className="mt-1 block rounded-lg border border-brand/30 bg-brand/10 py-1 text-center text-[11px] font-semibold text-brand hover:bg-brand/15"
                    >
                      Transfer
                    </Link>
                  ) : (
                    <p className="mt-1 flex items-center justify-center gap-1 rounded-lg border border-black/10 bg-white/50 py-1 text-center text-[11px] font-semibold text-[#9ca3af]">
                      <Lock className="h-3 w-3" /> {lc.users.toLocaleString("en-IN")}/{lc.need.toLocaleString("en-IN")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div>
          <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#6b7280]">Quick actions</h3>
          <div className="grid grid-cols-4 gap-3">
            {QUICK.map((a) => {
              const Icon: LucideIcon = a.icon;
              return (
                <Link
                  key={a.label}
                  href={a.href}
                  className="group flex flex-col items-center gap-2 rounded-2xl border border-black/5 bg-white p-3 text-center shadow-[0_6px_18px_-10px_rgba(15,23,42,0.10)] transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_14px_36px_-12px_rgba(15,23,42,0.18)] active:scale-95"
                >
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${TONE[a.tone]}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-[#111827]">{a.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#6b7280]">More</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { href: "/orders",        label: "Orders",        icon: ShoppingBag },
              { href: "/notifications", label: "Notifications", icon: Bell },
              { href: "/profile",       label: "Profile",       icon: Users },
            ].map((m) => {
              const Icon = m.icon;
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  className="flex items-center gap-2 rounded-2xl border border-black/5 bg-white p-3 text-sm font-semibold text-[#111827] shadow-[0_6px_18px_-10px_rgba(15,23,42,0.10)] transition-all hover:-translate-y-0.5 hover:border-brand/30"
                >
                  <Icon className="h-4 w-4 text-brand" /> {m.label}
                </Link>
              );
            })}
          </div>
        </div>

        <LuxuryCard hoverLift={false} className="border-dashed p-5">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Sparkles className="h-5 w-5 text-brand" />
            Recent activity will appear here once you transact.
          </div>
        </LuxuryCard>
      </section>
    </>
  );
}
