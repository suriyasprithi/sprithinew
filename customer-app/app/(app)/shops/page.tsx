"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Search, Store } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { api, apiErrorMessage } from "@/lib/api";

type Shop = { id: number; name: string; area: string; pincode: string; image: string; product_count: number };

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const res = await api.get("/catalog/shops", { params: q ? { q } : {} });
      setShops((res.data.data?.items ?? []) as Shop[]);
    } catch (e) { toast.error(apiErrorMessage(e)); } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <>
      <AppHeader title="Shops" />
      <section className="mx-auto max-w-md space-y-4 p-4 pb-24 md:max-w-4xl md:p-8">
        <div className="glass rounded-2xl p-3">
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
                  <LuxuryCard className="flex items-center gap-3 p-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl brand-gradient text-brand-foreground">
                      <Store className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.area}{s.pincode ? ` · ${s.pincode}` : ""}</p>
                    </div>
                    <span className="rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
                      {s.product_count} items
                    </span>
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
