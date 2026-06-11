"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Shapes, Plus, Search, MoreHorizontal, Pencil, Trash2,
  Type, AlignLeft, Hash, Calendar, ListChecks, ToggleRight, GripVertical, FileJson, Image as ImageIcon, Palette,
} from "lucide-react";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { AttributeField, AttributeFieldType } from "@/lib/mock";

const TYPE_META: Record<AttributeFieldType, { label: string; icon: typeof Type; tone: string }> = {
  text:     { label: "Text",     icon: Type,        tone: "text-blue-400" },
  textarea: { label: "Textarea", icon: AlignLeft,   tone: "text-cyan-400" },
  number:   { label: "Number",   icon: Hash,        tone: "text-amber-400" },
  date:     { label: "Date",     icon: Calendar,    tone: "text-violet-400" },
  select:   { label: "Select",   icon: ListChecks,  tone: "text-emerald-400" },
  toggle:   { label: "Toggle",   icon: ToggleRight, tone: "text-pink-400" },
  image:    { label: "Image",    icon: ImageIcon,   tone: "text-rose-400" },
  color:    { label: "Color",    icon: Palette,     tone: "text-fuchsia-400" },
};

type FieldWithId = AttributeField & { _id: string };

function emptyField(): FieldWithId {
  return { _id: Math.random().toString(36).slice(2), key: "", label: "", type: "text" };
}
function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "");
}
function decorate(list: AttributeField[]): FieldWithId[] {
  return list.map((f) => ({ ...f, _id: Math.random().toString(36).slice(2) }));
}
function strip(list: FieldWithId[]): AttributeField[] {
  return list.map(({ _id: _unused, ...rest }) => rest);
}

type VariantTypeGroup = {
  id: number;
  name: string;
  status: "active" | "inactive";
  category_id: number | null;
  fields: AttributeField[];
};

type Draft = {
  id?: number;
  name: string;
  status: "active" | "inactive";
  category_id: number | null;
  fields: FieldWithId[];
};

type ProductCategoryOption = { id: number; name: string };

function blankDraft(): Draft {
  return { name: "", status: "active", category_id: null, fields: [] };
}

export default function VariantTypeGroupsPage() {
  const [items, setItems] = useState<VariantTypeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [productCats, setProductCats] = useState<ProductCategoryOption[]>([]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/admin/variant-type-groups");
      const rows = (res.data?.data?.items ?? []) as VariantTypeGroup[];
      setItems(rows);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not load variant type groups"));
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/admin/categories");
        const raw = (res.data?.data?.items ?? []) as Array<Record<string, unknown>>;
        setProductCats(raw.map((r) => ({ id: Number(r.id ?? 0), name: String(r.name ?? "") })).filter((c) => c.id > 0 && c.name));
      } catch {
        setProductCats([]);
      }
    })();
  }, []);

  const catName = useMemo(() => {
    const m = new Map<number, string>();
    productCats.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [productCats]);

  const filtered = useMemo(() => items.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  ), [items, search]);

  const totalActive = items.filter((i) => i.status === "active").length;
  const totalFields = items.reduce((s, g) => s + (g.fields?.length ?? 0), 0);

  function startNew() { setEditing(blankDraft()); }
  function startEdit(g: VariantTypeGroup) {
    setEditing({ id: g.id, name: g.name, status: g.status, category_id: g.category_id ?? null, fields: decorate(g.fields ?? []) });
  }

  function addField() {
    setEditing((p) => p && ({ ...p, fields: [...p.fields, emptyField()] }));
  }
  function updateField(id: string, patch: Partial<AttributeField>) {
    setEditing((p) => {
      if (!p) return p;
      const cur = p.fields.map((f) => {
        if (f._id !== id) return f;
        const next = { ...f, ...patch };
        if (patch.label !== undefined && (!f.key || f.key === slugify(f.label))) {
          next.key = slugify(patch.label);
        }
        return next;
      });
      return { ...p, fields: cur };
    });
  }
  function removeField(id: string) {
    setEditing((p) => p && ({ ...p, fields: p.fields.filter((f) => f._id !== id) }));
  }
  function setFieldsOrder(next: FieldWithId[]) {
    setEditing((p) => p && ({ ...p, fields: next }));
  }

  async function save() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) { toast.error("Group name required"); return; }
    for (const f of editing.fields) {
      if (!f.key.trim() || !f.label.trim()) { toast.error("Every field needs a key and label"); return; }
      if (f.type === "select" && (!f.options || f.options.length === 0)) {
        toast.error(`Select field "${f.label}" needs at least one option`); return;
      }
    }
    const keys = editing.fields.map((f) => f.key);
    if (new Set(keys).size !== keys.length) { toast.error("Duplicate field keys"); return; }

    const payload = { name, status: editing.status, category_id: editing.category_id, fields: strip(editing.fields) };
    setBusy(true);
    try {
      if (editing.id) {
        await api.patch(`/admin/variant-type-groups/${editing.id}`, payload);
        toast.success("Group updated");
      } else {
        await api.post("/admin/variant-type-groups", payload);
        toast.success("Group created");
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
      await api.delete(`/admin/variant-type-groups/${deleteId}`);
      setItems((cur) => cur.filter((i) => i.id !== deleteId));
      toast.success("Group removed");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Delete failed"));
    } finally { setDeleteId(null); }
  }

  return (
    <>
      <MobileHeader title="Variant type groups" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Catalog"
          icon={Shapes}
          title="Variant Type Groups"
          description="Reusable variant templates — e.g. Mobile (Color, Storage, RAM), Clothes (Size, Color)."
          action={
            <GradientButton onClick={startNew}>
              <Plus className="h-4 w-4" /> New group
            </GradientButton>
          }
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Total groups"   value={items.length} icon={Shapes}   tone="brand"   spark={[1, 2, 2, 3, 3, 4, 4, 5]} />
          <StatCard label="Active"         value={totalActive}  icon={Shapes}   tone="emerald" spark={[1, 2, 2, 3, 3, 4, 4, 5]} />
          <StatCard label="Dynamic fields" value={totalFields}  icon={FileJson} tone="violet"  spark={[2, 3, 4, 5, 7, 9, 11, 14]} />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search group…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
          </div>
        </div>

        <div className="space-y-3">
          {loading ? null : filtered.length === 0 ? (
            <EmptyState
              icon={Shapes}
              title="No variant type groups"
              description="Create a group like Mobile or Clothes to reuse common variant fields."
              action={<GradientButton onClick={startNew}><Plus className="h-4 w-4" /> New group</GradientButton>}
            />
          ) : filtered.map((g, i) => (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="luxe-card flex items-center gap-4 p-4"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Shapes className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{g.name}</p>
                <p className="text-xs text-muted-foreground">
                  {g.category_id ? <span className="text-brand">{catName.get(g.category_id) ?? "—"}</span> : <span className="italic">Unlinked</span>}
                  {" · "}
                  {(g.fields?.length ?? 0)} field{(g.fields?.length ?? 0) === 1 ? "" : "s"}
                  {g.fields && g.fields.length > 0 ? ` — ${g.fields.map((f) => f.label).slice(0, 4).join(", ")}${g.fields.length > 4 ? "…" : ""}` : ""}
                </p>
              </div>
              <div className="hidden gap-1 sm:flex">
                {(g.fields ?? []).slice(0, 5).map((f) => {
                  const M = TYPE_META[f.type];
                  return (
                    <span key={f.key} className={`inline-flex items-center gap-1 rounded-full border border-border bg-surface-2/60 px-2 py-0.5 text-[10px] font-medium ${M.tone}`}>
                      <M.icon className="h-3 w-3" /> {f.label}
                    </span>
                  );
                })}
                {(g.fields?.length ?? 0) > 5 && <span className="text-[10px] text-muted-foreground">+{(g.fields!.length - 5)}</span>}
              </div>
              <StatusBadge status={g.status} />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button type="button" aria-label="Actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  }
                />
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => startEdit(g)}><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setDeleteId(g.id)} className="text-rose-400 focus:text-rose-400">
                    <Trash2 className="h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </motion.div>
          ))}
        </div>
      </section>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[92vh] sm:!max-w-3xl lg:!max-w-4xl overflow-y-auto rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit group" : "New variant type group"}</DialogTitle>
            <DialogDescription>Group name and a list of dynamic fields (Color, Storage, RAM …).</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Group name <span className="text-brand">*</span></Label>
                <Input
                  value={editing?.name ?? ""}
                  onChange={(e) => setEditing((p) => p && ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Mobile"
                  className="h-11 rounded-xl bg-surface-2/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editing?.status ?? "active"} onValueChange={(v) => v && setEditing((p) => p && ({ ...p, status: v as "active" | "inactive" }))}>
                  <SelectTrigger className="h-11 rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Product category</Label>
                <Combobox
                  value={editing?.category_id != null ? String(editing.category_id) : "none"}
                  onValueChange={(v) => setEditing((p) => p && ({ ...p, category_id: v === "none" ? null : Number(v) }))}
                  options={[{ value: "none", label: "— Unlinked" }, ...productCats.map((c) => ({ value: String(c.id), label: c.name }))]}
                  placeholder={productCats.length ? "Pick a product category" : "Loading…"}
                  searchPlaceholder="Search category…"
                  emptyText="No category found."
                  className="h-11 rounded-xl bg-surface-2/60"
                />
                <p className="text-[11px] text-muted-foreground">Optional. Linking lets this group be reused on products in the chosen category.</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5"><FileJson className="h-3.5 w-3.5 text-brand" /> Dynamic fields</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addField} className="h-8 gap-1 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Add field
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">Drag the grip <GripVertical className="inline h-3 w-3" /> handle to reorder. Each field has a Label, Key and Type.</p>

              {!editing || editing.fields.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-2/30 p-6 text-center">
                  <FileJson className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">No fields yet</p>
                  <p className="text-[11px] text-muted-foreground">Add fields like Color, Storage, RAM — whatever applies to this group.</p>
                </div>
              ) : (
                <Reorder.Group axis="y" values={editing.fields} onReorder={setFieldsOrder} className="space-y-2">
                  <AnimatePresence initial={false}>
                    {editing.fields.map((f) => (
                      <FieldEditor
                        key={f._id}
                        field={f}
                        onUpdate={(patch) => updateField(f._id, patch)}
                        onRemove={() => removeField(f._id)}
                      />
                    ))}
                  </AnimatePresence>
                </Reorder.Group>
              )}
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
            <AlertDialogTitle>Delete group?</AlertDialogTitle>
            <AlertDialogDescription>This group will be removed permanently.</AlertDialogDescription>
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

function FieldEditor({ field, onUpdate, onRemove }: {
  field: FieldWithId;
  onUpdate: (patch: Partial<AttributeField>) => void;
  onRemove: () => void;
}) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={field}
      dragListener={false}
      dragControls={dragControls}
      className="rounded-xl border border-border bg-surface-2/40 p-3"
    >
      <div className="grid grid-cols-[auto_1fr_1fr_140px_auto] gap-2">
        <button
          type="button"
          onPointerDown={(e) => dragControls.start(e)}
          aria-label="Drag to reorder"
          className="flex h-9 w-6 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Label</Label>
          <Input value={field.label} onChange={(e) => onUpdate({ label: e.target.value })} placeholder="e.g. Color" className="h-9 rounded-lg bg-background" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Key</Label>
          <Input value={field.key} onChange={(e) => onUpdate({ key: slugify(e.target.value) })} placeholder="color" className="h-9 rounded-lg bg-background font-mono text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Type</Label>
          <Select value={field.type} onValueChange={(v) => v && onUpdate({
            type: v as AttributeFieldType,
            options: v === "select" ? (field.options ?? []) : undefined,
            unit: v === "number" ? field.unit : undefined,
          })}>
            <SelectTrigger className="h-9 rounded-lg bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_META) as AttributeFieldType[]).map((k) => {
                const M = TYPE_META[k];
                return (
                  <SelectItem key={k} value={k}>
                    <span className="flex items-center gap-2">
                      <M.icon className={`h-3.5 w-3.5 ${M.tone}`} /> {M.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <button type="button" onClick={onRemove} aria-label="Remove field" className="self-end rounded-md p-2 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-[1fr_120px_auto]">
        <Input
          value={field.placeholder ?? ""}
          onChange={(e) => onUpdate({ placeholder: e.target.value || undefined })}
          placeholder={field.type === "select" || field.type === "toggle" || field.type === "image" || field.type === "color" ? "(placeholder not used)" : "Placeholder text (optional)"}
          disabled={field.type === "toggle" || field.type === "select" || field.type === "image" || field.type === "color"}
          className="h-8 rounded-lg bg-background text-xs"
        />
        {field.type === "number" ? (
          <Input value={field.unit ?? ""} onChange={(e) => onUpdate({ unit: e.target.value || undefined })} placeholder="Unit (kg/mAh)" className="h-8 rounded-lg bg-background text-xs" />
        ) : <span />}
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs">
          <input type="checkbox" checked={!!field.required} onChange={(e) => onUpdate({ required: e.target.checked || undefined })} />
          Required
        </label>
      </div>

      {field.type === "select" && (
        <div className="mt-2">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Options (one per line)</Label>
          <Textarea
            rows={3}
            value={(field.options ?? []).join("\n")}
            onChange={(e) => onUpdate({ options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
            className="mt-1 rounded-lg bg-background font-mono text-xs"
            placeholder={"Black\nBlue\nSilver"}
          />
        </div>
      )}

      {field.type === "image" && (
        <p className="mt-2 rounded-lg border border-dashed border-border bg-background/50 p-2 text-[11px] text-muted-foreground">
          Vendor will see a drag-and-drop image uploader for this field on the product form.
        </p>
      )}
    </Reorder.Item>
  );
}
