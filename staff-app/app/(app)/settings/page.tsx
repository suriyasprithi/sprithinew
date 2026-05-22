"use client";

import { useEffect, useMemo, useState } from "react";
import { Settings as SettingsIcon, Save, Search, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { Shimmer } from "@/components/ui/custom/shimmer";
import { EmptyState } from "@/components/data-table/empty-state";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { mock, type SystemSetting } from "@/lib/mock";

type Group = { title: string; description?: string; items: SystemSetting[] };

function groupSettings(items: SystemSetting[]): Group[] {
  const map = new Map<string, SystemSetting[]>();
  for (const s of items) {
    const prefix = s.setting_key.split(".")[0] || "general";
    const arr = map.get(prefix) ?? [];
    arr.push(s);
    map.set(prefix, arr);
  }
  const META: Record<string, { title: string; description: string }> = {
    delivery: { title: "Delivery",       description: "Driver pay-out rates and base delivery fees." },
    token:    { title: "Tokens",         description: "Token economy thresholds." },
    welcome:  { title: "Welcome bonus",  description: "Referral welcome bonus controls." },
    mlm:      { title: "MLM commission", description: "Multi-level commission split (L1 / L2 / L3)." },
    buyback:  { title: "Buyback queue",  description: "Buyback FIFO slot allocations." },
  };
  return Array.from(map.entries()).map(([key, list]) => ({
    title: META[key]?.title ?? key,
    description: META[key]?.description,
    items: list,
  }));
}

export default function SettingsPage() {
  const [items, setItems] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    void (async () => {
      setItems(await mock.systemSettings());
      setLoading(false);
    })();
  }, []);

  const groups = useMemo(() => {
    const filtered = search
      ? items.filter((s) => s.setting_key.toLowerCase().includes(search.toLowerCase()))
      : items;
    return groupSettings(filtered);
  }, [items, search]);

  function update(k: string, v: string) {
    setItems((cur) => cur.map((i) => (i.setting_key === k ? { ...i, value: v } : i)));
    setDirty(true);
  }

  async function save() {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 400));
    setBusy(false);
    setDirty(false);
    toast.success("Settings saved");
  }

  return (
    <>
      <MobileHeader title="Settings" />
      <section className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="System"
          icon={SettingsIcon}
          title="System settings"
          description="Tunable parameters used across the platform. Changes apply immediately on save."
          action={
            <GradientButton onClick={() => void save()} disabled={busy || !dirty}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> {dirty ? "Save changes" : "Saved"}</>}
            </GradientButton>
          }
        />

        <div className="glass rounded-2xl p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search setting key…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="luxe-card space-y-3 p-5">
                <Shimmer className="h-4 w-32" />
                <Shimmer className="h-3 w-64" />
                <div className="grid gap-3 md:grid-cols-2">
                  <Shimmer className="h-9 w-full" />
                  <Shimmer className="h-9 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState icon={SettingsIcon} title="No settings match your search" />
        ) : (
          <div className="space-y-4">
            {groups.map((g, gi) => (
              <motion.div
                key={g.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.04 }}
              >
                <LuxuryCard className="p-5">
                  <div className="mb-4">
                    <p className="text-sm font-semibold">{g.title}</p>
                    {g.description && <p className="mt-0.5 text-xs text-muted-foreground">{g.description}</p>}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {g.items.map((s) => (
                      <div key={s.setting_key} className="space-y-1.5">
                        <code className="text-[11px] text-muted-foreground">{s.setting_key}</code>
                        <Input value={s.value} onChange={(e) => update(s.setting_key, e.target.value)} className="font-mono text-sm" />
                      </div>
                    ))}
                  </div>
                </LuxuryCard>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
