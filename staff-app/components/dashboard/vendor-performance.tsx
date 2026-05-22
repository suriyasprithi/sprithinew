"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";

type Row = { name: string; value: number };

export function VendorPerformance({ title, data }: { title: string; data: Row[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <LuxuryCard className="p-5">
      <p className="mb-3 text-sm font-medium">{title}</p>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
            <XAxis type="number" hide domain={[0, max]} />
            <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
            <Tooltip
              cursor={{ fill: "var(--accent)" }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 12,
                color: "var(--popover-foreground)",
              }}
            />
            <Bar dataKey="value" radius={[6, 6, 6, 6]}>
              {data.map((_, i) => (
                <Cell key={i} fill={i === 0 ? "var(--brand)" : "var(--brand-deep)"} fillOpacity={i === 0 ? 1 : 0.55 - i * 0.05} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </LuxuryCard>
  );
}
