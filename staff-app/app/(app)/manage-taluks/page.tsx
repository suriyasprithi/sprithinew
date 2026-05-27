"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, KeyRound, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
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
import { StatusBadge } from "@/components/data-table/status-badge";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/stores/auth";

type DistrictOption = { id: number; name: string; user_id?: number | null };
type TalukRow = {
  id: number;
  name: string;
  district_id?: number | null;
  status: "active" | "inactive";
  mobile_number?: string | null;
};

type Editing = Partial<TalukRow> & { password?: string };

export default function ManageTaluksPage() {
  const user = useAuth((s) => s.user);
  const [items, setItems] = useState<TalukRow[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [resetting, setResetting] = useState<{ id: number; password: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [tRes, dRes] = await Promise.all([
        api.get("/geo/taluks"),
        api.get("/geo/districts"),
      ]);
      setItems((tRes.data?.data?.items ?? []) as TalukRow[]);
      setDistricts(((dRes.data?.data?.items ?? []) as DistrictOption[]).map((d) => ({
        id: Number(d.id),
        name: d.name,
        user_id: d.user_id ? Number(d.user_id) : null,
      })));
    } catch (e) {
      toast.error(apiErrorMessage(e, "Failed to load taluks"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const districtNameById = useMemo(() => {
    const m: Record<number, string> = {};
    for (const d of districts) m[d.id] = d.name;
    return m;
  }, [districts]);

  const isDistrictRole = user?.role === "district";
  const myDistrictId = useMemo(() => {
    if (!isDistrictRole || !user) return null;
    const own = districts.find((d) => d.user_id === user.id);
    return own?.id ?? null;
  }, [isDistrictRole, user, districts]);

  const filtered = useMemo(() => items.filter((t) =>
    !search || t.name.toLowerCase().includes(search.toLowerCase())
  ), [items, search]);

  async function save() {
    if (!editing?.name) { toast.error("Name required"); return; }
    if (!editing.district_id) { toast.error("District required"); return; }
    if (!editing.id) {
      if (!editing.mobile_number) { toast.error("Mobile number required"); return; }
      if (!editing.password || editing.password.length < 6) { toast.error("Password (min 6 chars) required"); return; }
    }
    setSaving(true);
    try {
      if (editing.id) {
        await api.patch(`/geo/taluks/${editing.id}`, {
          name: editing.name,
          district_id: editing.district_id,
          status: editing.status ?? "active",
          mobile_number: editing.mobile_number || undefined,
          password: editing.password || undefined,
        });
        toast.success("Taluk updated");
      } else {
        await api.post("/geo/taluks", {
          name: editing.name,
          district_id: editing.district_id,
          status: editing.status ?? "active",
          mobile_number: editing.mobile_number,
          password: editing.password,
        });
        toast.success("Taluk created");
      }
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (deleteId == null) return;
    try {
      await api.delete(`/geo/taluks/${deleteId}`);
      toast.success("Taluk removed");
      setDeleteId(null);
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Delete failed"));
    }
  }

  async function resetPassword() {
    if (!resetting) return;
    if (!resetting.password || resetting.password.length < 6) { toast.error("Password (min 6 chars) required"); return; }
    try {
      await api.post(`/geo/taluks/${resetting.id}/reset-password`, { password: resetting.password });
      toast.success("Password updated");
      setResetting(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Reset failed"));
    }
  }

  return (
    <>
      <MobileHeader title="Taluks" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Geography"
          icon={Building2}
          title="Taluks"
          description="Sub-divisions under each district."
          action={
            <GradientButton onClick={() => setEditing({ name: "", status: "active", mobile_number: "", password: "", district_id: myDistrictId ?? undefined })}>
              <Plus className="h-4 w-4" /> Add taluk
            </GradientButton>
          }
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Total taluks" value={items.length} icon={Building2} tone="brand"   spark={[1, 1, 2, 2, 2, 2, 2, 2]} />
          <StatCard label="Active"       value={items.filter((i) => i.status === "active").length} icon={Building2} tone="emerald" spark={[1, 1, 2, 2, 2, 2, 2, 2]} />
          <StatCard label="Inactive"     value={items.filter((i) => i.status === "inactive").length} icon={Building2} tone="amber" spark={[0, 0, 0, 0, 0, 0, 0, 0]} />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search taluk…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
          </div>
        </div>

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[1fr_1fr_1fr_120px_56px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Taluk</span>
            <span>District</span>
            <span>Login mobile</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          {loading ? (
            <div className="p-3"><TableSkeleton rows={4} cols={5} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Building2} title="No taluks yet" description="Create a taluk to begin assigning vendors and pincodes." />
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[1fr_1fr_1fr_120px_56px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <p className="truncate text-sm font-semibold">{t.name}</p>
                  </div>
                  <p className="hidden text-sm text-muted-foreground md:block">{t.district_id ? districtNameById[t.district_id] ?? "—" : "—"}</p>
                  <p className="hidden text-sm text-muted-foreground md:block">{t.mobile_number ?? "—"}</p>
                  <div className="hidden md:block"><StatusBadge status={t.status} /></div>
                  <div className="flex items-center gap-2 justify-self-end">
                    <span className="md:hidden"><StatusBadge status={t.status} /></span>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button type="button" aria-label="Row actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setEditing({ ...t, password: "" })}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setResetting({ id: t.id, password: "" })}><KeyRound className="h-4 w-4" /> Reset password</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleteId(t.id)} className="text-rose-400 focus:text-rose-400">
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

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="rounded-2xl border-border bg-popover">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit taluk" : "New taluk"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={editing?.name ?? ""} onChange={(e) => setEditing((p) => ({ ...(p ?? {}), name: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>District</Label>
              <Select value={editing?.district_id ? String(editing.district_id) : ""} onValueChange={(v) => v && setEditing((p) => ({ ...(p ?? {}), district_id: Number(v) }))} disabled={isDistrictRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select district">
                    {(v: string) => districts.find((d) => String(d.id) === v)?.name ?? null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {districts.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Login mobile number</Label><Input value={editing?.mobile_number ?? ""} onChange={(e) => setEditing((p) => ({ ...(p ?? {}), mobile_number: e.target.value }))} placeholder="9999000004" inputMode="numeric" /></div>
            <div className="space-y-1.5">
              <Label>{editing?.id ? "New password (optional)" : "Password"}</Label>
              <Input type="password" value={editing?.password ?? ""} onChange={(e) => setEditing((p) => ({ ...(p ?? {}), password: e.target.value }))} placeholder={editing?.id ? "Leave blank to keep current" : "min 6 chars"} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={(editing?.status as string) ?? "active"} onValueChange={(v) => v && setEditing((p) => ({ ...(p ?? {}), status: v as "active" | "inactive" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <GradientButton onClick={save} disabled={saving}>{editing?.id ? "Save" : "Create"}</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetting} onOpenChange={(o) => !o && setResetting(null)}>
        <DialogContent className="rounded-2xl border-border bg-popover">
          <DialogHeader><DialogTitle>Reset password</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input type="password" value={resetting?.password ?? ""} onChange={(e) => setResetting((p) => (p ? { ...p, password: e.target.value } : p))} placeholder="min 6 chars" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetting(null)}>Cancel</Button>
            <GradientButton onClick={resetPassword}>Update</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete taluk?</AlertDialogTitle>
            <AlertDialogDescription>Pincodes and vendors mapped to this taluk will lose their parent.</AlertDialogDescription>
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
