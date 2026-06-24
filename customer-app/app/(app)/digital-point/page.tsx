"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Coins, Loader2, Sparkles, Users, ArrowDownLeft, Gift } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { AnimatedCounter } from "@/components/ui/custom/animated-counter";
import { api, apiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

type Meta = {
  shop: string | null;
  taluk: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
};
type Item = {
  id: number;
  amount: number;
  direction: "credit" | "debit";
  type: string;
  reference: string | null;
  notes: string;
  source: string | null;
  created_at: string;
  meta?: Meta | null;
};

type Payload = {
  wallet: string;
  balance: number;
  total_credit: number;
  total_debit: number;
  items: Item[];
};

// Welcome = per-level signup bonuses (API alias `welcome` → welcome_1/2/3 wallets,
// gated by referral count); Commission = L1/L2/L3 purchase commissions
// (API alias `referral` → level_1/2/3 wallets, freely transferable).
const SECTIONS = [
  { key: "welcome",  short: "Referral",   title: "Referral Bonus Digital Point", icon: Gift,         tone: "sky"    as const, desc: "Per-level referral signup bonus (L1 / L2 / L3) — gated by referral count" },
  { key: "referral", short: "Commission", title: "MLM Commission Digital Point", icon: Users,         tone: "violet" as const, desc: "Multi-level commission split (L1 / L2 / L3)" },
  { key: "buyback",  short: "Buyback",    title: "Buyback Digital Point",       icon: ArrowDownLeft, tone: "rose"   as const, desc: "Loyalty buyback cycle credits" },
  { key: "global",   short: "Global",     title: "Global Digital Point",        icon: Sparkles,      tone: "amber"  as const, desc: "Monthly global pool credits" },
];

// Streams that break down into L1 / L2 / L3 cards.
const LEVEL_STREAMS = ["welcome", "referral"];

const TONE: Record<string, { chip: string; bg: string; border: string; tab: string }> = {
  violet: { chip: "bg-[#ede9fe] text-[#6d28d9]", bg: "linear-gradient(135deg,#ffffff 0%,#f5f3ff 100%)", border: "rgba(139,92,246,0.14)", tab: "border-[#8b5cf6] text-[#6d28d9]" },
  rose:   { chip: "bg-[#ffe4e6] text-[#be123c]", bg: "linear-gradient(135deg,#ffffff 0%,#fff1f2 100%)", border: "rgba(190,18,60,0.12)",  tab: "border-[#e11d48] text-[#be123c]" },
  sky:    { chip: "bg-[#dbeafe] text-[#1d4ed8]", bg: "linear-gradient(135deg,#ffffff 0%,#eff6ff 100%)", border: "rgba(29,78,216,0.12)",  tab: "border-[#3b82f6] text-[#1d4ed8]" },
  amber:  { chip: "bg-[#fef3c7] text-[#b45309]", bg: "linear-gradient(135deg,#ffffff 0%,#fff7ed 100%)", border: "rgba(245,158,11,0.16)", tab: "border-[#f59e0b] text-[#b45309]" },
};

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

export default function DigitalPointPage() {
  const [data, setData] = useState<Record<string, Payload | null>>({});
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string>(SECTIONS[0].key);

  // Open a specific tab when linked with ?section=… (e.g. from the dashboard cards).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sec = new URLSearchParams(window.location.search).get("section");
    if (sec && SECTIONS.some((s) => s.key === sec)) setActive(sec);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const results = await Promise.all(
          SECTIONS.map((s) => api.get("/wallet/history", { params: { wallet: s.key } }).then((r) => [s.key, r.data.data as Payload] as const))
        );
        const map: Record<string, Payload | null> = {};
        for (const [k, v] of results) map[k] = v;
        setData(map);
      } catch (e) { toast.error(apiErrorMessage(e)); }
      finally { setLoading(false); }
    })();
  }, []);

  const section = useMemo(() => SECTIONS.find((s) => s.key === active) ?? SECTIONS[0], [active]);
  const palette = TONE[section.tone];
  const Icon = section.icon;
  const p = data[section.key];

  // For the Referral section, break the total into L1 / L2 / L3 (sum + count).
  const levelTotals = useMemo(() => {
    const t: Record<1 | 2 | 3, { total: number; count: number }> = {
      1: { total: 0, count: 0 }, 2: { total: 0, count: 0 }, 3: { total: 0, count: 0 },
    };
    if (LEVEL_STREAMS.includes(section.key) && p) {
      for (const it of p.items) {
        const lvl = levelOf(it);
        if (lvl && it.direction === "credit") { t[lvl].total += it.amount; t[lvl].count += 1; }
      }
    }
    return t;
  }, [p, section.key]);

  return (
    <>
      <AppHeader title="Digital Point" />
      <section className="mx-auto max-w-md space-y-6 p-4 pb-24 md:max-w-5xl md:p-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">Earnings</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#111827] md:text-[34px]">Digital Point</h2>
          <p className="mt-2 text-base text-[#6b7280]">Track credits across your reward streams. 1 Digital Point = ₹1.</p>
        </div>

        {/* Tabs */}
        <div className="rounded-2xl border border-black/5 bg-white p-1 shadow-[0_6px_18px_-10px_rgba(15,23,42,0.10)]">
          <div className="grid grid-cols-4 gap-1">
            {SECTIONS.map((s) => {
              const isActive = s.key === active;
              const t = TONE[s.tone];
              const balance = data[s.key]?.balance ?? 0;
              const TabIcon = s.icon;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setActive(s.key)}
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-center transition-colors",
                    isActive ? "bg-[#f5f7fb]" : "hover:bg-[#f5f7fb]/60",
                  )}
                >
                  <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl", t.chip)}>
                    <TabIcon className="h-4 w-4" />
                  </span>
                  <span className={cn("text-[12px] font-semibold", isActive ? "text-[#111827]" : "text-[#6b7280]")}>
                    {s.short}
                  </span>
                  <span className={cn("text-[11px] font-bold", isActive ? "text-[#111827]" : "text-[#9ca3af]")}>
                    {fmtINR(balance)}
                  </span>
                  {isActive && (
                    <motion.span
                      layoutId="dp-tab-underline"
                      className={cn("absolute inset-x-3 -bottom-px h-0.5 rounded-full", t.tab.replace("border-", "bg-").split(" ")[0])}
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active section */}
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <motion.div
            key={section.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="rounded-[20px] border p-5"
            style={{
              background: palette.bg,
              borderColor: palette.border,
              boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset, 0 6px 18px -10px rgba(15,23,42,0.10)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${palette.chip}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[15px] font-bold text-[#111827]">{section.title}</p>
                  <p className="text-xs text-[#6b7280]">{section.desc}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[28px] font-bold leading-none tracking-tight text-[#111827]">
                  <AnimatedCounter value={p?.balance ?? 0} format={fmtINR} />
                </p>
                <p className="mt-1 text-[11px] text-[#6b7280]">Credited {fmtINR(p?.total_credit ?? 0)}</p>
              </div>
            </div>

            {LEVEL_STREAMS.includes(section.key) && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {([1, 2, 3] as const).map((lvl) => (
                  <div key={lvl} className="rounded-xl border border-black/5 bg-white/70 p-3 text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]">L{lvl}</p>
                    <p className="mt-0.5 text-sm font-bold text-[#111827]">{fmtINR(levelTotals[lvl].total)}</p>
                    <p className="text-[10px] text-[#9ca3af]">{levelTotals[lvl].count} credits</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 overflow-hidden rounded-xl border border-black/5 bg-white/70">
              {(p?.items.length ?? 0) === 0 ? (
                <div className="flex items-center justify-center gap-2 p-6 text-xs text-[#6b7280]">
                  <Coins className="h-4 w-4" /> No activity yet
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-black/[0.025] text-left text-[11px] uppercase tracking-wider text-[#6b7280]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Date</th>
                      <th className="hidden px-3 py-2 font-semibold sm:table-cell">Source</th>
                      <th className="hidden px-3 py-2 font-semibold md:table-cell">Reference</th>
                      <th className="px-3 py-2 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {p?.items.map((it) => (
                      <tr key={it.id} className="transition-colors hover:bg-black/[0.025]">
                        <td className="px-3 py-2.5">
                          <p className="text-sm font-medium text-[#111827]">{it.created_at.slice(0, 10)}</p>
                          <p className="text-[11px] text-[#6b7280]">{it.created_at.slice(11, 16)}</p>
                          {it.meta?.customer_name && (
                            <p className="mt-0.5 text-[11px] font-semibold text-[#111827]">{it.meta.customer_name}</p>
                          )}
                          {(it.meta?.customer_mobile || it.meta?.taluk) && (
                            <p className="text-[10px] text-[#6b7280]">
                              {[it.meta?.customer_mobile, it.meta?.taluk].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </td>
                        <td className="hidden px-3 py-2.5 sm:table-cell">
                          <p className="text-sm">{it.notes || it.type}</p>
                          {it.source && it.source !== section.key && (
                            <p className="text-[11px] text-[#6b7280]">{labelForSource(it.source)}</p>
                          )}
                        </td>
                        <td className="hidden px-3 py-2.5 text-xs text-[#6b7280] md:table-cell">{it.reference ?? "—"}</td>
                        <td className="px-3 py-2.5 text-right">
                          <p className={"font-bold " + (it.direction === "credit" ? "text-emerald-600" : "text-rose-500")}>
                            {it.direction === "credit" ? "+" : "−"}{fmtINR(it.amount)}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        )}
      </section>
    </>
  );
}

function labelForSource(src: string): string {
  if (src === "level_1" || src === "welcome_1") return "L1 referral";
  if (src === "level_2" || src === "welcome_2") return "L2 referral";
  if (src === "level_3" || src === "welcome_3") return "L3 referral";
  return src;
}

/** Which referral level a credit belongs to — from its source, else its notes.
 *  Source is the matched wallet tag: level_N (commission) or welcome_N (signup). */
function levelOf(it: Item): 1 | 2 | 3 | null {
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
