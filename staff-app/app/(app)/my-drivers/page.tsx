"use client";

import { useEffect, useMemo, useState } from "react";
import { Truck, Search, MoreHorizontal, Store, X } from "lucide-react";
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
import { StatusBadge } from "@/components/data-table/status-badge";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/stores/auth";

const fmtINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

type DriverStatus = "active" | "inactive" | "blocked";
type Driver = {
  id: number;
  name: string;
  mobile: string;
  vehicle: string;
  km_rate: number;
  hour_rate: number;
  status: DriverStatus;
  assigned_vendor_id: number | null;
  assigned_vendor_name: string | null;
};
type VendorOption = { id: number; name: string; shop_name: string | null };
type AssignState = { driver_id: number; driver_name: string; current_vendor_id: number | null; vendor_id: string };

function normalize(raw: unknown): Driver {
  const r = raw as Record<string, unknown>;
  const status = r.status === "blocked" ? "blocked" : r.status === "inactive" ? "inactive" : "active";
  return {
    id: Number(r.id ?? 0),
    name: (r.name as string | undefined) || "",
    mobile: (r.mobile_number as string | undefined) || "",
    vehicle: (r.vehicle_number as string | undefined) || "",
    km_rate: Number(r.km_rate ?? 0) || 0,
    hour_rate: Number(r.hour_rate ?? 0) || 0,
    status,
    assigned_vendor_id: r.assigned_vendor_id ? Number(r.assigned_vendor_id) : null,
    assigned_vendor_name: (r.assigned_vendor_name as string | null | undefined) ?? null,
  };
}

function normalizeVendor(raw: unknown): VendorOption {
  const r = raw as Record<string, unknown>;
  const profile = (r.profile ?? null) as Record<string, unknown> | null;
  return {
    id: Number(r.id ?? 0),
    name: (r.name as string | undefined) || "",
    shop_name: (profile?.shop_name as string | undefined) ?? null,
  };
}

export default function TalukDriversPage() {
  const { user } = useAuth();
  const isVendor = user?.role === "vendor";
  const myId = user?.id ?? 0;
  // Vendor's Actions column holds an "Assign to me" button → needs more width
  // than the taluk's icon-only menu (56px). Full literals so Tailwind emits both.
  const headerGrid = isVendor
    ? "grid-cols-[1.4fr_160px_140px_120px_120px_140px]"
    : "grid-cols-[1.4fr_160px_140px_120px_120px_56px]";
  const rowGrid = isVendor
    ? "md:grid-cols-[1.4fr_160px_140px_120px_120px_140px]"
    : "md:grid-cols-[1.4fr_160px_140px_120px_120px_56px]";
  const [items, setItems] = useState<Driver[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [assigning, setAssigning] = useState<AssignState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/staff/drivers");
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
        const res = await api.get("/vendors");
        const raw = (Array.isArray(res.data.data?.items) ? res.data.data.items : []) as unknown[];
        setVendors(raw.map(normalizeVendor));
      } catch {
        // optional
      }
    })();
  }, []);

  const filtered = useMemo(() => items.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.name.toLowerCase().includes(q) || d.vehicle.toLowerCase().includes(q) || d.mobile.includes(q);
  }), [items, search]);

  async function saveAssign() {
    if (!assigning) return;
    setSaving(true);
    try {
      await api.post(`/drivers/${assigning.driver_id}/assign-vendor`, {
        vendor_id: assigning.vendor_id ? Number(assigning.vendor_id) : null,
      });
      toast.success(assigning.vendor_id ? "Driver assigned" : "Driver unassigned");
      setAssigning(null);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Assign failed"));
    } finally {
      setSaving(false);
    }
  }

  // Vendor self-service: claim a free driver for myself, or release my own.
  async function assignSelf(driverId: number, claim: boolean) {
    try {
      await api.post(`/drivers/${driverId}/assign-vendor`, { vendor_id: claim ? myId : null });
      toast.success(claim ? "Assigned to you" : "Unassigned");
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update"));
    }
  }

  return (
    <>
      <MobileHeader title="Drivers" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Operations"
          icon={Truck}
          title="Drivers"
          description={isVendor
            ? "Drivers in your area. Assign one to yourself to deliver your orders."
            : "Drivers assigned to your taluk. Pick which vendor each one is delivering for."}
        />

        <div className="glass rounded-2xl p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, vehicle, mobile…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
          </div>
        </div>

        <div className="luxe-card overflow-hidden">
          <div className={`hidden ${headerGrid} gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid`}>
            <span>Driver</span>
            <span>Vehicle</span>
            <span>Assigned to</span>
            <span>KM / Hr</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          {loading ? (
            <div className="p-3"><TableSkeleton rows={5} cols={6} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Truck} title="No drivers in your area yet" description={isVendor ? "Admin adds drivers to your area. Claim one to deliver your orders." : "Admin assigns drivers to taluks. They'll appear here."} />
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((d, i) => (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className={`grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 ${rowGrid}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <Truck className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{d.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{d.mobile}</p>
                    </div>
                  </div>
                  <p className="hidden font-mono text-xs text-muted-foreground md:block">{d.vehicle || "—"}</p>
                  <p className="hidden truncate text-sm md:block">
                    {d.assigned_vendor_id
                      ? (isVendor && d.assigned_vendor_id === myId ? "You" : d.assigned_vendor_name)
                      : <span className="text-muted-foreground">—</span>}
                  </p>
                  <p className="hidden text-xs text-muted-foreground md:block">
                    {fmtINR(d.km_rate)}/km · {fmtINR(d.hour_rate)}/hr
                  </p>
                  <div className="hidden md:block"><StatusBadge status={d.status} /></div>
                  <div className="flex items-center gap-2 justify-self-end">
                    <span className="md:hidden"><StatusBadge status={d.status} /></span>
                    {isVendor ? (
                      d.assigned_vendor_id === myId ? (
                        <Button size="sm" variant="ghost" className="h-8 text-rose-400 hover:bg-rose-500/10" onClick={() => void assignSelf(d.id, false)}>
                          <X className="h-3.5 w-3.5" /> Unassign
                        </Button>
                      ) : d.assigned_vendor_id ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Button size="sm" className="h-8 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" onClick={() => void assignSelf(d.id, true)}>
                          <Truck className="h-3.5 w-3.5" /> Assign to me
                        </Button>
                      )
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button type="button" aria-label="Row actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            onClick={() => setAssigning({
                              driver_id: d.id,
                              driver_name: d.name,
                              current_vendor_id: d.assigned_vendor_id,
                              vendor_id: d.assigned_vendor_id ? String(d.assigned_vendor_id) : "",
                            })}
                          >
                            <Store className="h-4 w-4" /> Assign vendor
                          </DropdownMenuItem>
                          {d.assigned_vendor_id && (
                            <DropdownMenuItem
                              onClick={() => setAssigning({
                                driver_id: d.id,
                                driver_name: d.name,
                                current_vendor_id: d.assigned_vendor_id,
                                vendor_id: "",
                              })}
                            >
                              <X className="h-4 w-4" /> Unassign
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Dialog open={!!assigning} onOpenChange={(o) => !o && setAssigning(null)}>
        <DialogContent className="rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Assign driver to vendor</DialogTitle>
            <DialogDescription>
              {assigning?.vendor_id === "" ? `Unassign ${assigning?.driver_name} from current vendor.` : `Pick which vendor ${assigning?.driver_name} is delivering for.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Vendor</Label>
            <Combobox
              value={assigning?.vendor_id || ""}
              onValueChange={(v) => setAssigning((p) => p && ({ ...p, vendor_id: v || "" }))}
              options={vendors.map((v) => ({ value: String(v.id), label: v.shop_name || v.name }))}
              placeholder="Select vendor (leave blank to unassign)"
              searchPlaceholder="Search vendor…"
              emptyText="No vendor found."
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssigning(null)} disabled={saving}>Cancel</Button>
            <GradientButton onClick={() => void saveAssign()} disabled={saving}>{saving ? "Saving…" : "Save"}</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
