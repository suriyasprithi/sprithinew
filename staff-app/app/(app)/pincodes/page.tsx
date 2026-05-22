"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, MapPin, CheckCircle2, XCircle, Plus, Search, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/data-table/status-badge";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { Pagination } from "@/components/data-table/pagination";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { mock, type GeoRow } from "@/lib/mock";

const PAGE_SIZE = 8;

type StatusFilter = "all" | "active" | "inactive";

export default function PincodesPage() {
  const [items, setItems] = useState<GeoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [taluk, setTaluk] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<Partial<GeoRow> | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      setItems(await mock.pincodes());
      setLoading(false);
    })();
  }, []);

  const taluks = useMemo(() => Array.from(new Set(items.map((i) => i.parent_name).filter(Boolean))) as string[], [items]);

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (taluk !== "all" && p.parent_name !== taluk) return false;
      if (status !== "all" && p.status !== status) return false;
      return true;
    });
  }, [items, search, taluk, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, taluk, status]);

  const totalActive = items.filter((i) => i.status === "active").length;
  const totalInactive = items.filter((i) => i.status === "inactive").length;
  const totalTaluks = taluks.length;

  const openNew = () => setEditing({ name: "", status: "active", parent_name: taluks[0] ?? "" });

  const save = () => {
    if (!editing) return;
    const code = (editing.name ?? "").trim();
    if (!/^\d{6}$/.test(code)) { toast.error("Pincode must be 6 digits"); return; }
    if (!editing.parent_name) { toast.error("Pick a taluk"); return; }
    if (editing.id) {
      setItems((cur) => cur.map((i) => (i.id === editing.id ? { ...i, ...editing, name: code } as GeoRow : i)));
      toast.success("Pincode updated");
    } else {
      const id = Math.max(0, ...items.map((i) => i.id)) + 1;
      setItems((cur) => [...cur, { id, name: code, status: (editing.status as "active" | "inactive") ?? "active", parent_name: editing.parent_name }]);
      toast.success("Pincode added");
    }
    setEditing(null);
  };

  const remove = () => {
    if (deleteId == null) return;
    setItems((cur) => cur.filter((i) => i.id !== deleteId));
    toast.success("Pincode deleted");
    setDeleteId(null);
  };

  return (
    <>
      <MobileHeader title="Pincodes" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Geo</p>
            <h2 className="mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight">
              <Building2 className="h-7 w-7 text-brand" />
              Pincodes
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Manage service pincodes mapped to taluks.</p>
          </div>
          <GradientButton onClick={openNew}>
            <Plus className="h-4 w-4" /> Add pincode
          </GradientButton>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total pincodes" value={items.length} icon={MapPin}        tone="brand"   spark={[3, 4, 5, 5, 6, 7, 8, 9]} />
          <StatCard label="Active"         value={totalActive}  icon={CheckCircle2}  tone="emerald" spark={[2, 3, 4, 4, 5, 6, 7, 8]} />
          <StatCard label="Inactive"       value={totalInactive} icon={XCircle}      tone="amber"   spark={[1, 1, 2, 1, 2, 1, 2, 2]} />
          <StatCard label="Taluks covered" value={totalTaluks}  icon={Building2}     tone="violet"  spark={[1, 1, 2, 2, 2, 2, 2, 2]} />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pincode…"
                className="h-10 rounded-xl bg-surface-2/60 pl-9"
              />
            </div>
            <Select value={taluk} onValueChange={(v) => v && setTaluk(v)}>
              <SelectTrigger className="h-10 rounded-xl bg-surface-2/60"><SelectValue placeholder="Taluk" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All taluks</SelectItem>
                {taluks.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => v && setStatus(v as StatusFilter)}>
              <SelectTrigger className="h-10 rounded-xl bg-surface-2/60"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[1fr_1.5fr_120px_56px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Pincode</span>
            <span>Taluk</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>

          {loading ? (
            <div className="p-3"><TableSkeleton rows={6} cols={4} /></div>
          ) : paged.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="No pincodes match your filters"
              description="Adjust search or filters, or add a new pincode to get started."
              action={<GradientButton onClick={openNew}><Plus className="h-4 w-4" /> Add pincode</GradientButton>}
            />
          ) : (
            <div className="divide-y divide-border">
              {paged.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[1fr_1.5fr_120px_56px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{p.name}</p>
                      <p className="text-xs text-muted-foreground md:hidden">{p.parent_name ?? "—"}</p>
                    </div>
                  </div>
                  <p className="hidden text-sm text-muted-foreground md:block">{p.parent_name ?? "—"}</p>
                  <div className="hidden md:block"><StatusBadge status={p.status} /></div>
                  <div className="flex items-center gap-2 justify-self-end">
                    <span className="md:hidden"><StatusBadge status={p.status} /></span>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            aria-label="Row actions"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => setEditing(p)}>
                          <Pencil className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleteId(p.id)} className="text-rose-400 focus:text-rose-400">
                          <Trash2 className="h-4 w-4" /> Delete
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

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit pincode" : "Add pincode"}</DialogTitle>
            <DialogDescription>Map a 6-digit pincode to a taluk.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pincode">Pincode</Label>
              <Input
                id="pincode"
                inputMode="numeric"
                maxLength={6}
                value={editing?.name ?? ""}
                onChange={(e) => setEditing((p) => ({ ...(p ?? {}), name: e.target.value.replace(/\D/g, "") }))}
                placeholder="641001"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="taluk">Taluk</Label>
              <Select
                value={editing?.parent_name ?? ""}
                onValueChange={(v) => setEditing((p) => ({ ...(p ?? {}), parent_name: v ?? undefined }))}
              >
                <SelectTrigger id="taluk"><SelectValue placeholder="Pick taluk" /></SelectTrigger>
                <SelectContent>
                  {taluks.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select
                value={(editing?.status as string) ?? "active"}
                onValueChange={(v) => v && setEditing((p) => ({ ...(p ?? {}), status: v as "active" | "inactive" }))}
              >
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <GradientButton onClick={save}>{editing?.id ? "Save changes" : "Add pincode"}</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete pincode?</AlertDialogTitle>
            <AlertDialogDescription>This pincode will be removed from your service area. You can re-add it later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-brand text-brand-foreground hover:bg-brand/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
