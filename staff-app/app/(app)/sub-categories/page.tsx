"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers, Plus, Search, MoreHorizontal, Pencil, Trash2, Tags } from "lucide-react";
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
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";

type ProductCategory = { id: number; name: string };
type SubCategory = {
  id: number;
  name: string;
  status: "active" | "inactive";
  category_id: number;
  category_name?: string | null;
};

type Draft = {
  id?: number;
  name: string;
  status: "active" | "inactive";
  category_id: number | null;
};

function blankDraft(): Draft {
  return { name: "", status: "active", category_id: null };
}

export default function SubCategoriesPage() {
  const [items, setItems] = useState<SubCategory[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [catFilter, setCatFilter] = useState<"all" | string>("all");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const subsP = api.get("/admin/sub-categories").then((r) => (r.data.data?.items ?? []) as SubCategory[]).catch(() => [] as SubCategory[]);
      const catsP = api.get("/admin/categories").then((r) => (r.data.data?.items ?? []) as ProductCategory[]).catch(() => [] as ProductCategory[]);
      const [subs, cats] = await Promise.all([subsP, catsP]);
      setItems(subs);
      setCategories(cats);
    })();
  }, []);

  const catName = useMemo(() => {
    const m = new Map<number, string>();
    categories.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [categories]);

  const filtered = useMemo(() => items.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (status !== "all" && s.status !== status) return false;
    if (catFilter !== "all" && String(s.category_id) !== catFilter) return false;
    return true;
  }), [items, search, status, catFilter]);

  const totalActive = items.filter((i) => i.status === "active").length;

  function startNew() { setEditing(blankDraft()); }
  function startEdit(s: SubCategory) {
    setEditing({ id: s.id, name: s.name, status: s.status, category_id: s.category_id ?? null });
  }

  async function save() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) { toast.error("Name required"); return; }
    if (editing.category_id == null) { toast.error("Pick a product category"); return; }

    const payload = { name, category_id: editing.category_id, status: editing.status };
    setBusy(true);
    try {
      if (editing.id) {
        await api.patch(`/admin/sub-categories/${editing.id}`, payload);
        setItems((cur) => cur.map((i) => (i.id === editing.id
          ? { ...i, ...payload, category_name: catName.get(payload.category_id) ?? i.category_name } as SubCategory
          : i)));
        toast.success("Sub-category updated");
      } else {
        const res = await api.post("/admin/sub-categories", payload);
        const id = Number(res.data.data?.id ?? Math.max(0, ...items.map((i) => i.id)) + 1);
        setItems((cur) => [{ id, ...payload, category_name: catName.get(payload.category_id) ?? null }, ...cur]);
        toast.success("Sub-category created");
      }
      setEditing(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Save failed"));
    } finally { setBusy(false); }
  }

  async function remove() {
    if (deleteId == null) return;
    try {
      await api.delete(`/admin/sub-categories/${deleteId}`);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Delete failed")); return;
    }
    setItems((cur) => cur.filter((i) => i.id !== deleteId));
    toast.success("Sub-category removed");
    setDeleteId(null);
  }

  return (
    <>
      <MobileHeader title="Sub categories" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Catalog"
          icon={Layers}
          title="Sub categories"
          description="A finer level under each product category — Vegetables → Leafy / Root, Rice → Basmati / Sona Masuri, etc."
          action={
            <GradientButton onClick={startNew}>
              <Plus className="h-4 w-4" /> New sub-category
            </GradientButton>
          }
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Total sub-categories" value={items.length}   icon={Layers} tone="brand"   spark={[2, 3, 3, 4, 4, 4, 4, 4]} />
          <StatCard label="Active"               value={totalActive}    icon={Layers} tone="emerald" spark={[2, 3, 3, 4, 4, 4, 4, 4]} />
          <StatCard label="Product categories"   value={categories.length} icon={Tags} tone="violet" spark={[1, 2, 2, 3, 3, 4, 4, 4]} />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_200px_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sub-category…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
            </div>
            <Combobox
              value={catFilter}
              onValueChange={(v) => setCatFilter(v || "all")}
              options={[{ value: "all", label: "Any category" }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))]}
              placeholder="Any category"
              searchPlaceholder="Search category…"
              emptyText="No category found."
              className="h-10 rounded-xl bg-surface-2/60"
            />
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
          <div className="hidden grid-cols-[1fr_160px_120px_56px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Name</span>
            <span>Product category</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No sub-categories match your filters"
              description="Adjust filters or create a new sub-category under a product category."
              action={<GradientButton onClick={startNew}><Plus className="h-4 w-4" /> New sub-category</GradientButton>}
            />
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[1fr_160px_120px_56px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <Layers className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{s.name}</p>
                      <p className="text-xs text-muted-foreground md:hidden">
                        {s.category_name ?? catName.get(s.category_id) ?? "—"}
                      </p>
                    </div>
                  </div>
                  <p className="hidden text-xs md:block">
                    <span className="inline-flex items-center gap-1 rounded-full border border-brand/20 bg-brand/5 px-2 py-0.5 font-medium text-brand">
                      <Tags className="h-3 w-3" /> {s.category_name ?? catName.get(s.category_id) ?? "—"}
                    </span>
                  </p>
                  <div className="hidden md:block"><StatusBadge status={s.status} /></div>
                  <div className="flex items-center gap-2 justify-self-end">
                    <span className="md:hidden"><StatusBadge status={s.status} /></span>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button type="button" aria-label="Row actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => startEdit(s)}>
                          <Pencil className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleteId(s.id)} className="text-rose-400 focus:text-rose-400">
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
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit sub-category" : "New sub-category"}</DialogTitle>
            <DialogDescription>Name and the product category this sub-category belongs to.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Product category <span className="text-brand">*</span></Label>
              <Combobox
                value={editing?.category_id != null ? String(editing.category_id) : ""}
                onValueChange={(v) => setEditing((p) => p && ({ ...p, category_id: v ? Number(v) : null }))}
                options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                placeholder="Pick a product category"
                searchPlaceholder="Search product category…"
                emptyText="No product categories — create one under Product categories first."
              />
              <p className="text-[11px] text-muted-foreground">This sub-category appears under the chosen product category in the vendor product form.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Name <span className="text-brand">*</span></Label>
              <Input value={editing?.name ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, name: e.target.value }))} placeholder="Basmati" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editing?.status ?? "active"} onValueChange={(v) => v && setEditing((p) => p && ({ ...p, status: v as "active" | "inactive" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <GradientButton onClick={save} disabled={busy}>{editing?.id ? "Save changes" : "Create"}</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sub-category?</AlertDialogTitle>
            <AlertDialogDescription>Products in this sub-category will keep their product category but lose the sub-category.</AlertDialogDescription>
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
