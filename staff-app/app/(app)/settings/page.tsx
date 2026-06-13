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
import { api, apiErrorMessage } from "@/lib/api";
import { mock, type SystemSetting } from "@/lib/mock";

type Group = { title: string; description?: string; items: SystemSetting[] };

const META: Record<string, { title: string; description: string }> = {
  tokenbonus: { title: "Token request bonus", description: "Bonus % minted when a tier's token request is approved by its parent — compounds down the chain, funded by the token-share pool." },
  commission: { title: "Order commission pool", description: "Slices of every order's 10% pool — lucky draw funds the monthly draw, token share funds token-request bonuses." },
  token:      { title: "Tokens",         description: "Token economy thresholds." },
  welcome:    { title: "Welcome bonus",  description: "Per-level referral signup bonus (L1 / L2 / L3) credited to each upline's level wallet." },
  mlm:        { title: "MLM commission", description: "Multi-level commission split (L1 / L2 / L3)." },
  buyback:    { title: "Buyback queue",  description: "Buyback FIFO slot allocations." },
  delivery:   { title: "Free delivery",  description: "When delivery is free. Priority when several are on: Category → Amount → Time → ETA. Each rule's on/off is 1 = on, 0 = off. Per-category limits live on the Categories page." },
};

// Friendly field labels for the keys that aren't self-explanatory.
const LABELS: Record<string, string> = {
  "commission.lucky_draw_pct":  "Lucky draw share (%)",
  "commission.token_share_pct": "Token-share pool (%)",
  "token.bonus.state":          "State bonus (%)",
  "token.bonus.district":       "District bonus (%)",
  "token.bonus.taluk":          "Taluk bonus (%)",
  "welcome.bonus_amount":       "Level 1 bonus (₹)",
  "welcome.bonus_l2":           "Level 2 bonus (₹)",
  "welcome.bonus_l3":           "Level 3 bonus (₹)",
  "welcome.bonus_active":       "Bonus active (1 = on)",
  "mlm.level_1_pct":            "Level 1 commission (%)",
  "mlm.level_2_pct":            "Level 2 commission (%)",
  "mlm.level_3_pct":            "Level 3 commission (%)",
  "buyback.slot_1_pct":         "Slot 1 (%)",
  "buyback.slot_2_pct":         "Slot 2 (%)",
  "buyback.slot_3_pct":         "Slot 3 (%)",
  "buyback.slot_4_pct":         "Slot 4 (%)",
  "delivery.free.category_enabled": "Category rule (1=on)",
  "delivery.free.amount_enabled":   "Min-purchase rule (1=on)",
  "delivery.free.amount_min":       "Min order for free (₹)",
  "delivery.free.time_enabled":     "Time-window rule (1=on)",
  "delivery.free.time_from":        "Free from (HH:MM)",
  "delivery.free.time_to":          "Free until (HH:MM)",
  "delivery.free.eta_enabled":      "Delivery-time rule (1=on)",
  "delivery.free.eta_hours":        "ETA over (hours)",
  "delivery.free.eta_min_amount":   "ETA rule min order (₹)",
};

// The token bonus keys get their own card; everything else by prefix.
function groupKeyFor(key: string): string {
  if (key.startsWith("token.bonus.")) return "tokenbonus";
  return key.split(".")[0] || "general";
}

function groupSettings(items: SystemSetting[]): Group[] {
  const map = new Map<string, SystemSetting[]>();
  for (const s of items) {
    const k = groupKeyFor(s.setting_key);
    const arr = map.get(k) ?? [];
    arr.push(s);
    map.set(k, arr);
  }
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
      try {
        const res = await api.get("/admin/settings");
        const data = (res.data?.data ?? {}) as Record<string, unknown>;
        setItems(Object.entries(data).map(([setting_key, value]) => ({ setting_key, value: String(value ?? "") })));
      } catch (err) {
        toast.error(apiErrorMessage(err, "Could not load settings, showing offline sample"));
        setItems(await mock.systemSettings());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const groups = useMemo(() => {
    const filtered = search
      ? items.filter((s) => s.setting_key.toLowerCase().includes(search.toLowerCase()) || (LABELS[s.setting_key] ?? "").toLowerCase().includes(search.toLowerCase()))
      : items;
    return groupSettings(filtered);
  }, [items, search]);

  function update(k: string, v: string) {
    setItems((cur) => cur.map((i) => (i.setting_key === k ? { ...i, value: v } : i)));
    setDirty(true);
  }

  async function save() {
    setBusy(true);
    try {
      const payload = Object.fromEntries(items.map((i) => [i.setting_key, i.value]));
      await api.patch("/admin/settings", payload);
      setDirty(false);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save settings"));
    } finally {
      setBusy(false);
    }
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
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search setting…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
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
                        {LABELS[s.setting_key] ? (
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-medium">{LABELS[s.setting_key]}</span>
                            <code className="text-[10px] text-muted-foreground">{s.setting_key}</code>
                          </div>
                        ) : (
                          <code className="text-[11px] text-muted-foreground">{s.setting_key}</code>
                        )}
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
