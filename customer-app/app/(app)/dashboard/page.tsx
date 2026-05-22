"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowLeftRight, Bell, Gift, ShoppingBag, Send, Sparkles, Store, Users, Wallet as WalletIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { AnimatedCounter } from "@/components/ui/custom/animated-counter";
import { useAuth } from "@/stores/auth";
import type { WalletKey } from "@/lib/api";

const QUICK = [
  { href: "/wallet/send",     label: "Send",     icon: Send,          tone: "brand" },
  { href: "/wallet/withdraw", label: "Withdraw", icon: ArrowDownLeft, tone: "amber" },
  { href: "/refer",           label: "Refer",    icon: Gift,          tone: "pink" },
  { href: "/shops",           label: "Shops",    icon: Store,         tone: "violet" },
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
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

type Tile = { key: WalletKey; label: string; value: number; tone: keyof typeof WALLET_TONE; transferable: boolean };

export default function DashboardPage() {
  const { user } = useAuth();
  const balance = user?.wallet_balance ?? 0;

  const wallets: Tile[] = [
    { key: "wallet",  label: "Main",    value: user?.wallet_balance ?? 0, tone: "brand",  transferable: false },
    { key: "level",   label: "Level",   value: user?.level_wallet   ?? 0, tone: "sky",    transferable: true  },
    { key: "level_1", label: "L1",      value: user?.level_1_wallet ?? 0, tone: "violet", transferable: false },
    { key: "level_2", label: "L2",      value: user?.level_2_wallet ?? 0, tone: "violet", transferable: false },
    { key: "level_3", label: "L3",      value: user?.level_3_wallet ?? 0, tone: "violet", transferable: false },
    { key: "buyback", label: "Buyback", value: user?.buyback_wallet ?? 0, tone: "rose",   transferable: true  },
    { key: "global",  label: "Global",  value: user?.global_wallet  ?? 0, tone: "amber",  transferable: true  },
  ];

  const levels = [
    { label: "Level 1", count: user?.level_1_count ?? 0 },
    { label: "Level 2", count: user?.level_2_count ?? 0 },
    { label: "Level 3", count: user?.level_3_count ?? 0 },
  ];

  return (
    <>
      <AppHeader />
      <section className="mx-auto max-w-md space-y-7 p-4 pb-24 md:max-w-6xl md:p-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">Welcome back</p>
          <h2 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-[#111827] md:text-[34px]">{user?.name}</h2>
          <p className="mt-2 text-base text-[#6b7280]">Here is your wallet snapshot.</p>
        </div>

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
                    {w.transferable && <span className="rounded-full bg-[#d1fae5] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#047857]">free</span>}
                  </div>
                  <p className="mt-3 text-[13px] font-bold uppercase tracking-wider text-[#6b7280]">{w.label}</p>
                  <p className="mt-1 text-[28px] font-bold leading-none tracking-tight text-[#111827]">
                    <AnimatedCounter value={w.value} format={fmtINR} />
                  </p>
                  <div className="mt-auto space-y-1 pt-3">
                    <Link
                      href={w.key === "global" ? "/wallet/global-history" : `/wallet/history?wallet=${w.key}`}
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
        </div>

        <div>
          <h3 className="mb-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#6b7280]">My referrals</h3>
          <div className="grid grid-cols-3 gap-3">
            {levels.map((lv, i) => (
              <motion.div
                key={lv.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -3 }}
                className="rounded-[20px] border p-4 transition-shadow hover:shadow-[0_14px_36px_-12px_rgba(15,23,42,0.18)]"
                style={{
                  background: "linear-gradient(135deg,#ffffff 0%,#fdf2f8 100%)",
                  borderColor: "rgba(236,72,153,0.14)",
                  boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset, 0 6px 18px -10px rgba(15,23,42,0.10)",
                }}
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#fce7f3] text-[#be185d]">
                  <Users className="h-4 w-4" />
                </span>
                <p className="mt-3 text-[32px] font-bold leading-none tracking-tight text-[#111827]">
                  <AnimatedCounter value={lv.count} />
                </p>
                <p className="mt-1 text-[13px] font-bold uppercase tracking-wider text-[#6b7280]">{lv.label}</p>
              </motion.div>
            ))}
          </div>
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
