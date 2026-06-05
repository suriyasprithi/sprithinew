"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, MapPin, Search, Store } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { api, apiErrorMessage } from "@/lib/api";

type Shop = { id: number; name: string; address: string; area: string; pincode: string; mobile: string; image: string; product_count: number };

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [q, setQ] = useState("");
  const [taluks, setTaluks] = useState<{ id: number; label: string }[]>([]);
  const [talukId, setTalukId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (q) params.q = q;
      if (talukId) params.taluk_id = String(talukId);
      const res = await api.get("/catalog/shops", { params });
      setShops((res.data.data?.items ?? []) as Shop[]);
    } catch (e) { toast.error(apiErrorMessage(e)); } finally { setLoading(false); }
  }
  // Reload whenever the taluk filter changes (also runs once on mount).
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [talukId]);

  // Load taluks once for the filter dropdown (labelled "Taluk — District").
  useEffect(() => {
    void (async () => {
      try {
        const r = await api.get("/public/locations");
        const ds = (r.data?.data?.districts ?? []) as { id: number; name: string }[];
        const ts = (r.data?.data?.taluks ?? []) as { id: number; district_id: number; name: string }[];
        const dById = new Map(ds.map((d) => [d.id, d.name]));
        setTaluks(ts.map((t) => ({ id: t.id, label: dById.get(t.district_id) ? `${t.name} — ${dById.get(t.district_id)}` : t.name })));
      } catch { /* filter just stays empty */ }
    })();
  }, []);

  return (
    <>
      <AppHeader title="Shops" />
      <section className="mx-auto max-w-md space-y-4 p-4 pb-24 md:max-w-4xl md:p-8">
        <div className="glass space-y-2 rounded-2xl p-3">
          <select
            value={talukId ?? ""}
            onChange={(e) => setTalukId(e.target.value ? Number(e.target.value) : null)}
            className="h-10 w-full rounded-xl border border-border bg-surface-2/60 px-3 text-sm outline-none focus:border-brand/50"
          >
            <option value="">All taluks</option>
            {taluks.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <form onSubmit={(e) => { e.preventDefault(); void refresh(); }} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search shops or area…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
            </div>
            <GradientButton type="submit"><Search className="h-4 w-4" /></GradientButton>
          </form>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
        ) : shops.length === 0 ? (
          <LuxuryCard hoverLift={false} className="p-10 text-center">
            <Store className="mx-auto mb-3 h-10 w-10 text-brand" />
            <p className="text-sm font-medium">No shops yet</p>
            <p className="text-xs text-muted-foreground">Try a different search.</p>
          </LuxuryCard>
        ) : (
          <div className="space-y-2">
            {shops.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Link href={`/shops/detail?id=${s.id}`}>
                  <LuxuryCard className="flex items-start gap-3 p-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl brand-gradient text-brand-foreground">
                      <Store className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{s.name}</p>
                      {s.address && (
                        <p className="flex items-start gap-1 text-xs text-muted-foreground">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                          <span className="line-clamp-2">{s.address}</span>
                        </p>
                      )}
                      <p className="truncate text-xs text-muted-foreground">{s.area}{s.pincode ? ` · ${s.pincode}` : ""}</p>
                      {s.mobile && (
                        <p className="truncate text-xs font-mono text-muted-foreground">{s.mobile}</p>
                      )}
                    </div>
                  </LuxuryCard>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
