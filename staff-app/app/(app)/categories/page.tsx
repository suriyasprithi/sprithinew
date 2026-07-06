"use client";

import { useEffect, useMemo, useState } from "react";
import { Tags, Plus, Search, MoreHorizontal, Pencil, Trash2, Layers, GripVertical } from "lucide-react";
import { motion, Reorder, useDragControls } from "framer-motion";
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
import { mock, type VendorCategoryFull } from "@/lib/mock";

type ProductCategory = {
  id: number;
  name: string;
  status: "active" | "inactive";
  vendor_category_id?: number | null;
  vendor_category_name?: string | null;
  sort_order?: number;
};

type Draft = {
  id?: number;
  name: string;
  status: "active" | "inactive";
  vendor_category_id: number | null;
};

function blankDraft(): Draft {
  return { name: "", status: "active", vendor_category_id: null };
}

export default function ProductCategoriesPage() {
  const [items, setItems] = useState<ProductCategory[]>([]);
  const [vendorCats, setVendorCats] = useState<VendorCategoryFull[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [vendorCat, setVendorCat] = useState<"all" | number>("all");
  // Category ids that the chosen vendor category's shops actually stock. The
  // imported vendor_category_id links are unreliable, so the filter is usage-based
  // (matches the customer browse) rather than link-based. null = no vendor-cat
  // filter (show all).
  const [usageIds, setUsageIds] = useState<Set<number> | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const catsP = api.get("/admin/categories").then((r) => (r.data.data?.items ?? []) as ProductCategory[]).catch(() => [] as ProductCategory[]);
      const vcatsP = api.get("/admin/vendor-categories").then((r) => (r.data.data?.items ?? []) as VendorCategoryFull[]).catch(() => mock.vendorCategoriesFull());
      const [cats, vcats] = await Promise.all([catsP, vcatsP]);
      setItems(cats);
      setVendorCats(vcats);
    })();
  }, []);

  // Vendor category picked → load the category ids its shops actually use
  // (usage-based, not the messy stored link). "All" clears the filter.
  useEffect(() => {
    if (vendorCat === "all") { setUsageIds(null); setUsageLoading(false); return; }
    let cancelled = false;
    setUsageLoading(true);
    setUsageIds(null);
    void (async () => {
      try {
        const r = await api.get(`/admin/categories/used-by-vc/${vendorCat}`);
        const ids = (r.data.data?.ids ?? []) as number[];
        if (!cancelled) setUsageIds(new Set(ids.map(Number)));
      } catch {
        if (!cancelled) setUsageIds(new Set());
      } finally {
        if (!cancelled) setUsageLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [vendorCat]);

  const vcatName = useMemo(() => {
    const m = new Map<number, string>();
    vendorCats.forEach((v) => m.set(v.id, v.name));
    return m;
  }, [vendorCats]);

  const filtered = useMemo(() => items.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (status !== "all" && c.status !== status) return false;
    // Usage-based vendor-category filter: only categories the chosen vendor
    // category's shops actually stock (not the unreliable imported link).
    if (usageIds && !usageIds.has(c.id)) return false;
    return true;
  }), [items, search, status, usageIds]);

  const totalActive = items.filter((i) => i.status === "active").length;
  const totalLinked = items.filter((i) => i.vendor_category_id != null).length;

  // Drag-reorder is only meaningful within ONE vendor category and only when the
  // full group is visible (no search / status filter hiding rows) and its usage
  // set has loaded, so the ids we POST are the complete, correctly-ordered group.
  const isReorderable = vendorCat !== "all" && !search && status === "all" && !usageLoading && usageIds !== null;
  async function onReorder(next: ProductCategory[]) {
    const ids = new Set(next.map((c) => c.id));
    const prev = items;
    // Keep the reordered group together (in its new order) ahead of the rest;
    // the view only ever renders `filtered`, so absolute position is cosmetic.
    setItems((cur) => [...next, ...cur.filter((i) => !ids.has(i.id))]);
    try {
      await api.post("/admin/categories/reorder", { ids: next.map((c) => c.id) });
    } catch (e) {
      setItems(prev);
      toast.error(apiErrorMessage(e, "Reorder failed"));
    }
  }

  function startNew() { setEditing(blankDraft()); }
  function startEdit(c: ProductCategory) {
    setEditing({
      id: c.id,
      name: c.name,
      status: c.status,
      vendor_category_id: c.vendor_category_id ?? null,
    });
  }

  async function save() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) { toast.error("Name required"); return; }

    const payload = {
      name,
      vendor_category_id: editing.vendor_category_id,
      status: editing.status,
    };

    setBusy(true);
    try {
      if (editing.id) {
        await api.patch(`/admin/categories/${editing.id}`, payload);
        setItems((cur) => cur.map((i) => (i.id === editing.id ? { ...i, ...payload } as ProductCategory : i)));
        toast.success("Category updated");
      } else {
        const res = await api.post("/admin/categories", payload);
        const id = Number(res.data.data?.id ?? Math.max(0, ...items.map((i) => i.id)) + 1);
        setItems((cur) => [...cur, { id, ...payload }]);
        toast.success("Category created");
      }
      setEditing(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Save failed"));
    } finally { setBusy(false); }
  }

  async function remove() {
    if (deleteId == null) return;
    try {
      await api.delete(`/admin/categories/${deleteId}`);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Delete failed")); return;
    }
    setItems((cur) => cur.filter((i) => i.id !== deleteId));
    toast.success("Category removed");
    setDeleteId(null);
  }

  return (
    <>
      <MobileHeader title="Product categories" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Catalog"
          icon={Tags}
          title="Product categories"
          description="Link each product category to a vendor category — Vegetables/Fruits/Rice → Grocery, etc."
          action={
            <GradientButton onClick={startNew}>
              <Plus className="h-4 w-4" /> New category
            </GradientButton>
          }
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Total categories" value={items.length}     icon={Tags}   tone="brand"   spark={[2, 3, 3, 4, 4, 4, 4, 4]} />
          <StatCard label="Active"           value={totalActive}      icon={Tags}   tone="emerald" spark={[2, 3, 3, 4, 4, 4, 4, 4]} />
          <StatCard label="Linked to vendor cat" value={totalLinked}  icon={Layers} tone="violet"  spark={[1, 2, 2, 3, 3, 4, 4, 4]} />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_220px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search category…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
            </div>
            <Combobox
              value={vendorCat === "all" ? "all" : String(vendorCat)}
              onValueChange={(v) => setVendorCat(v === "all" ? "all" : Number(v))}
              options={[{ value: "all", label: "All vendor categories" }, ...vendorCats.map((v) => ({ value: String(v.id), label: v.name }))]}
              placeholder="Vendor category"
              searchPlaceholder="Search vendor category…"
              emptyText="No vendor category."
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
          {vendorCat !== "all" && (
            <p className="mt-2 px-1 text-[11px] text-muted-foreground">
              {usageLoading
                ? "Loading the categories this vendor category's shops use…"
                : isReorderable
                  ? "Showing the categories these shops actually stock. Drag the ⠿ handle to reorder them."
                  : "Showing the categories these shops actually stock. Clear the search / status filter to drag-reorder."}
            </p>
          )}
        </div>

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[1fr_160px_120px_56px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Name</span>
            <span>Vendor category</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              icon={Tags}
              title="No categories match your filters"
              description="Adjust filters or create a new category."
              action={<GradientButton onClick={startNew}><Plus className="h-4 w-4" /> New category</GradientButton>}
            />
          ) : isReorderable ? (
            <Reorder.Group axis="y" values={filtered} onReorder={onReorder} className="divide-y divide-border">
              {filtered.map((c) => (
                <DraggableCategoryRow
                  key={c.id}
                  c={c}
                  vcatName={vcatName}
                  onEdit={() => startEdit(c)}
                  onDelete={() => setDeleteId(c.id)}
                />
              ))}
            </Reorder.Group>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[1fr_160px_120px_56px]"
                >
                  <CategoryCells c={c} vcatName={vcatName} onEdit={() => startEdit(c)} onDelete={() => setDeleteId(c.id)} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit category" : "New category"}</DialogTitle>
            <DialogDescription>Name and the vendor category this product category belongs to. Commission is set per vendor.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Name <span className="text-brand">*</span></Label>
              <Input value={editing?.name ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, name: e.target.value }))} placeholder="Vegetables" />
            </div>
            <div className="space-y-1.5">
              <Label>Vendor category</Label>
              <Combobox
                value={editing?.vendor_category_id != null ? String(editing.vendor_category_id) : "none"}
                onValueChange={(v) => setEditing((p) => p && ({ ...p, vendor_category_id: v === "none" ? null : Number(v) }))}
                options={[{ value: "none", label: "— Unlinked" }, ...vendorCats.map((v) => ({ value: String(v.id), label: v.name }))]}
                placeholder="Pick a vendor category"
                searchPlaceholder="Search vendor category…"
                emptyText="No vendor category found."
              />
              <p className="text-[11px] text-muted-foreground">Vendors with this vendor category will see this product category in their product form dropdown.</p>
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
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>Products in this category will lose their category mapping.</AlertDialogDescription>
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

/** The 4 table cells (name · vendor category · status · actions) shared by the
 *  plain list and the draggable list, so both render identically. */
function CategoryCells({ c, vcatName, onEdit, onDelete }: {
  c: ProductCategory;
  vcatName: Map<number, string>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Tags className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{c.name}</p>
          <p className="text-xs text-muted-foreground md:hidden">
            {c.vendor_category_id ? (c.vendor_category_name ?? vcatName.get(c.vendor_category_id) ?? "—") : "Unlinked"}
          </p>
        </div>
      </div>
      <p className="hidden text-xs md:block">
        {c.vendor_category_id ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-brand/20 bg-brand/5 px-2 py-0.5 font-medium text-brand">
            <Layers className="h-3 w-3" /> {c.vendor_category_name ?? vcatName.get(c.vendor_category_id) ?? "—"}
          </span>
        ) : (
          <span className="text-muted-foreground">— Unlinked</span>
        )}
      </p>
      <div className="hidden md:block"><StatusBadge status={c.status} /></div>
      <div className="flex items-center gap-2 justify-self-end">
        <span className="md:hidden"><StatusBadge status={c.status} /></span>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" aria-label="Row actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-rose-400 focus:text-rose-400">
              <Trash2 className="h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}

/** A draggable table row (grip handle only initiates the drag, so the dropdown
 *  stays clickable). Same columns as the plain row, with a grip prepended. */
function DraggableCategoryRow({ c, vcatName, onEdit, onDelete }: {
  c: ProductCategory;
  vcatName: Map<number, string>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dragControls = useDragControls();
  return (
    <Reorder.Item
      value={c}
      dragListener={false}
      dragControls={dragControls}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 bg-surface px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[auto_1fr_160px_120px_56px]"
    >
      <button
        type="button"
        onPointerDown={(e) => dragControls.start(e)}
        aria-label="Drag to reorder"
        className="flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <CategoryCells c={c} vcatName={vcatName} onEdit={onEdit} onDelete={onDelete} />
    </Reorder.Item>
  );
}
