"use client";

import { useEffect, useMemo, useState } from "react";
import { Truck, Plus, Search, MoreHorizontal, Banknote, Pencil, KeyRound, Ban, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { ImageDrop } from "@/components/ui/custom/image-drop";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/data-table/status-badge";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { Pagination } from "@/components/data-table/pagination";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { cleanMobile, isMobile } from "@/lib/phone";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";

const PAGE_SIZE = 10;
const fmtINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

type DriverStatus = "active" | "inactive" | "blocked";
type Driver = {
  id: number;
  name: string;
  mobile: string;
  vehicle: string;
  license: string;
  salary: number;
  km_rate: number;
  hour_rate: number;
  shift: string;
  taluk_id: number | null;
  taluk_name: string | null;
  assigned_vendor_name: string | null;
  id_card: string | null;
  status: DriverStatus;
};
type TalukOption = { id: number; name: string };
type ShiftOption = { id: number; name: string; is_active: number };
type KmSlabOption = { id: number; taluk_id: number; taluk_name: string | null; from_km: number; to_km: number; price_per_km: number };
type TimeRateOption = { id: number; taluk_id: number; taluk_name: string | null; time_min: number; price: number };

type NewDriver = { name: string; mobile: string; password: string; vehicle: string; license: string; salary: string; km_rate: string; hour_rate: string; shift: string; taluk_id: string; id_card: string | null };
type EditDriver = { id: number; name: string; vehicle: string; license: string; salary: string; km_rate: string; hour_rate: string; shift: string; taluk_id: string; status: DriverStatus; id_card: string | null };
type ResetPw = { id: number; name: string; password: string };

function normalize(raw: unknown): Driver {
  const r = raw as Record<string, unknown>;
  const status = r.status === "blocked" ? "blocked" : r.status === "inactive" ? "inactive" : "active";
  return {
    id: Number(r.id ?? 0),
    name: (r.name as string | undefined) || "",
    mobile: (r.mobile_number as string | undefined) || "",
    vehicle: (r.vehicle_number as string | undefined) || "",
    license: (r.license_number as string | undefined) || "",
    salary: Number(r.monthly_salary ?? 0) || 0,
    km_rate: Number(r.km_rate ?? 0) || 0,
    hour_rate: Number(r.hour_rate ?? 0) || 0,
    shift: (r.shift as string | null | undefined) || "",
    taluk_id: r.taluk_id ? Number(r.taluk_id) : null,
    taluk_name: (r.taluk_name as string | null | undefined) ?? null,
    assigned_vendor_name: (r.assigned_vendor_name as string | null | undefined) ?? null,
    id_card: (r.id_card_url as string | null | undefined) ?? null,
    status,
  };
}

export default function AdminDriversPage() {
  const [items, setItems] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | DriverStatus>("all");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState<NewDriver | null>(null);
  const [editing, setEditing] = useState<EditDriver | null>(null);
  const [resetting, setResetting] = useState<ResetPw | null>(null);
  const [saving, setSaving] = useState(false);
  const [taluks, setTaluks] = useState<TalukOption[]>([]);
  const [kmSlabs, setKmSlabs] = useState<KmSlabOption[]>([]);
  const [timeRates, setTimeRates] = useState<TimeRateOption[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/drivers");
      const raw = (Array.isArray(res.data.data?.items) ? res.data.data.items : []) as unknown[];
      setItems(raw.map(normalize));
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load drivers"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void (async () => {
      try {
        const [tRes, kRes, hrRes, sRes] = await Promise.all([
          api.get("/geo/taluks"),
          api.get("/admin/delivery-rates/km"),
          api.get("/admin/delivery-rates/time"),
          api.get("/admin/driver-shifts"),
        ]);
        const itemsOf = (r: { data?: { data?: { items?: unknown } } }): unknown[] =>
          Array.isArray(r.data?.data?.items) ? (r.data!.data!.items as unknown[]) : [];
        setTaluks(itemsOf(tRes).map((t) => ({ id: Number((t as Record<string, unknown>).id ?? 0), name: String((t as Record<string, unknown>).name ?? "") })));
        setKmSlabs(itemsOf(kRes).map((s) => {
          const r = s as Record<string, unknown>;
          return {
            id: Number(r.id ?? 0),
            taluk_id: Number(r.taluk_id ?? 0),
            taluk_name: (r.taluk_name as string | null | undefined) ?? null,
            from_km: Number(r.from_km ?? 0),
            to_km: Number(r.to_km ?? 0),
            price_per_km: Number(r.price_per_km ?? 0),
          };
        }));
        setTimeRates(itemsOf(hrRes).map((s) => {
          const r = s as Record<string, unknown>;
          return {
            id: Number(r.id ?? 0),
            taluk_id: Number(r.taluk_id ?? 0),
            taluk_name: (r.taluk_name as string | null | undefined) ?? null,
            time_min: Number(r.time_min ?? 0),
            price: Number(r.price ?? 0),
          };
        }));
        setShifts(itemsOf(sRes).map((s) => {
          const r = s as Record<string, unknown>;
          return { id: Number(r.id ?? 0), name: String(r.name ?? ""), is_active: Number(r.is_active ?? 0) };
        }));
      } catch {
        // optional — non-blocking
      }
    })();
  }, []);

  function kmOptionsFor(taluk_id: number | null): KmSlabOption[] {
    if (!taluk_id) return kmSlabs;
    return kmSlabs.filter((s) => s.taluk_id === taluk_id);
  }
  function timeOptionsFor(taluk_id: number | null): TimeRateOption[] {
    if (!taluk_id) return timeRates;
    return timeRates.filter((r) => r.taluk_id === taluk_id);
  }

  const filtered = useMemo(() => items.filter((d) => {
    if (search) {
      const q = search.toLowerCase();
      if (!d.name.toLowerCase().includes(q) && !d.vehicle.toLowerCase().includes(q) && !d.mobile.includes(q)) return false;
    }
    if (status !== "all" && d.status !== status) return false;
    return true;
  }), [items, search, status]);

  useEffect(() => setPage(1), [search, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalSalary = items.reduce((s, d) => s + d.salary, 0);

  async function saveNew() {
    if (!adding) return;
    if (!adding.name || !adding.mobile || !adding.password) { toast.error("Name, mobile and password required"); return; }
    if (!isMobile(adding.mobile)) { toast.error("Enter a valid 10-digit mobile number"); return; }
    setSaving(true);
    try {
      await api.post("/drivers", {
        name: adding.name,
        mobile_number: adding.mobile,
        password: adding.password,
        vehicle_number: adding.vehicle || null,
        license_number: adding.license || null,
        monthly_salary: Number(adding.salary || 0),
        km_rate: Number(adding.km_rate || 0),
        hour_rate: Number(adding.hour_rate || 0),
        shift: adding.shift || null,
        taluk_id: adding.taluk_id ? Number(adding.taluk_id) : null,
        id_card_url: adding.id_card,
      });
      toast.success("Driver added");
      setAdding(null);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Create failed"));
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editing.name) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      await api.patch(`/drivers/${editing.id}`, {
        name: editing.name,
        vehicle_number: editing.vehicle || null,
        license_number: editing.license || null,
        monthly_salary: Number(editing.salary || 0),
        km_rate: Number(editing.km_rate || 0),
        hour_rate: Number(editing.hour_rate || 0),
        shift: editing.shift || null,
        taluk_id: editing.taluk_id ? Number(editing.taluk_id) : null,
        status: editing.status,
        id_card_url: editing.id_card,
      });
      toast.success("Driver updated");
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Update failed"));
    } finally {
      setSaving(false);
    }
  }

  async function saveReset() {
    if (!resetting) return;
    if (!resetting.password || resetting.password.length < 6) { toast.error("Min 6 characters"); return; }
    setSaving(true);
    try {
      await api.post(`/drivers/${resetting.id}/reset-password`, { password: resetting.password });
      toast.success("Password updated");
      setResetting(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Reset failed"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleBlock(d: Driver) {
    try {
      await api.post(`/drivers/${d.id}/${d.status === "blocked" ? "unblock" : "block"}`);
      toast.success(d.status === "blocked" ? "Unblocked" : "Blocked");
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Action failed"));
    }
  }

  function openEdit(d: Driver) {
    setEditing({
      id: d.id,
      name: d.name,
      vehicle: d.vehicle,
      license: d.license,
      salary: String(d.salary),
      km_rate: String(d.km_rate),
      hour_rate: String(d.hour_rate),
      shift: d.shift,
      taluk_id: d.taluk_id ? String(d.taluk_id) : "",
      status: d.status,
      id_card: d.id_card,
    });
  }

  return (
    <>
      <MobileHeader title="Drivers" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Operations"
          icon={Truck}
          title="Drivers"
          description="Manage delivery drivers, vehicles and monthly payroll."
          action={
            <GradientButton onClick={() => setAdding({ name: "", mobile: "", password: "", vehicle: "", license: "", salary: "", km_rate: "", hour_rate: "", shift: "", taluk_id: "", id_card: null })}>
              <Plus className="h-4 w-4" /> New driver
            </GradientButton>
          }
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Total drivers"   value={items.length} icon={Truck}   tone="brand"   spark={[1, 2, 2, 2, 2, 2, 2, 2]} />
          <StatCard label="Active"          value={items.filter((d) => d.status === "active").length} icon={Truck} tone="emerald" spark={[1, 2, 2, 2, 2, 2, 2, 2]} />
          <StatCard label="Monthly payroll" value={totalSalary} icon={Banknote} tone="amber"   spark={[2, 3, 3, 3, 4, 4, 4, 4]} format={fmtINR} />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, vehicle, mobile…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
            </div>
            <Select value={status} onValueChange={(v) => v && setStatus(v as typeof status)}>
              <SelectTrigger className="h-10 rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[1.4fr_160px_140px_140px_56px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Driver</span>
            <span>Vehicle</span>
            <span>Salary / mo</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          {loading ? (
            <div className="p-3"><TableSkeleton rows={5} cols={5} /></div>
          ) : paged.length === 0 ? (
            <EmptyState icon={Truck} title="No drivers match your filters" />
          ) : (
            <div className="divide-y divide-border">
              {paged.map((d, i) => (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[1.4fr_160px_140px_140px_56px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <Truck className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{d.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {d.mobile}
                        {d.taluk_name && <> · {d.taluk_name}</>}
                        {d.assigned_vendor_name && <> · → {d.assigned_vendor_name}</>}
                      </p>
                    </div>
                  </div>
                  <p className="hidden font-mono text-xs text-muted-foreground md:block">{d.vehicle || "—"}</p>
                  <p className="hidden text-sm font-medium md:block">{fmtINR(d.salary)}</p>
                  <div className="hidden md:block"><StatusBadge status={d.status} /></div>
                  <div className="flex items-center gap-2 justify-self-end">
                    <span className="md:hidden"><StatusBadge status={d.status} /></span>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button type="button" aria-label="Row actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => openEdit(d)}>
                          <Pencil className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setResetting({ id: d.id, name: d.name, password: "" })}>
                          <KeyRound className="h-4 w-4" /> Reset password
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void toggleBlock(d)}>
                          {d.status === "blocked"
                            ? (<><RotateCcw className="h-4 w-4" /> Unblock</>)
                            : (<><Ban className="h-4 w-4" /> Block</>)}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <div className="border-t border-border bg-surface-2/40 px-4 py-3">
              <Pagination page={safePage} pageCount={pageCount} onPageChange={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
            </div>
          )}
        </div>
      </section>

      {/* New driver dialog */}
      <Dialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)}>
        <DialogContent className="sm:max-w-3xl rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>New driver</DialogTitle>
            <DialogDescription>Add a delivery driver with monthly salary.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2"><Label>Name</Label><Input value={adding?.name ?? ""} onChange={(e) => setAdding((p) => p && ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Mobile</Label><Input inputMode="numeric" value={adding?.mobile ?? ""} onChange={(e) => setAdding((p) => p && ({ ...p, mobile: cleanMobile(e.target.value) }))} /></div>
            <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={adding?.password ?? ""} onChange={(e) => setAdding((p) => p && ({ ...p, password: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Vehicle</Label><Input value={adding?.vehicle ?? ""} onChange={(e) => setAdding((p) => p && ({ ...p, vehicle: e.target.value }))} placeholder="TN-37 AB 1234" /></div>
            <div className="space-y-1.5"><Label>License</Label><Input value={adding?.license ?? ""} onChange={(e) => setAdding((p) => p && ({ ...p, license: e.target.value }))} /></div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Driver ID card</Label>
              <ImageDrop value={adding?.id_card ?? null} onChange={(v) => setAdding((p) => p && ({ ...p, id_card: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Taluk</Label>
              <Combobox
                value={adding?.taluk_id || ""}
                onValueChange={(v) => setAdding((p) => p && ({ ...p, taluk_id: v || "", km_rate: "", hour_rate: "" }))}
                options={taluks.map((t) => ({ value: String(t.id), label: t.name }))}
                placeholder="Select taluk (optional)"
                searchPlaceholder="Search taluk…"
                emptyText="No taluk found."
                noneLabel="— None —"
              />
            </div>
            <div className="space-y-1.5"><Label>Monthly salary (₹)</Label><Input type="number" value={adding?.salary ?? ""} onChange={(e) => setAdding((p) => p && ({ ...p, salary: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Shift</Label>
              <Select value={adding?.shift || ""} onValueChange={(v) => v && setAdding((p) => p && ({ ...p, shift: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={shifts.some((s) => s.is_active) ? "Select shift (optional)" : "No shifts — add on Driver Shift page"}>
                    {(v: string) => v || null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {shifts.filter((s) => s.is_active).map((s) => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Delivery Time rate</Label>
              <Select value={adding?.hour_rate || ""} onValueChange={(v) => setAdding((p) => p && ({ ...p, hour_rate: v }))} disabled={!adding?.taluk_id}>
                <SelectTrigger>
                  <SelectValue placeholder={adding?.taluk_id ? "Select Time rate" : "Pick a taluk first"}>
                    {(v: string) => {
                      if (!v) return null;
                      const list = timeOptionsFor(adding?.taluk_id ? Number(adding.taluk_id) : null);
                      const r = list.find((x) => String(x.price) === v);
                      return r ? `${r.taluk_name ?? "—"} · ${r.time_min} min · ${fmtINR(r.price)}` : `${fmtINR(Number(v))}`;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {timeOptionsFor(adding?.taluk_id ? Number(adding.taluk_id) : null).map((r) => (
                    <SelectItem key={r.id} value={String(r.price)}>
                      {(r.taluk_name ?? "—") + " · " + r.time_min + " min · " + fmtINR(r.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdding(null)} disabled={saving}>Cancel</Button>
            <GradientButton onClick={() => void saveNew()} disabled={saving}>{saving ? "Creating…" : "Create driver"}</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit driver dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-3xl rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Edit driver</DialogTitle>
            <DialogDescription>Update vehicle, salary or status. Mobile cannot be changed.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2"><Label>Name</Label><Input value={editing?.name ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Vehicle</Label><Input value={editing?.vehicle ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, vehicle: e.target.value }))} placeholder="TN-37 AB 1234" /></div>
            <div className="space-y-1.5"><Label>License</Label><Input value={editing?.license ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, license: e.target.value }))} /></div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Driver ID card</Label>
              <ImageDrop value={editing?.id_card ?? null} onChange={(v) => setEditing((p) => p && ({ ...p, id_card: v }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Taluk</Label>
              <Combobox
                value={editing?.taluk_id || ""}
                onValueChange={(v) => setEditing((p) => p && ({ ...p, taluk_id: v || "", km_rate: "", hour_rate: "" }))}
                options={taluks.map((t) => ({ value: String(t.id), label: t.name }))}
                placeholder="Select taluk (optional)"
                searchPlaceholder="Search taluk…"
                emptyText="No taluk found."
                noneLabel="— None —"
              />
            </div>
            <div className="space-y-1.5"><Label>Monthly salary (₹)</Label><Input type="number" value={editing?.salary ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, salary: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Shift</Label>
              <Select value={editing?.shift || ""} onValueChange={(v) => v && setEditing((p) => p && ({ ...p, shift: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={shifts.some((s) => s.is_active) ? "Select shift (optional)" : "No shifts — add on Driver Shift page"}>
                    {(v: string) => v || null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {shifts.filter((s) => s.is_active).map((s) => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Delivery Time rate</Label>
              <Select value={editing?.hour_rate || ""} onValueChange={(v) => setEditing((p) => p && ({ ...p, hour_rate: v }))} disabled={!editing?.taluk_id}>
                <SelectTrigger>
                  <SelectValue placeholder={editing?.taluk_id ? "Select Time rate" : "Pick a taluk first"}>
                    {(v: string) => {
                      if (!v) return null;
                      const list = timeOptionsFor(editing?.taluk_id ? Number(editing.taluk_id) : null);
                      const r = list.find((x) => String(x.price) === v);
                      return r ? `${r.taluk_name ?? "—"} · ${r.time_min} min · ${fmtINR(r.price)}` : `${fmtINR(Number(v))}`;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {timeOptionsFor(editing?.taluk_id ? Number(editing.taluk_id) : null).map((r) => (
                    <SelectItem key={r.id} value={String(r.price)}>
                      {(r.taluk_name ?? "—") + " · " + r.time_min + " min · " + fmtINR(r.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Status</Label>
              <Select value={editing?.status ?? "active"} onValueChange={(v) => v && setEditing((p) => p && ({ ...p, status: v as DriverStatus }))}>
                <SelectTrigger>
                  <SelectValue>
                    {(v: string) => v === "active" ? "Active" : v === "inactive" ? "Inactive" : v === "blocked" ? "Blocked" : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <GradientButton onClick={() => void saveEdit()} disabled={saving}>{saving ? "Saving…" : "Save changes"}</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetting} onOpenChange={(o) => !o && setResetting(null)}>
        <DialogContent className="rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>Set a new password for {resetting?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input type="password" value={resetting?.password ?? ""} onChange={(e) => setResetting((p) => p && ({ ...p, password: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetting(null)} disabled={saving}>Cancel</Button>
            <GradientButton onClick={() => void saveReset()} disabled={saving}>{saving ? "Saving…" : "Update password"}</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
