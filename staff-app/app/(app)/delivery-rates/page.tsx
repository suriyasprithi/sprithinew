"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Route, Plus, Search, MoreHorizontal, Pencil, Trash2, Gauge, Clock } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { mock, type DeliveryKmSlab, type DeliveryTimeRate, type GeoRow } from "@/lib/mock";
import { cn } from "@/lib/utils";

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

type KmDraft = Partial<DeliveryKmSlab>;
type TimeDraft = Partial<DeliveryTimeRate>;

type GeoFields = { state?: string; district?: string; taluk?: string };

function GeoSelects<T extends GeoFields>({ value, onChange, states, districts, taluks }: {
  value: T;
  onChange: (next: T) => void;
  states: GeoRow[];
  districts: GeoRow[];
  taluks: GeoRow[];
}) {
  const districtOpts = districts.filter((d) => !value.state || d.parent_name === value.state);
  const talukOpts    = taluks.filter((t) => !value.district || t.parent_name === value.district);

  return (
    <>
      <div className="space-y-1.5">
        <Label>State</Label>
        <Select value={value.state ?? ""} onValueChange={(v) => v && onChange({ ...value, state: v, district: undefined, taluk: undefined })}>
          <SelectTrigger><SelectValue placeholder="--Select State--" /></SelectTrigger>
          <SelectContent>
            {states.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>District</Label>
        <Select value={value.district ?? ""} onValueChange={(v) => v && onChange({ ...value, district: v, taluk: undefined })} disabled={!value.state}>
          <SelectTrigger><SelectValue placeholder="--Select District--" /></SelectTrigger>
          <SelectContent>
            {districtOpts.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Taluk</Label>
        <Select value={value.taluk ?? ""} onValueChange={(v) => v && onChange({ ...value, taluk: v })} disabled={!value.district}>
          <SelectTrigger><SelectValue placeholder={talukOpts.length ? "--Select Taluk--" : "No taluks"} /></SelectTrigger>
          <SelectContent>
            {talukOpts.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

export default function DeliveryRatesPage() {
  const [tab, setTab] = useState<"km" | "time">("km");
  const [kmRows, setKmRows] = useState<DeliveryKmSlab[]>([]);
  const [timeRows, setTimeRows] = useState<DeliveryTimeRate[]>([]);
  const [states, setStates] = useState<GeoRow[]>([]);
  const [districts, setDistricts] = useState<GeoRow[]>([]);
  const [taluks, setTaluks] = useState<GeoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [kmEditing, setKmEditing] = useState<KmDraft | null>(null);
  const [timeEditing, setTimeEditing] = useState<TimeDraft | null>(null);
  const [deleteKmId, setDeleteKmId] = useState<number | null>(null);
  const [deleteTimeId, setDeleteTimeId] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const [km, tm, st, di, ta] = await Promise.all([
        mock.deliveryKmSlabs(), mock.deliveryTimeRates(),
        mock.states(), mock.districts(), mock.taluks(),
      ]);
      setKmRows(km); setTimeRows(tm);
      setStates(st); setDistricts(di); setTaluks(ta);
      setLoading(false);
    })();
  }, []);

  useEffect(() => setSearch(""), [tab]);

  const filteredKm = useMemo(() => kmRows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.state.toLowerCase().includes(q) || r.district.toLowerCase().includes(q) || r.taluk.toLowerCase().includes(q);
  }), [kmRows, search]);

  const filteredTime = useMemo(() => timeRows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.state.toLowerCase().includes(q) || r.district.toLowerCase().includes(q) || r.taluk.toLowerCase().includes(q);
  }), [timeRows, search]);

  function saveKm() {
    if (!kmEditing) return;
    const { from_km, to_km, state, district, taluk, price_per_km } = kmEditing;
    if (from_km == null || to_km == null) { toast.error("From & To KM required"); return; }
    if (Number(to_km) <= Number(from_km)) { toast.error("To KM must be greater than From KM"); return; }
    if (!state || !district || !taluk) { toast.error("Select state, district & taluk"); return; }
    if (price_per_km == null || Number(price_per_km) < 0) { toast.error("Invalid per-km price"); return; }
    if (kmEditing.id) {
      setKmRows((cur) => cur.map((r) => (r.id === kmEditing.id ? { ...r, ...kmEditing } as DeliveryKmSlab : r)));
      toast.success("Slab updated");
    } else {
      const id = Math.max(0, ...kmRows.map((r) => r.id)) + 1;
      setKmRows((cur) => [...cur, {
        id, from_km: Number(from_km), to_km: Number(to_km),
        state, district, taluk, price_per_km: Number(price_per_km),
      }]);
      toast.success("Slab added");
    }
    setKmEditing(null);
  }

  function saveTime() {
    if (!timeEditing) return;
    const { time_min, state, district, taluk, price } = timeEditing;
    if (time_min == null || Number(time_min) <= 0) { toast.error("Time (minutes) required"); return; }
    if (!state || !district || !taluk) { toast.error("Select state, district & taluk"); return; }
    if (price == null || Number(price) < 0) { toast.error("Invalid price"); return; }
    if (timeEditing.id) {
      setTimeRows((cur) => cur.map((r) => (r.id === timeEditing.id ? { ...r, ...timeEditing } as DeliveryTimeRate : r)));
      toast.success("Time rate updated");
    } else {
      const id = Math.max(0, ...timeRows.map((r) => r.id)) + 1;
      setTimeRows((cur) => [...cur, {
        id, time_min: Number(time_min),
        state, district, taluk, price: Number(price),
      }]);
      toast.success("Time rate added");
    }
    setTimeEditing(null);
  }

  function deleteKm() {
    if (deleteKmId == null) return;
    setKmRows((cur) => cur.filter((r) => r.id !== deleteKmId));
    toast.success("Slab removed");
    setDeleteKmId(null);
  }

  function deleteTime() {
    if (deleteTimeId == null) return;
    setTimeRows((cur) => cur.filter((r) => r.id !== deleteTimeId));
    toast.success("Time rate removed");
    setDeleteTimeId(null);
  }

  const avgKm   = kmRows.length   ? kmRows.reduce((s, r) => s + r.price_per_km, 0) / kmRows.length : 0;
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
              ? <GradientButton onClick={() => setKmEditing({ from_km: undefined, to_km: undefined })}><Plus className="h-4 w-4" /> Add Delivery KM</GradientButton>
              : <GradientButton onClick={() => setTimeEditing({})}><Plus className="h-4 w-4" /> Add Delivery Time</GradientButton>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="KM slabs"          value={kmRows.length}                              icon={Gauge}     tone="brand"   spark={[1, 2, 2, 3, 3, 4, 4, 4]} />
          <StatCard label="Avg price / km"    value={Math.round(avgKm * 100) / 100}              icon={Gauge}     tone="amber"   spark={[3, 3, 4, 4, 4, 5, 5, 5]} format={fmtINR} />
          <StatCard label="Time tiers"        value={timeRows.length}                            icon={Clock}     tone="violet"  spark={[1, 1, 2, 2, 2, 3, 3, 3]} />
          <StatCard label="Avg time price"    value={Math.round(avgTime * 100) / 100}            icon={Clock}     tone="emerald" spark={[2, 3, 3, 4, 4, 4, 5, 5]} format={fmtINR} />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setTab("km")}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
              tab === "km" ? "border-brand bg-brand/10 text-brand brand-glow" : "border-border bg-surface hover:border-brand/40",
            )}
          >
            <Gauge className="h-4 w-4" /> Delivery KM
          </button>
          <button
            onClick={() => setTab("time")}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
              tab === "time" ? "border-brand bg-brand/10 text-brand brand-glow" : "border-border bg-surface hover:border-brand/40",
            )}
          >
            <Clock className="h-4 w-4" /> Delivery Time
          </button>
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
                        <span className="md:hidden">{r.from_km}–{r.to_km} km · </span>{r.state}
                      </p>
                      <p className="hidden text-sm text-muted-foreground md:block">{r.district}</p>
                      <p className="hidden text-sm text-muted-foreground md:block">{r.taluk}</p>
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
                          <DropdownMenuItem onClick={() => setKmEditing(r)}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
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
            <div className="hidden grid-cols-[120px_1fr_1fr_1fr_140px_56px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
              <span>Time</span>
              <span>State</span>
              <span>District</span>
              <span>Taluk</span>
              <span>Price</span>
              <span className="text-right">Actions</span>
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
                    className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[120px_1fr_1fr_1fr_140px_56px]"
                  >
                    <div className="flex items-center gap-3 md:contents">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400 md:hidden">
                        <Clock className="h-4 w-4" />
                      </span>
                      <p className="hidden text-sm font-medium md:block">{r.time_min} min</p>
                      <p className="text-sm font-semibold md:text-sm md:font-medium">
                        <span className="md:hidden">{r.time_min} min · </span>{r.state}
                      </p>
                      <p className="hidden text-sm text-muted-foreground md:block">{r.district}</p>
                      <p className="hidden text-sm text-muted-foreground md:block">{r.taluk}</p>
                      <p className="hidden text-sm font-semibold text-brand md:block">{fmtINR(r.price)}</p>
                    </div>
                    <div className="flex items-center gap-2 justify-self-end">
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
                          <DropdownMenuItem onClick={() => setTimeEditing(r)}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
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
            <Button variant="ghost" onClick={() => setKmEditing(null)}>Cancel</Button>
            <GradientButton onClick={saveKm}>{kmEditing?.id ? "Save changes" : "Save"}</GradientButton>
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
            <Button variant="ghost" onClick={() => setTimeEditing(null)}>Cancel</Button>
            <GradientButton onClick={saveTime}>{timeEditing?.id ? "Save changes" : "Save"}</GradientButton>
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
            <AlertDialogAction onClick={deleteKm} className="bg-brand text-brand-foreground hover:bg-brand/90">Delete</AlertDialogAction>
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
            <AlertDialogAction onClick={deleteTime} className="bg-brand text-brand-foreground hover:bg-brand/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
