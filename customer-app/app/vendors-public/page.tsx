"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, MapPin, Search, Store, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ListSkeleton } from "@/components/skeletons";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { cn } from "@/lib/utils";
import { getCustomerCoordsQuiet, readCustomerCoords, distanceToVendor, formatDistance, COORDS_EVENT, type Coords } from "@/lib/geo";

type Vendor = { id: number; name: string; mobile: string; shop_name: string | null; address: string | null; area: string | null; gst: string | null; latitude?: number | null; longitude?: number | null };
type Taluk = { id: number; label: string };
type Cat = { id: number; name: string };

export default function PublicVendorsPage() {
  const { user, isHydrated } = useAuth();

  // Taluk (required) — searchable picker.
  const [taluks, setTaluks] = useState<Taluk[]>([]);
  const [talukId, setTalukId] = useState<number | null>(null);
  const [talukLabel, setTalukLabel] = useState("");
  const [talukSearch, setTalukSearch] = useState("");
  const [talukOpen, setTalukOpen] = useState(false);
  const talukBoxRef = useRef<HTMLDivElement>(null);

  // Vendor categories (chips) for the chosen taluk.
  const [cats, setCats] = useState<Cat[]>([]);
  const [catId, setCatId] = useState<number | null>(null);
  const [loadingCats, setLoadingCats] = useState(false);

  // Shops in the chosen taluk + category, with an in-list name filter.
  const [shops, setShops] = useState<Vendor[]>([]);
  const [nameQuery, setNameQuery] = useState("");
  const [loadingShops, setLoadingShops] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);

  // Customer location for "X km away" (quiet: cached/granted coords only).
  useEffect(() => {
    void getCustomerCoordsQuiet().then((c) => { if (c) setCoords(c); });
    if (typeof window === "undefined") return;
    const onCoords = () => setCoords(readCustomerCoords());
    window.addEventListener(COORDS_EVENT, onCoords);
    return () => window.removeEventListener(COORDS_EVENT, onCoords);
  }, []);

  // Load all taluks once (labelled "Taluk — District").
  useEffect(() => {
    void (async () => {
      try {
        const r = await api.get("/public/locations");
        const ds = (r.data?.data?.districts ?? []) as { id: number; name: string }[];
        const ts = (r.data?.data?.taluks ?? []) as { id: number; district_id: number; name: string }[];
        const dById = new Map(ds.map((d) => [d.id, d.name]));
        setTaluks(ts.map((t) => ({ id: t.id, label: dById.get(t.district_id) ? `${t.name} — ${dById.get(t.district_id)}` : t.name })));
      } catch { /* taluk list stays empty */ }
    })();
  }, []);

  // Close the taluk dropdown when clicking outside it.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (talukBoxRef.current && !talukBoxRef.current.contains(e.target as Node)) setTalukOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Taluk picked → load its vendor categories (taluk-filtered so empty ones hide); reset the rest.
  useEffect(() => {
    setCatId(null); setCats([]); setShops([]); setNameQuery("");
    if (!talukId) return;
    setLoadingCats(true);
    void (async () => {
      try {
        const r = await api.get("/vendor-categories", { params: { taluk_id: String(talukId) } });
        setCats(((r.data.data?.items ?? []) as { id: number; name: string }[]).map((c) => ({ id: c.id, name: c.name })));
      } catch (e) { toast.error(apiErrorMessage(e)); }
      finally { setLoadingCats(false); }
    })();
  }, [talukId]);

  // Category picked → load shops in that taluk + category.
  useEffect(() => {
    setShops([]); setNameQuery("");
    if (!talukId || !catId) return;
    setLoadingShops(true);
    void (async () => {
      try {
        const r = await api.get("/public/vendors", { params: { taluk_id: String(talukId), vendor_category_id: String(catId) } });
        setShops((r.data.data?.items ?? []) as Vendor[]);
      } catch (e) { toast.error(apiErrorMessage(e)); }
      finally { setLoadingShops(false); }
    })();
  }, [talukId, catId]);

  const filteredTaluks = useMemo(() => {
    const q = talukSearch.trim().toLowerCase();
    return (q ? taluks.filter((t) => t.label.toLowerCase().includes(q)) : taluks).slice(0, 60);
  }, [taluks, talukSearch]);

  const filteredShops = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    const base = q ? shops.filter((v) => (v.shop_name ?? v.name).toLowerCase().includes(q)) : shops;
    if (!coords) return base;
    // Nearest-first when we know where the customer is; unlocated shops sink.
    return [...base].sort((a, b) => {
      const da = distanceToVendor(coords, a);
      const db = distanceToVendor(coords, b);
      if (da == null) return db == null ? 0 : 1;
      if (db == null) return -1;
      return da - db;
    });
  }, [shops, nameQuery, coords]);

  const pickTaluk = (t: Taluk) => { setTalukId(t.id); setTalukLabel(t.label); setTalukSearch(""); setTalukOpen(false); };
  const clearTaluk = () => { setTalukId(null); setTalukLabel(""); setTalukSearch(""); setTalukOpen(false); };

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 glass">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/home" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <p className="text-base font-semibold tracking-tight">Shops</p>
          {isHydrated && user
            ? <Link href="/dashboard" className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-xs font-medium hover:border-brand/40">My account</Link>
            : <Link href="/login"><GradientButton size="sm">Sign in</GradientButton></Link>}
        </div>
      </header>

      <section className="mx-auto max-w-3xl space-y-5 p-4 md:p-8">
        {/* Step 1: pick a taluk (required) */}
        <div ref={talukBoxRef} className="relative">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Taluk</p>
          {talukId ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-brand/40 bg-brand/5 px-3 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                <MapPin className="h-4 w-4 text-brand" /> {talukLabel}
              </span>
              <button type="button" onClick={clearTaluk} className="text-muted-foreground hover:text-foreground" aria-label="Change taluk">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={talukSearch}
                  onChange={(e) => { setTalukSearch(e.target.value); setTalukOpen(true); }}
                  onFocus={() => setTalukOpen(true)}
                  placeholder="Search your taluk…"
                  className="h-11 rounded-xl bg-surface-2/60 pl-9"
                />
              </div>
              {talukOpen && filteredTaluks.length > 0 && (
                <div className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-popover shadow-lg">
                  {filteredTaluks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => pickTaluk(t)}
                      className="block w-full px-3 py-2.5 text-left text-sm hover:bg-surface-2/60"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {!talukId ? (
          <LuxuryCard hoverLift={false} className="border-dashed p-10 text-center">
            <MapPin className="mx-auto mb-3 h-10 w-10 text-brand" />
            <p className="text-sm font-medium">Choose your taluk</p>
            <p className="text-xs text-muted-foreground">Search and pick a taluk to browse shops.</p>
          </LuxuryCard>
        ) : (
          <>
            {/* Step 2: category chips */}
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Category</p>
              {loadingCats ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 6 }).map((_, i) => <span key={i} className="h-8 w-20 animate-pulse rounded-full bg-surface-2/60" />)}
                </div>
              ) : cats.length === 0 ? (
                <p className="text-xs text-muted-foreground">No shop categories in this taluk yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {cats.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCatId(c.id)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                        catId === c.id
                          ? "border-brand bg-brand text-brand-foreground"
                          : "border-border bg-surface-2/60 hover:border-brand/40 hover:text-brand",
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Step 3: shops in the chosen category */}
            {!catId ? (
              <LuxuryCard hoverLift={false} className="border-dashed p-10 text-center">
                <Store className="mx-auto mb-3 h-10 w-10 text-brand" />
                <p className="text-sm font-medium">Pick a category</p>
                <p className="text-xs text-muted-foreground">Tap a category above to see shops.</p>
              </LuxuryCard>
            ) : (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={nameQuery}
                    onChange={(e) => setNameQuery(e.target.value)}
                    placeholder="Search shop name…"
                    className="h-11 rounded-xl bg-surface-2/60 pl-9"
                  />
                </div>

                {loadingShops ? (
                  <ListSkeleton rows={4} />
                ) : filteredShops.length === 0 ? (
                  <LuxuryCard hoverLift={false} className="border-dashed p-10 text-center">
                    <Store className="mx-auto mb-3 h-10 w-10 text-brand" />
                    <p className="text-sm font-medium">No shops found</p>
                    <p className="text-xs text-muted-foreground">{shops.length === 0 ? "No shops in this category for this taluk." : "No shop matches that name."}</p>
                  </LuxuryCard>
                ) : (
                  <div className="space-y-2">
                    {filteredShops.map((v, i) => (
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
                                <p className="truncate text-xs text-muted-foreground">
                                  {v.area ?? "—"} · {v.mobile}
                                  {(() => { const d = distanceToVendor(coords, v); return d != null ? ` · ${formatDistance(d)} away` : ""; })()}
                                </p>
                              </div>
                              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            </div>
                          </LuxuryCard>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
