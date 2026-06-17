"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Plus, Search, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import { api, apiErrorMessage } from "@/lib/api";

type Shift = {
  id: number;
  name: string;
  start_time: string | null;
  end_time: string | null;
  is_active: number;
};
type ShiftDraft = {
  id?: number;
  name?: string;
  start_time?: string;
  end_time?: string;
  is_active?: number;
};

function normalize(raw: unknown): Shift {
  const r = raw as Record<string, unknown>;
  return {
    id:         Number(r.id ?? 0),
    name:       String(r.name ?? ""),
    start_time: (r.start_time as string | null | undefined) ?? null,
    end_time:   (r.end_time as string | null | undefined) ?? null,
    is_active:  Number(r.is_active ?? 0),
  };
}

const fmtRange = (s: Shift) => (s.start_time && s.end_time) ? `${s.start_time} – ${s.end_time}` : (s.start_time || s.end_time || "—");

export default function DriverShiftPage() {
  const [rows, setRows] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ShiftDraft | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/admin/driver-shifts");
      const items = Array.isArray(res.data?.data?.items) ? res.data.data.items : [];
      setRows(items.map(normalize));
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load shifts"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (!search) return true;
    return r.name.toLowerCase().includes(search.toLowerCase());
  }), [rows, search]);

  const activeCount = rows.filter((r) => r.is_active).length;

  async function save() {
    if (!editing) return;
    const name = (editing.name ?? "").trim();
    if (!name) { toast.error("Shift name required"); return; }

    setSaving(true);
    try {
      const payload = {
        name,
        start_time: editing.start_time || null,
        end_time: editing.end_time || null,
        is_active: editing.is_active ?? 1,
      };
      if (editing.id) {
        await api.patch(`/admin/driver-shifts/${editing.id}`, payload);
        toast.success("Shift updated");
      } else {
        await api.post("/admin/driver-shifts", payload);
        toast.success("Shift added");
      }
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (deleteId == null) return;
    try {
      await api.delete(`/admin/driver-shifts/${deleteId}`);
      toast.success("Shift removed");
      setDeleteId(null);
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Delete failed"));
    }
  }

  return (
    <>
      <MobileHeader title="Driver shift" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Operations"
          icon={Clock}
          title="Driver shift"
          description="Define the shift names and timing ranges that can be assigned to drivers."
          action={<GradientButton onClick={() => setEditing({ is_active: 1 })}><Plus className="h-4 w-4" /> Add Shift</GradientButton>}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="Total shifts"  value={rows.length}  icon={Clock} tone="violet"  spark={[1, 1, 2, 2, 2, 3, 3, 3]} />
          <StatCard label="Active shifts" value={activeCount}  icon={Clock} tone="emerald" spark={[1, 2, 2, 3, 3, 3, 4, 4]} />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search shift…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
          </div>
        </div>

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[1fr_1fr_120px_72px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Shift</span>
            <span>Timing</span>
            <span>Status</span>
            <span className="whitespace-nowrap text-center">Actions</span>
          </div>
          {loading ? (
            <div className="p-3"><TableSkeleton rows={4} cols={4} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No shifts yet"
              description="Create a shift with a name and timing range to assign it to drivers."
              action={<GradientButton onClick={() => setEditing({ is_active: 1 })}><Plus className="h-4 w-4" /> Add Shift</GradientButton>}
            />
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[1fr_1fr_120px_72px]"
                >
                  <div className="flex items-center gap-3 md:contents">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400 md:hidden">
                      <Clock className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold md:font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground md:hidden">{fmtRange(r)}</p>
                    </div>
                    <p className="hidden text-sm text-muted-foreground md:block">{fmtRange(r)}</p>
                    <span className="hidden md:block">
                      <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${r.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                        {r.is_active ? "Active" : "Inactive"}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 justify-self-end md:justify-self-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button type="button" aria-label="Row actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => setEditing({
                          id: r.id,
                          name: r.name,
                          start_time: r.start_time ?? "",
                          end_time: r.end_time ?? "",
                          is_active: r.is_active,
                        })}>
                          <Pencil className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleteId(r.id)} className="text-rose-400 focus:text-rose-400">
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
      </section>

      {/* Add / Edit shift modal */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400"><Clock className="h-4 w-4" /></span>
              {editing?.id ? "Edit Shift" : "Add Shift"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Shift name</Label>
              <Input value={editing?.name ?? ""} onChange={(e) => setEditing((p) => ({ ...(p ?? {}), name: e.target.value }))} placeholder="e.g. Morning" />
            </div>
            <div className="space-y-1.5">
              <Label>Start time</Label>
              <Input type="time" value={editing?.start_time ?? ""} onChange={(e) => setEditing((p) => ({ ...(p ?? {}), start_time: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>End time</Label>
              <Input type="time" value={editing?.end_time ?? ""} onChange={(e) => setEditing((p) => ({ ...(p ?? {}), end_time: e.target.value }))} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Status</Label>
              <Select value={String(editing?.is_active ?? 1)} onValueChange={(v) => v && setEditing((p) => ({ ...(p ?? {}), is_active: Number(v) }))}>
                <SelectTrigger>
                  <SelectValue>
                    {(v: string) => v === "1" ? "Active" : "Inactive"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Active</SelectItem>
                  <SelectItem value="0">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <GradientButton onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : (editing?.id ? "Save changes" : "Save")}</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete shift?</AlertDialogTitle>
            <AlertDialogDescription>Drivers already assigned to this shift keep their saved value, but it will no longer be selectable.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doDelete()} className="bg-brand text-brand-foreground hover:bg-brand/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
