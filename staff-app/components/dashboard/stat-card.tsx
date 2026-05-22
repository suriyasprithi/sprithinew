"use client";

import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, ArrowRight, type LucideIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/custom/animated-counter";
import { cn } from "@/lib/utils";

export type StatTone = "brand" | "emerald" | "amber" | "violet" | "pink" | "cyan";

type Palette = { chip: string; stroke: string; fill: string; bg: string; border: string };

const TONE: Record<StatTone, Palette> = {
  brand:   { chip: "bg-[#fee2e2] text-[#b91c1c]", stroke: "var(--brand)", fill: "var(--brand)", bg: "linear-gradient(135deg,#ffffff 0%,#fff1f2 100%)", border: "rgba(237,28,36,0.10)" },
  emerald: { chip: "bg-[#d1fae5] text-[#047857]", stroke: "#10b981",      fill: "#10b981",      bg: "linear-gradient(135deg,#ffffff 0%,#ecfdf5 100%)", border: "rgba(16,185,129,0.14)" },
  amber:   { chip: "bg-[#fef3c7] text-[#b45309]", stroke: "#f59e0b",      fill: "#f59e0b",      bg: "linear-gradient(135deg,#ffffff 0%,#fff7ed 100%)", border: "rgba(245,158,11,0.16)" },
  violet:  { chip: "bg-[#ede9fe] text-[#6d28d9]", stroke: "#8b5cf6",      fill: "#8b5cf6",      bg: "linear-gradient(135deg,#ffffff 0%,#f5f3ff 100%)", border: "rgba(139,92,246,0.14)" },
  pink:    { chip: "bg-[#fce7f3] text-[#be185d]", stroke: "#ec4899",      fill: "#ec4899",      bg: "linear-gradient(135deg,#ffffff 0%,#fdf2f8 100%)", border: "rgba(236,72,153,0.14)" },
  cyan:    { chip: "bg-[#cffafe] text-[#0e7490]", stroke: "#06b6d4",      fill: "#06b6d4",      bg: "linear-gradient(135deg,#ffffff 0%,#ecfeff 100%)", border: "rgba(6,182,212,0.14)" },
};

type Props = {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: StatTone;
  delta?: number;
  href?: string;
  format?: (v: number) => string;
  spark?: number[];
};

export function StatCard({ label, value, icon: Icon, tone = "brand", delta, href, format, spark }: Props) {
  const t = TONE[tone];
  const data = (spark ?? []).map((v, i) => ({ i, v }));
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className="group/card relative flex h-full flex-col overflow-hidden rounded-[20px] border p-5 transition-shadow hover:shadow-[0_14px_36px_-12px_rgba(15,23,42,0.18)]"
      style={{
        background: t.bg,
        borderColor: t.border,
        boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset, 0 6px 18px -10px rgba(15,23,42,0.10)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("inline-flex h-11 w-11 items-center justify-center rounded-2xl", t.chip)}>
          <Icon className="h-5 w-5" />
        </span>
        {data.length > 1 && (
          <div className="h-9 w-24 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`spark-${tone}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={t.fill} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={t.fill} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={t.stroke} strokeWidth={2} fill={`url(#spark-${tone})`} isAnimationActive />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="mt-5">
        <p className="text-[15px] font-semibold text-[#374151]">{label}</p>
        <p className="mt-1 text-[36px] font-bold leading-none tracking-tight text-[#111827]">
          <AnimatedCounter value={value} format={format} />
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between pt-4 text-xs">
        {typeof delta === "number" ? (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold",
            delta >= 0 ? "bg-[#d1fae5] text-[#047857]" : "bg-[#fee2e2] text-[#b91c1c]")}>
            {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        ) : <span />}
        {href && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#6b7280] transition-colors group-hover/card:text-brand">
            View <ArrowRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </motion.div>
  );
  return href ? <Link href={href} className="block h-full">{inner}</Link> : <div className="h-full">{inner}</div>;
}
