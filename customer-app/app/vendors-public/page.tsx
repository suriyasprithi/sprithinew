"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, MapPin, Search, Store } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/skeletons";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/stores/auth";

type Vendor = { id: number; name: string; mobile: string; shop_name: string | null; address: string | null; area: string | null; gst: string | null };

export default function PublicVendorsPage() {
  const { user, isHydrated } = useAuth();
  const [items, setItems] = useState<Vendor[]>([]);
  const [pincode, setPincode] = useState("");
  const [taluks, setTaluks] = useState<{ id: number; label: string }[]>([]);
  const [talukId, setTalukId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (pincode) params.pincode = pincode;
      if (talukId) params.taluk_id = String(talukId);
      const r = await api.get("/public/vendors", { params });
      setItems((r.data.data?.items ?? []) as Vendor[]);
    }
    catch (err) { toast.error(apiErrorMessage(err)); }
    finally { setLoading(false); }
  };
  // Reload whenever the taluk filter changes (also runs once on mount).
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [talukId]);

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
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 glass">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/home" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <p className="text-base font-semibold tracking-tight">Vendors</p>
          {isHydrated && user
            ? <Link href="/dashboard" className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-xs font-medium hover:border-brand/40">My account</Link>
            : <Link href="/login"><GradientButton size="sm">Sign in</GradientButton></Link>}
        </div>
      </header>

      <section className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
        <div className="glass space-y-2 rounded-2xl p-3">
          <select
            value={talukId ?? ""}
            onChange={(e) => setTalukId(e.target.value ? Number(e.target.value) : null)}
            className="h-10 w-full rounded-xl border border-border bg-surface-2/60 px-3 text-sm outline-none focus:border-brand/50"
          >
            <option value="">All taluks</option>
            {taluks.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <form onSubmit={(e) => { e.preventDefault(); void load(); }} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="Filter by pincode…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
            </div>
            <GradientButton type="submit"><Search className="h-4 w-4" /> Search</GradientButton>
          </form>
        </div>

        {loading ? (
          <ListSkeleton rows={4} />
        ) : items.length === 0 ? (
          <LuxuryCard hoverLift={false} className="border-dashed p-10 text-center">
            <Store className="mx-auto mb-3 h-10 w-10 text-brand" />
            <p className="text-sm font-medium">No vendors found</p>
            <p className="text-xs text-muted-foreground">Try a different pincode.</p>
          </LuxuryCard>
        ) : (
          <div className="space-y-2">
            {items.map((v, i) => (
              <motion.div
                key={v.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link href={`/shop-public?vendor_id=${v.id}`} className="block">
                  <LuxuryCard className="p-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl brand-gradient text-sm font-semibold text-brand-foreground">
                        {(v.shop_name ?? v.name).charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{v.shop_name ?? v.name}</p>
                        {v.address && (
                          <p className="flex items-start gap-1 text-xs text-muted-foreground">
                            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                            <span className="line-clamp-2">{v.address}</span>
                          </p>
                        )}
                        <p className="truncate text-xs text-muted-foreground">{v.area ?? "—"} · {v.mobile}</p>
                      </div>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  </LuxuryCard>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
