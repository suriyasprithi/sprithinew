"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { AnimatedCounter } from "@/components/ui/custom/animated-counter";

type Props = {
  title: string;
  total: number;
  unit: string;
  data: { label: string; value: number }[];
  format?: (v: number) => string;
};

export function RevenueChart({ title, total, unit, data, format }: Props) {
  return (
    <LuxuryCard className="p-5 lg:col-span-2">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">
            <AnimatedCounter value={total} format={format} />{" "}
            <span className="text-sm font-normal text-muted-foreground">{unit}</span>
          </p>
        </div>
        <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400">
          ▲ trending up
        </span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 16, right: 12, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="brand-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip
              cursor={{ stroke: "var(--brand)", strokeOpacity: 0.4 }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 12,
                color: "var(--popover-foreground)",
              }}
            />
            <Area type="monotone" dataKey="value" stroke="var(--brand)" strokeWidth={2} fill="url(#brand-area)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </LuxuryCard>
  );
}
