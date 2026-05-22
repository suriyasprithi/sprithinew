"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers, Plus, Search, MoreHorizontal, Pencil, Trash2, GripVertical } from "lucide-react";
import { motion, Reorder, useDragControls } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { ImageDrop } from "@/components/ui/custom/image-drop";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/data-table/status-badge";
import { EmptyState } from "@/components/data-table/empty-state";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { mock, type VendorCategoryFull } from "@/lib/mock";

type Draft = Partial<VendorCategoryFull>;

export default function VendorCategoriesPage() {
  const [items, setItems] = useState<VendorCategoryFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/admin/vendor-categories");
      const rows = (res.data.data?.items ?? []) as VendorCategoryFull[];
      setItems(rows);
    } catch {
      const rows = await mock.vendorCategoriesFull();
      setItems(rows);
      toast.message("Showing offline sample (backend unreachable)");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => items.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  ), [items, search]);

  async function save() {
    if (!editing) return;
    const name = (editing.name ?? "").trim();
    if (!name) { toast.error("Category required"); return; }
    if (!editing.image) { toast.error("Image required"); return; }

    const payload = {
      name,
      image: editing.image,
      status: editing.status ?? "active",
    };

    setBusy(true);
    try {
      if (editing.id) {
        await api.patch(`/admin/vendor-categories/${editing.id}`, payload);
        toast.success("Category updated");
      } else {
        await api.post("/admin/vendor-categories", payload);
        toast.success("Category created");
      }
      setEditing(null);
      void load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Save failed"));
    } finally { setBusy(false); }
  }

  async function remove() {
    if (deleteId == null) return;
    try {
      await api.delete(`/admin/vendor-categories/${deleteId}`);
      toast.success("Category removed");
      setItems((cur) => cur.filter((i) => i.id !== deleteId));
    } catch (e) {
      toast.error(apiErrorMessage(e, "Delete failed"));
    } finally { setDeleteId(null); }
  }

  function startNew() { setEditing({ name: "", image: null, status: "active" }); }
  function startEdit(c: VendorCategoryFull) { setEditing({ id: c.id, name: c.name, image: c.image, status: c.status }); }

  // Drag-reorder: optimistic local update + POST full id list to backend.
  // Only enabled when there's no search filter — reordering a filtered view
  // would silently leave the hidden rows behind, which is confusing.
  const isReorderable = !search;
  async function onReorder(next: VendorCategoryFull[]) {
    const prev = items;
    setItems(next);
    try {
      await api.post("/admin/vendor-categories/reorder", { ids: next.map((c) => c.id) });
    } catch (e) {
      setItems(prev);
      toast.error(apiErrorMessage(e, "Reorder failed"));
    }
  }

  return (
    <>
      <MobileHeader title="Vendor categories" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Catalog"
          icon={Layers}
          title="Vendor categories"
          description="Group vendors by shop type. Product-level dynamic fields are configured on Product categories."
          action={
            <GradientButton onClick={startNew}>
              <Plus className="h-4 w-4" /> New category
            </GradientButton>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="Total categories" value={items.length} icon={Layers} tone="brand"   spark={[1, 2, 2, 3, 3, 4, 4, 5]} />
          <StatCard label="Active"           value={items.filter((i) => i.status === "active").length} icon={Layers} tone="emerald" spark={[1, 2, 2, 3, 3, 4, 4, 5]} />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search category…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
          </div>
        </div>

        {loading ? null : filtered.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No vendor categories"
            description="Create a category to start onboarding vendors."
            action={<GradientButton onClick={startNew}><Plus className="h-4 w-4" /> New category</GradientButton>}
          />
        ) : isReorderable ? (
          <Reorder.Group axis="y" values={items} onReorder={onReorder} className="space-y-3">
            {items.map((c) => (
              <CategoryRow
                key={c.id}
                cat={c}
                onEdit={() => startEdit(c)}
                onDelete={() => setDeleteId(c.id)}
              />
            ))}
          </Reorder.Group>
        ) : (
          // Search active — drag is hidden because it would reorder hidden rows too.
          <div className="space-y-3">
            {filtered.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="luxe-card flex items-center gap-4 p-4"
              >
                <RowImage src={c.image} name={c.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.image ? "Image set" : "No image"}</p>
                </div>
                <StatusBadge status={c.status} />
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button type="button" aria-label="Actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onClick={() => startEdit(c)}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setDeleteId(c.id)} className="text-rose-400 focus:text-rose-400">
                      <Trash2 className="h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[92vh] sm:!max-w-2xl overflow-y-auto rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit vendor category" : "New vendor category"}</DialogTitle>
            <DialogDescription>Name and image only — dynamic fields are configured under Product categories.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Category <span className="text-brand">*</span></Label>
                <Input
                  value={editing?.name ?? ""}
                  onChange={(e) => setEditing((p) => p && ({ ...p, name: e.target.value }))}
                  placeholder="Enter Category"
                  className="h-11 rounded-xl bg-surface-2/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={(editing?.status as string) ?? "active"} onValueChange={(v) => v && setEditing((p) => p && ({ ...p, status: v as "active" | "inactive" }))}>
                  <SelectTrigger className="h-11 rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Image <span className="text-brand">*</span></Label>
              <ImageDrop value={editing?.image ?? null} onChange={(d) => setEditing((p) => p && ({ ...p, image: d }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <GradientButton onClick={save} disabled={busy}>{editing?.id ? "Save changes" : "Save"}</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId != null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl border-border bg-popover">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>Vendors mapped to this category will need to be re-assigned.</AlertDialogDescription>
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

/** Row thumbnail — falls back to a brand tile if the image is missing or broken. */
function CategoryRow({ cat, onEdit, onDelete }: {
  cat: VendorCategoryFull;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // dragListener=false on the Reorder.Item + a button that calls
  // dragControls.start(e) means only the grip handle initiates a drag — the
  // rest of the row stays clickable (dropdown menu still works).
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={cat}
      dragListener={false}
      dragControls={dragControls}
      className="luxe-card flex items-center gap-3 p-4"
    >
      <button
        type="button"
        onPointerDown={(e) => dragControls.start(e)}
        aria-label="Drag to reorder"
        className="flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <RowImage src={cat.image} name={cat.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{cat.name}</p>
        <p className="text-xs text-muted-foreground">{cat.image ? "Image set" : "No image"}</p>
      </div>
      <StatusBadge status={cat.status} />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button type="button" aria-label="Actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          }
        />
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={onEdit}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="text-rose-400 focus:text-rose-400">
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Reorder.Item>
  );
}

function RowImage({ src, name }: { src: string | null | undefined; name: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(true)}
        className="h-14 w-14 shrink-0 rounded-xl object-cover"
      />
    );
  }
  return (
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
      <Layers className="h-5 w-5" />
    </span>
  );
}
