"use client";

import { useEffect, useMemo, useState } from "react";
import { Truck, Plus, Search, MoreHorizontal, Banknote } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/data-table/status-badge";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { Pagination } from "@/components/data-table/pagination";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { mock, type Driver } from "@/lib/mock";

const PAGE_SIZE = 10;
const fmtINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

type NewDriver = { name: string; mobile: string; vehicle: string; salary: string };

export default function AdminDriversPage() {
  const [items, setItems] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState<NewDriver | null>(null);

  useEffect(() => {
    void (async () => {
      setItems(await mock.drivers());
      setLoading(false);
    })();
  }, []);

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

  function save() {
    if (!adding) return;
    if (!adding.name || !adding.mobile || !adding.vehicle) { toast.error("Required fields missing"); return; }
    const id = Math.max(0, ...items.map((i) => i.id)) + 1;
    setItems((cur) => [...cur, {
      id, name: adding.name, mobile: adding.mobile, vehicle: adding.vehicle,
      license: "DL00000", salary: Number(adding.salary || 0),
      taluk: "Coimbatore South", status: "active",
    }]);
    toast.success("Driver added");
    setAdding(null);
  }

  function paySalary(d: Driver) {
    toast.success(`Salary of ${fmtINR(d.salary)} processed for ${d.name}`);
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
            <GradientButton onClick={() => setAdding({ name: "", mobile: "", vehicle: "", salary: "" })}>
              <Plus className="h-4 w-4" /> New driver
            </GradientButton>
          }
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Total drivers"     value={items.length} icon={Truck}   tone="brand"   spark={[1, 2, 2, 2, 2, 2, 2, 2]} />
          <StatCard label="Active"            value={items.filter((d) => d.status === "active").length} icon={Truck} tone="emerald" spark={[1, 2, 2, 2, 2, 2, 2, 2]} />
          <StatCard label="Monthly payroll"   value={totalSalary} icon={Banknote} tone="amber"   spark={[2, 3, 3, 3, 4, 4, 4, 4]} format={fmtINR} />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, vehicle, mobile…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
            </div>
            <Select value={status} onValueChange={(v) => v && setStatus(v as "all" | "active" | "inactive")}>
              <SelectTrigger className="h-10 rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
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
                      <p className="truncate text-xs text-muted-foreground">{d.mobile} · {d.taluk}</p>
                    </div>
                  </div>
                  <p className="hidden font-mono text-xs text-muted-foreground md:block">{d.vehicle}</p>
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
                        <DropdownMenuItem onClick={() => paySalary(d)}>
                          <Banknote className="h-4 w-4" /> Pay salary
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

      <Dialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)}>
        <DialogContent className="rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>New driver</DialogTitle>
            <DialogDescription>Add a delivery driver with monthly salary.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2"><Label>Name</Label><Input value={adding?.name ?? ""} onChange={(e) => setAdding((p) => p && ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Mobile</Label><Input inputMode="numeric" value={adding?.mobile ?? ""} onChange={(e) => setAdding((p) => p && ({ ...p, mobile: e.target.value.replace(/\D/g, "") }))} /></div>
            <div className="space-y-1.5"><Label>Vehicle</Label><Input value={adding?.vehicle ?? ""} onChange={(e) => setAdding((p) => p && ({ ...p, vehicle: e.target.value }))} placeholder="TN-37 AB 1234" /></div>
            <div className="space-y-1.5 md:col-span-2"><Label>Monthly salary (₹)</Label><Input type="number" value={adding?.salary ?? ""} onChange={(e) => setAdding((p) => p && ({ ...p, salary: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdding(null)}>Cancel</Button>
            <GradientButton onClick={save}>Create driver</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
