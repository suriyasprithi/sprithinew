"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Route, Plus, Search, MoreHorizontal, Pencil, Trash2, Gauge, Clock } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

type GeoState    = { id: number; name: string };
type GeoDistrict = { id: number; name: string; state_id: number };
type GeoTaluk    = { id: number; name: string; district_id: number };

type KmRow = {
  id: number;
  taluk_id: number;
  from_km: number;
  to_km: number;
  price_per_km: number;
  state_name: string | null;
  district_name: string | null;
  taluk_name: string | null;
};
type TimeRow = {
  id: number;
  taluk_id: number;
  time_min: number;
  price: number;
  state_name: string | null;
  district_name: string | null;
  taluk_name: string | null;
};

type KmDraft = {
  id?: number;
  state_id?: number;
  district_id?: number;
  taluk_id?: number;
  from_km?: number;
  to_km?: number;
  price_per_km?: number;
};
type TimeDraft = {
  id?: number;
  state_id?: number;
  district_id?: number;
  taluk_id?: number;
  time_min?: number;
  price?: number;
};

function normalizeKm(raw: unknown): KmRow {
  const r = raw as Record<string, unknown>;
  return {
    id:            Number(r.id ?? 0),
    taluk_id:      Number(r.taluk_id ?? 0),
    from_km:       Number(r.from_km ?? 0),
    to_km:         Number(r.to_km ?? 0),
    price_per_km:  Number(r.price_per_km ?? 0),
    state_name:    (r.state_name as string | null | undefined) ?? null,
    district_name: (r.district_name as string | null | undefined) ?? null,
    taluk_name:    (r.taluk_name as string | null | undefined) ?? null,
  };
}
function normalizeTime(raw: unknown): TimeRow {
  const r = raw as Record<string, unknown>;
  return {
    id:            Number(r.id ?? 0),
    taluk_id:      Number(r.taluk_id ?? 0),
    time_min:      Number(r.time_min ?? 0),
    price:         Number(r.price ?? 0),
    state_name:    (r.state_name as string | null | undefined) ?? null,
    district_name: (r.district_name as string | null | undefined) ?? null,
    taluk_name:    (r.taluk_name as string | null | undefined) ?? null,
  };
}

function GeoSelects<T extends { state_id?: number; district_id?: number; taluk_id?: number }>({
  value, onChange, states, districts, taluks,
}: {
  value: T;
  onChange: (next: T) => void;
  states: GeoState[];
  districts: GeoDistrict[];
  taluks: GeoTaluk[];
}) {
  const districtOpts = districts.filter((d) => !value.state_id || d.state_id === value.state_id);
  const talukOpts    = taluks.filter((t) => !value.district_id || t.district_id === value.district_id);

  // Base UI's <Select.Value> can only show the label of a mounted item; once
  // the popup closes the items unmount and it falls back to printing the raw
  // value (the id). Passing `items` (value → name) lets it render the name.
  const stateItems    = states.map((s)    => ({ value: String(s.id), label: s.name }));
  const districtItems = districts.map((d) => ({ value: String(d.id), label: d.name }));
  const talukItems    = taluks.map((t)    => ({ value: String(t.id), label: t.name }));

  return (
    <>
      <div className="space-y-1.5">
        <Label>State</Label>
        <Combobox
          value={value.state_id ? String(value.state_id) : ""}
          onValueChange={(v) => v && onChange({ ...value, state_id: Number(v), district_id: undefined, taluk_id: undefined })}
          options={stateItems}
          placeholder="--Select State--"
          searchPlaceholder="Search state…"
          emptyText="No state found."
        />
      </div>
      <div className="space-y-1.5">
        <Label>District</Label>
        <Combobox
          value={value.district_id ? String(value.district_id) : ""}
          onValueChange={(v) => v && onChange({ ...value, district_id: Number(v), taluk_id: undefined })}
          disabled={!value.state_id}
          options={districtOpts.map((d) => ({ value: String(d.id), label: d.name }))}
          placeholder="--Select District--"
          searchPlaceholder="Search district…"
          emptyText="No district found."
        />
      </div>
      <div className="space-y-1.5">
        <Label>Taluk</Label>
        <Combobox
          value={value.taluk_id ? String(value.taluk_id) : ""}
          onValueChange={(v) => v && onChange({ ...value, taluk_id: Number(v) })}
          disabled={!value.district_id}
          options={talukOpts.map((t) => ({ value: String(t.id), label: t.name }))}
          placeholder={talukOpts.length ? "--Select Taluk--" : "No taluks"}
          searchPlaceholder="Search taluk…"
          emptyText="No taluk found."
        />
      </div>
    </>
  );
}

export default function DeliveryRatesPage() {
  // KM management was retired from this screen — it's a Time-only manager now.
  // `tab` stays typed for the (unused) KM table/modal code below; it never changes.
  const [tab] = useState<"km" | "time">("time");
  const [kmRows, setKmRows] = useState<KmRow[]>([]);
  const [timeRows, setTimeRows] = useState<TimeRow[]>([]);
  const [states, setStates] = useState<GeoState[]>([]);
  const [districts, setDistricts] = useState<GeoDistrict[]>([]);
  const [taluks, setTaluks] = useState<GeoTaluk[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [kmEditing, setKmEditing] = useState<KmDraft | null>(null);
  const [timeEditing, setTimeEditing] = useState<TimeDraft | null>(null);
  const [deleteKmId, setDeleteKmId] = useState<number | null>(null);
  const [deleteTimeId, setDeleteTimeId] = useState<number | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [km, tm, st, di, ta] = await Promise.all([
        api.get("/admin/delivery-rates/km"),
        api.get("/admin/delivery-rates/time"),
        api.get("/geo/states"),
        api.get("/geo/districts"),
        api.get("/geo/taluks"),
      ]);
      const asArray = (r: unknown): unknown[] =>
        Array.isArray((r as { data?: { data?: { items?: unknown } } })?.data?.data?.items)
          ? ((r as { data: { data: { items: unknown[] } } }).data.data.items)
          : [];
      setKmRows(asArray(km).map(normalizeKm));
      setTimeRows(asArray(tm).map(normalizeTime));
      setStates(asArray(st).map((s) => ({ id: Number((s as Record<string, unknown>).id ?? 0), name: String((s as Record<string, unknown>).name ?? "") })));
      setDistricts(asArray(di).map((d) => {
        const r = d as Record<string, unknown>;
        return { id: Number(r.id ?? 0), name: String(r.name ?? ""), state_id: Number(r.state_id ?? 0) };
      }));
      setTaluks(asArray(ta).map((t) => {
        const r = t as Record<string, unknown>;
        return { id: Number(r.id ?? 0), name: String(r.name ?? ""), district_id: Number(r.district_id ?? 0) };
      }));
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load delivery rates"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, []);
  useEffect(() => setSearch(""), [tab]);

  const filteredKm = useMemo(() => kmRows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.state_name ?? "").toLowerCase().includes(q)
      || (r.district_name ?? "").toLowerCase().includes(q)
      || (r.taluk_name ?? "").toLowerCase().includes(q);
  }), [kmRows, search]);

  const filteredTime = useMemo(() => timeRows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.state_name ?? "").toLowerCase().includes(q)
      || (r.district_name ?? "").toLowerCase().includes(q)
      || (r.taluk_name ?? "").toLowerCase().includes(q);
  }), [timeRows, search]);

  /** When opening Edit, pre-fill state/district/taluk IDs by walking the taluk → district → state chain. */
  function chainFor(taluk_id: number): { state_id?: number; district_id?: number; taluk_id?: number } {
    const taluk = taluks.find((t) => t.id === taluk_id);
    if (!taluk) return { taluk_id };
    const district = districts.find((d) => d.id === taluk.district_id);
    return {
      taluk_id,
      district_id: district?.id,
      state_id: district?.state_id,
    };
  }

  async function saveKm() {
    if (!kmEditing) return;
    const { from_km, to_km, taluk_id, price_per_km } = kmEditing;
    if (from_km == null || to_km == null) { toast.error("From & To KM required"); return; }
    if (Number(to_km) <= Number(from_km)) { toast.error("To KM must be greater than From KM"); return; }
    if (!taluk_id) { toast.error("Select state, district & taluk"); return; }
    if (price_per_km == null || Number(price_per_km) < 0) { toast.error("Invalid per-km price"); return; }

    setSaving(true);
    try {
      const payload = {
        taluk_id, from_km: Number(from_km), to_km: Number(to_km), price_per_km: Number(price_per_km),
      };
      if (kmEditing.id) {
        await api.patch(`/admin/delivery-rates/km/${kmEditing.id}`, payload);
        toast.success("Slab updated");
      } else {
        await api.post("/admin/delivery-rates/km", payload);
        toast.success("Slab added");
      }
      setKmEditing(null);
      await loadAll();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  async function saveTime() {
    if (!timeEditing) return;
    const { time_min, taluk_id, price } = timeEditing;
    if (time_min == null || Number(time_min) <= 0) { toast.error("Time (minutes) required"); return; }
    if (!taluk_id) { toast.error("Select state, district & taluk"); return; }
    if (price == null || Number(price) < 0) { toast.error("Invalid price"); return; }

    setSaving(true);
    try {
      const payload = { taluk_id, time_min: Number(time_min), price: Number(price) };
      if (timeEditing.id) {
        await api.patch(`/admin/delivery-rates/time/${timeEditing.id}`, payload);
        toast.success("Time rate updated");
      } else {
        await api.post("/admin/delivery-rates/time", payload);
        toast.success("Time rate added");
      }
      setTimeEditing(null);
      await loadAll();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  async function doDeleteKm() {
    if (deleteKmId == null) return;
    try {
      await api.delete(`/admin/delivery-rates/km/${deleteKmId}`);
      toast.success("Slab removed");
      setDeleteKmId(null);
      await loadAll();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Delete failed"));
    }
  }

  async function doDeleteTime() {
    if (deleteTimeId == null) return;
    try {
      await api.delete(`/admin/delivery-rates/time/${deleteTimeId}`);
      toast.success("Time rate removed");
      setDeleteTimeId(null);
      await loadAll();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Delete failed"));
    }
  }

  const avgTime = timeRows.length ? timeRows.reduce((s, r) => s + r.price, 0) / timeRows.length    : 0;

  return (
    <>
      <MobileHeader title="Delivery rates" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Operations"
          icon={Route}
          title="Delivery rates"
          description="Per-geography KM slabs and time tiers used to compute driver payouts."
          action={
            tab === "km"
              ? <GradientButton onClick={() => setKmEditing({})}><Plus className="h-4 w-4" /> Add Delivery KM</GradientButton>
              : <GradientButton onClick={() => setTimeEditing({})}><Plus className="h-4 w-4" /> Add Delivery Time</GradientButton>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="Time tiers"        value={timeRows.length}                            icon={Clock}     tone="violet"  spark={[1, 1, 2, 2, 2, 3, 3, 3]} />
          <StatCard label="Avg time price"    value={Math.round(avgTime * 100) / 100}            icon={Clock}     tone="emerald" spark={[2, 3, 3, 4, 4, 4, 5, 5]} format={fmtINR} />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search by state, district, taluk…`} className="h-10 rounded-xl bg-surface-2/60 pl-9" />
          </div>
        </div>

        {tab === "km" ? (
          <div className="luxe-card overflow-hidden">
            <div className="hidden grid-cols-[120px_120px_1fr_1fr_1fr_140px_56px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
              <span>From KM</span>
              <span>To KM</span>
              <span>State</span>
              <span>District</span>
              <span>Taluk</span>
              <span>Per KM Price</span>
              <span className="text-right">Actions</span>
            </div>
            {loading ? (
              <div className="p-3"><TableSkeleton rows={4} cols={7} /></div>
            ) : filteredKm.length === 0 ? (
              <EmptyState
                icon={Gauge}
                title="No KM slabs yet"
                description="Create a slab to bill by distance for a specific taluk."
                action={<GradientButton onClick={() => setKmEditing({})}><Plus className="h-4 w-4" /> Add Delivery KM</GradientButton>}
              />
            ) : (
              <div className="divide-y divide-border">
                {filteredKm.map((r, i) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[120px_120px_1fr_1fr_1fr_140px_56px]"
                  >
                    <div className="flex items-center gap-3 md:contents">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand md:hidden">
                        <Gauge className="h-4 w-4" />
                      </span>
                      <p className="hidden text-sm font-medium md:block">{r.from_km} km</p>
                      <p className="hidden text-sm font-medium md:block">{r.to_km} km</p>
                      <p className="text-sm font-semibold md:text-sm md:font-medium">
                        <span className="md:hidden">{r.from_km}–{r.to_km} km · </span>{r.state_name ?? "—"}
                      </p>
                      <p className="hidden text-sm text-muted-foreground md:block">{r.district_name ?? "—"}</p>
                      <p className="hidden text-sm text-muted-foreground md:block">{r.taluk_name ?? "—"}</p>
                      <p className="hidden text-sm font-semibold text-brand md:block">{fmtINR(r.price_per_km)} / km</p>
                    </div>
                    <div className="flex items-center gap-2 justify-self-end">
                      <p className="text-sm font-semibold text-brand md:hidden">{fmtINR(r.price_per_km)}/km</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button type="button" aria-label="Row actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => setKmEditing({
                            id: r.id,
                            from_km: r.from_km,
                            to_km: r.to_km,
                            price_per_km: r.price_per_km,
                            ...chainFor(r.taluk_id),
                          })}>
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setDeleteKmId(r.id)} className="text-rose-400 focus:text-rose-400">
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="luxe-card overflow-hidden">
            <div className="hidden grid-cols-[120px_1fr_72px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
              <span>Time</span>
              <span>Price</span>
              <span className="whitespace-nowrap text-center">Actions</span>
            </div>
            {loading ? (
              <div className="p-3"><TableSkeleton rows={4} cols={6} /></div>
            ) : filteredTime.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No time tiers yet"
                description="Create a time tier to bill by minutes for a specific taluk."
                action={<GradientButton onClick={() => setTimeEditing({})}><Plus className="h-4 w-4" /> Add Delivery Time</GradientButton>}
              />
            ) : (
              <div className="divide-y divide-border">
                {filteredTime.map((r, i) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[120px_1fr_72px]"
                  >
                    <div className="flex items-center gap-3 md:contents">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400 md:hidden">
                        <Clock className="h-4 w-4" />
                      </span>
                      <p className="text-sm font-semibold md:font-medium">{r.time_min} min</p>
                      <p className="hidden text-sm font-semibold text-brand md:block">{fmtINR(r.price)}</p>
                    </div>
                    <div className="flex items-center gap-2 justify-self-end md:justify-self-center">
                      <p className="text-sm font-semibold text-brand md:hidden">{fmtINR(r.price)}</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button type="button" aria-label="Row actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => setTimeEditing({
                            id: r.id,
                            time_min: r.time_min,
                            price: r.price,
                            ...chainFor(r.taluk_id),
                          })}>
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setDeleteTimeId(r.id)} className="text-rose-400 focus:text-rose-400">
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Add / Edit Delivery KM modal */}
      <Dialog open={!!kmEditing} onOpenChange={(o) => !o && setKmEditing(null)}>
        <DialogContent className="max-w-lg rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg brand-gradient text-brand-foreground"><Gauge className="h-4 w-4" /></span>
              {kmEditing?.id ? "Edit Delivery KM" : "Add Delivery KM"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>From KM</Label>
              <Input type="number" step="0.1" value={kmEditing?.from_km ?? ""} onChange={(e) => setKmEditing((p) => ({ ...(p ?? {}), from_km: e.target.value === "" ? undefined : Number(e.target.value) }))} placeholder="Enter From KM" />
            </div>
            <div className="space-y-1.5">
              <Label>To KM</Label>
              <Input type="number" step="0.1" value={kmEditing?.to_km ?? ""} onChange={(e) => setKmEditing((p) => ({ ...(p ?? {}), to_km: e.target.value === "" ? undefined : Number(e.target.value) }))} placeholder="Enter To KM" />
            </div>
            <GeoSelects
              value={kmEditing ?? {}}
              onChange={(next) => setKmEditing((p) => ({ ...(p ?? {}), ...next }))}
              states={states}
              districts={districts}
              taluks={taluks}
            />
            <div className="space-y-1.5 md:col-span-2">
              <Label>Per KM Price</Label>
              <Input type="number" step="0.01" value={kmEditing?.price_per_km ?? ""} onChange={(e) => setKmEditing((p) => ({ ...(p ?? {}), price_per_km: e.target.value === "" ? undefined : Number(e.target.value) }))} placeholder="Enter Per KM Price" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setKmEditing(null)} disabled={saving}>Cancel</Button>
            <GradientButton onClick={() => void saveKm()} disabled={saving}>{saving ? "Saving…" : (kmEditing?.id ? "Save changes" : "Save")}</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Delivery Time modal */}
      <Dialog open={!!timeEditing} onOpenChange={(o) => !o && setTimeEditing(null)}>
        <DialogContent className="max-w-lg rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400"><Clock className="h-4 w-4" /></span>
              {timeEditing?.id ? "Edit Delivery Time" : "Add Delivery Time"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Time (minutes)</Label>
              <Input type="number" step="1" value={timeEditing?.time_min ?? ""} onChange={(e) => setTimeEditing((p) => ({ ...(p ?? {}), time_min: e.target.value === "" ? undefined : Number(e.target.value) }))} placeholder="Enter Time" />
            </div>
            <div className="space-y-1.5">
              <Label>Price</Label>
              <Input type="number" step="0.01" value={timeEditing?.price ?? ""} onChange={(e) => setTimeEditing((p) => ({ ...(p ?? {}), price: e.target.value === "" ? undefined : Number(e.target.value) }))} placeholder="Enter Price" />
            </div>
            <GeoSelects
              value={timeEditing ?? {}}
              onChange={(next) => setTimeEditing((p) => ({ ...(p ?? {}), ...next }))}
              states={states}
              districts={districts}
              taluks={taluks}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTimeEditing(null)} disabled={saving}>Cancel</Button>
            <GradientButton onClick={() => void saveTime()} disabled={saving}>{saving ? "Saving…" : (timeEditing?.id ? "Save changes" : "Save")}</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteKmId != null} onOpenChange={(o) => !o && setDeleteKmId(null)}>
        <AlertDialogContent className="rounded-2xl border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete KM slab?</AlertDialogTitle>
            <AlertDialogDescription>Deliveries in this distance range for this taluk will fall back to the next matching slab.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doDeleteKm()} className="bg-brand text-brand-foreground hover:bg-brand/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTimeId != null} onOpenChange={(o) => !o && setDeleteTimeId(null)}>
        <AlertDialogContent className="rounded-2xl border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete time tier?</AlertDialogTitle>
            <AlertDialogDescription>This tier will no longer be used when calculating driver payouts.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doDeleteTime()} className="bg-brand text-brand-foreground hover:bg-brand/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
