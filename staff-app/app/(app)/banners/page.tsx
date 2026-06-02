"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Image as ImageIcon, Plus, Search, MoreHorizontal, Pencil, Trash2, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { ImageDrop } from "@/components/ui/custom/image-drop";
import { StatusBadge } from "@/components/data-table/status-badge";
import { EmptyState } from "@/components/data-table/empty-state";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";

type Banner = {
  id: number;
  slot: string;
  sort_order: number;
  eyebrow: string | null;
  title: string | null;
  highlight: string | null;
  subtitle: string | null;
  cta_label: string | null;
  cta_href: string | null;
  image_url: string | null;
  gradient_from: string | null;
  gradient_mid: string | null;
  gradient_to: string | null;
  icon_name: string | null;
  status: "active" | "inactive";
};

const SLOTS = [
  { value: "coupon",            label: "Coupon strip" },
  { value: "hero_left",         label: "Hero — Left tall" },
  { value: "hero_center",       label: "Hero — Center carousel" },
  { value: "hero_right_top",    label: "Hero — Right top" },
  { value: "hero_right_bottom", label: "Hero — Right bottom" },
  { value: "mega_left",         label: "Mega Offers — Left" },
  { value: "mega_right",        label: "Mega Offers — Right" },
];

const LUCIDE_OPTIONS = [
  "ShoppingBag", "ShoppingCart", "Ticket", "Briefcase", "Bike", "Apple", "Cpu", "Pill",
  "UtensilsCrossed", "Sparkles", "Award", "BadgeCheck", "ShieldCheck", "Truck",
  "Watch", "Headphones", "Speaker", "Tv", "Camera", "Tablet", "Smartphone",
  "Wallet", "RotateCcw", "Lock", "Headset", "Gift", "Heart", "Tag", "Percent", "Flame",
  "Store", "Zap", "Crown", "Star", "Gem", "Rocket",
];

type Draft = Partial<Banner>;

function emptyDraft(): Draft {
  return {
    slot: "hero_center",
    sort_order: 0,
    status: "active",
    gradient_from: "#ff7a18",
    gradient_to: "#c91d1d",
  };
}

export default function BannersPage() {
  const [items, setItems] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [slotFilter, setSlotFilter] = useState<string>("__all__");
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [imageMode, setImageMode] = useState<"url" | "upload">("url");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/admin/banners");
      setItems((res.data.data?.items ?? []) as Banner[]);
    } catch (e) {
      toast.error(apiErrorMessage(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => items.filter((b) => {
    const matchesSearch = !search || [b.title, b.eyebrow, b.subtitle, b.cta_label].some((s) =>
      typeof s === "string" && s.toLowerCase().includes(search.toLowerCase())
    );
    const matchesSlot = slotFilter === "__all__" || b.slot === slotFilter;
    return matchesSearch && matchesSlot;
  }), [items, search, slotFilter]);

  async function save() {
    if (!editing) return;
    if (!editing.slot) { toast.error("Slot required"); return; }
    if (!editing.image_url) {
      toast.error("Image is required");
      return;
    }
    setBusy(true);
    try {
      if (editing.id) {
        await api.patch(`/admin/banners/${editing.id}`, editing);
        toast.success("Banner updated");
      } else {
        await api.post("/admin/banners", editing);
        toast.success("Banner created");
      }
      setEditing(null);
      void load();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(b: Banner) {
    const next = b.status === "active" ? "inactive" : "active";
    try {
      await api.patch(`/admin/banners/${b.id}`, { status: next });
      toast.success(`Marked ${next}`);
      void load();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  async function remove() {
    if (deleteId == null) return;
    try {
      await api.delete(`/admin/banners/${deleteId}`);
      toast.success("Banner deleted");
      setDeleteId(null);
      void load();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  const activeCount = items.filter((i) => i.status === "active").length;

  return (
    <>
      <MobileHeader title="Home Banners" />
      <div className="space-y-6 p-4 md:p-8">
        <PageHeader
          icon={ImageIcon}
          title="Home banners"
          description="Manage banners that show on the customer home page across all 7 slots."
          action={
            <GradientButton
              onClick={() => { setImageMode("upload"); setEditing(emptyDraft()); }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> New banner
            </GradientButton>
          }
        />

        <div className="grid gap-4 md:grid-cols-3">
          <Stat label="Total banners" value={items.length} />
          <Stat label="Active" value={activeCount} />
          <Stat label="Slots covered" value={new Set(items.filter(i => i.status === "active").map(i => i.slot)).size + " / " + SLOTS.length} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, eyebrow…" className="pl-9" />
          </div>
          <Select value={slotFilter} onValueChange={setSlotFilter}>
            <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="All slots" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All slots</SelectItem>
              {SLOTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border bg-popover/40 p-6 text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title="No banners yet"
            description="Create your first home page banner."
            action={
              <GradientButton onClick={() => { setImageMode("upload"); setEditing(emptyDraft()); }} className="gap-2">
                <Plus className="h-4 w-4" /> New banner
              </GradientButton>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-popover/40">
            <table className="w-full text-sm">
              <thead className="bg-popover/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Preview</th>
                  <th className="px-4 py-3">Slot</th>
                  <th className="px-4 py-3">Content</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="w-10 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id} className="border-t border-border hover:bg-popover/60">
                    <td className="px-4 py-3">
                      {b.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={b.image_url}
                          alt={b.title ?? ""}
                          className="h-12 w-20 rounded-lg object-cover ring-1 ring-border"
                        />
                      ) : (
                        <div
                          className="h-12 w-20 rounded-lg ring-1 ring-border"
                          style={{ backgroundImage: gradientCss(b) }}
                          title={b.gradient_from ?? ""}
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{b.slot}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{b.title || "—"}</div>
                      <div className="text-xs text-muted-foreground">{b.eyebrow || ""}</div>
                    </td>
                    <td className="px-4 py-3 text-center">{b.sort_order}</td>
                    <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setImageMode(b.image_url?.startsWith("data:") ? "upload" : "url"); setEditing(b); }}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void toggleStatus(b)}>
                            {b.status === "active"
                              ? <><EyeOff className="mr-2 h-4 w-4" /> Mark inactive</>
                              : <><Eye    className="mr-2 h-4 w-4" /> Mark active</>}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleteId(b.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92vh] sm:!max-w-3xl lg:!max-w-4xl overflow-y-auto rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit banner" : "New banner"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Slot + sort + status */}
              <div className="space-y-1.5">
                <Label>Slot</Label>
                <Select value={editing.slot} onValueChange={(v) => setEditing({ ...editing, slot: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SLOTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Sort order (lower = first)</Label>
                <Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label>Eyebrow / pre-title</Label>
                <Input value={editing.eyebrow ?? ""} onChange={(e) => setEditing({ ...editing, eyebrow: e.target.value })} placeholder="Up to 40% off" />
              </div>
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Fresh groceries," />
              </div>
              <div className="space-y-1.5">
                <Label>Highlight (accent text)</Label>
                <Input value={editing.highlight ?? ""} onChange={(e) => setEditing({ ...editing, highlight: e.target.value })} placeholder="delivered in 10 min" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Subtitle</Label>
                <Textarea rows={2} value={editing.subtitle ?? ""} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} placeholder="Body text shown under the title" />
              </div>

              <div className="space-y-1.5">
                <Label>CTA label</Label>
                <Input value={editing.cta_label ?? ""} onChange={(e) => setEditing({ ...editing, cta_label: e.target.value })} placeholder="Shop now" />
              </div>
              <div className="space-y-1.5">
                <Label>CTA link</Label>
                <Input value={editing.cta_href ?? ""} onChange={(e) => setEditing({ ...editing, cta_href: e.target.value })} placeholder="/shop-public" />
              </div>

              {/* Icon */}
              <div className="space-y-1.5">
                <Label>Decorative icon</Label>
                <Select value={editing.icon_name ?? "__none__"} onValueChange={(v) => setEditing({ ...editing, icon_name: v === "__none__" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Pick an icon" /></SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="__none__">(none)</SelectItem>
                    {LUCIDE_OPTIONS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editing.status ?? "active"} onValueChange={(v) => setEditing({ ...editing, status: v as "active" | "inactive" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Image */}
              <div className="md:col-span-2 space-y-2 rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label>Image</Label>
                  <div className="flex gap-1 rounded-lg bg-popover p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setImageMode("url")}
                      className={`rounded px-2.5 py-1 ${imageMode === "url" ? "bg-brand text-brand-foreground" : "text-muted-foreground"}`}
                    >URL</button>
                    <button
                      type="button"
                      onClick={() => setImageMode("upload")}
                      className={`rounded px-2.5 py-1 ${imageMode === "upload" ? "bg-brand text-brand-foreground" : "text-muted-foreground"}`}
                    >Upload</button>
                  </div>
                </div>
                {imageMode === "url" ? (
                  <Input
                    value={editing.image_url ?? ""}
                    onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                    placeholder="https://… or paste a data URL"
                  />
                ) : (
                  <ImageDrop
                    value={editing.image_url ?? null}
                    onChange={(v) => setEditing({ ...editing, image_url: v })}
                    variant="full"
                  />
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <GradientButton onClick={() => void save()} disabled={busy}>
              {busy ? "Saving…" : editing?.id ? "Save changes" : "Create banner"}
            </GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId != null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this banner?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed from the home page immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-popover/40 p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function gradientCss(b: { gradient_from?: string | null; gradient_mid?: string | null; gradient_to?: string | null }): string {
  const stops = [b.gradient_from, b.gradient_mid, b.gradient_to].filter(Boolean) as string[];
  if (stops.length === 0) return "linear-gradient(135deg,#ff7a18,#c91d1d)";
  if (stops.length === 1) return `linear-gradient(135deg,${stops[0]},${stops[0]})`;
  return `linear-gradient(135deg,${stops.join(",")})`;
}
