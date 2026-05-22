"use client";

import { useEffect, useMemo, useState } from "react";
import { Store, Search, Plus, MoreHorizontal, Pencil, KeyRound } from "lucide-react";
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
import { api, apiErrorMessage } from "@/lib/api";
import type { ManagedVendor } from "@/lib/mock";

const PAGE_SIZE = 10;

type NewVendor = { name: string; mobile: string; shop_name: string; password: string; vendor_category_id: string; commission_pct: string };
type EditVendor = { id: number; name: string; shop_name: string; vendor_category_id: string; commission_pct: string };
type ResetPw = { id: number; shop_name: string; password: string };
type VendorCategoryOption = { id: number; name: string };
type Vendor = ManagedVendor & { vendor_category_id: number | null; commission_pct: number };

function normalizeVendor(raw: unknown): Vendor {
  const r = raw as Record<string, unknown>;
  const profile = (r.profile ?? null) as Record<string, unknown> | null;
  const shopName = (profile?.shop_name as string | undefined) || (r.name as string | undefined) || "";
  const taluk = (profile?.taluk_name as string | undefined) || "";
  const status = r.status === "blocked" ? "blocked" : r.status === "inactive" ? "inactive" : "active";
  const catRaw = profile?.vendor_category_id;
  const vendor_category_id = catRaw === null || catRaw === undefined ? null : Number(catRaw) || null;
  const commission_pct = profile?.commission_pct !== undefined && profile?.commission_pct !== null
    ? Number(profile.commission_pct) || 0
    : 10;
  return {
    id: Number(r.id ?? 0),
    name: (r.name as string | undefined) || "",
    mobile: (r.mobile_number as string | undefined) || "",
    shop_name: shopName,
    taluk,
    status,
    vendor_category_id,
    commission_pct,
  };
}

export default function ManageVendorsPage() {
  const [items, setItems] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive" | "blocked">("all");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState<NewVendor | null>(null);
  const [editing, setEditing] = useState<EditVendor | null>(null);
  const [resetting, setResetting] = useState<ResetPw | null>(null);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<VendorCategoryOption[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/vendors");
        const payload = res.data.data;
        const raw = (Array.isArray(payload?.items) ? payload.items : []) as unknown[];
        setItems(raw.map(normalizeVendor));
      } catch (err) {
        toast.error(apiErrorMessage(err, "Could not load vendors"));
      } finally {
        setLoading(false);
      }
    })();
    void (async () => {
      try {
        const res = await api.get("/vendor-categories");
        const raw = (res.data?.data?.items ?? []) as Array<Record<string, unknown>>;
        setCategories(raw.map((r) => ({ id: Number(r.id ?? 0), name: String(r.name ?? "") })).filter((c) => c.id > 0 && c.name));
      } catch (err) {
        toast.error(apiErrorMessage(err, "Could not load vendor categories"));
      }
    })();
  }, []);

  const filtered = useMemo(() => items.filter((v) => {
    if (search) {
      const q = search.toLowerCase();
      if (!v.name.toLowerCase().includes(q) && !v.shop_name.toLowerCase().includes(q) && !v.mobile.includes(q)) return false;
    }
    if (status !== "all" && v.status !== status) return false;
    return true;
  }), [items, search, status]);

  useEffect(() => setPage(1), [search, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalActive = items.filter((v) => v.status === "active").length;

  async function save() {
    if (!adding) return;
    if (!adding.name || !adding.mobile || !adding.shop_name || !adding.password || !adding.vendor_category_id) {
      toast.error("All fields required");
      return;
    }
    if (adding.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    const commissionPct = adding.commission_pct === "" ? 10 : Number(adding.commission_pct);
    if (Number.isNaN(commissionPct) || commissionPct < 0 || commissionPct > 100) {
      toast.error("Commission must be 0–100");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/vendors", {
        name: adding.name,
        mobile_number: adding.mobile,
        password: adding.password,
        shop_name: adding.shop_name,
        vendor_category_id: Number(adding.vendor_category_id),
        commission_pct: commissionPct,
      });
      const newId = Number(res.data?.data?.id ?? 0);
      setItems((cur) => [
        { id: newId, name: adding.name, mobile: adding.mobile, shop_name: adding.shop_name, taluk: "", status: "active", vendor_category_id: Number(adding.vendor_category_id), commission_pct: commissionPct },
        ...cur,
      ]);
      toast.success("Vendor created");
      setAdding(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not create vendor"));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(v: Vendor) {
    setEditing({
      id: v.id,
      name: v.name,
      shop_name: v.shop_name,
      vendor_category_id: v.vendor_category_id ? String(v.vendor_category_id) : "",
      commission_pct: String(v.commission_pct ?? 10),
    });
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editing.name || !editing.shop_name || !editing.vendor_category_id) {
      toast.error("All fields required");
      return;
    }
    const commissionPct = editing.commission_pct === "" ? 10 : Number(editing.commission_pct);
    if (Number.isNaN(commissionPct) || commissionPct < 0 || commissionPct > 100) {
      toast.error("Commission must be 0–100");
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/vendors/${editing.id}`, {
        name: editing.name,
        shop_name: editing.shop_name,
        vendor_category_id: Number(editing.vendor_category_id),
        commission_pct: commissionPct,
      });
      setItems((cur) => cur.map((x) => (x.id === editing.id
        ? { ...x, name: editing.name, shop_name: editing.shop_name, vendor_category_id: Number(editing.vendor_category_id), commission_pct: commissionPct }
        : x)));
      toast.success("Vendor updated");
      setEditing(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update vendor"));
    } finally {
      setSaving(false);
    }
  }

  async function saveResetPw() {
    if (!resetting) return;
    if (!resetting.password || resetting.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/vendors/${resetting.id}/reset-password`, { password: resetting.password });
      toast.success(`Password reset for ${resetting.shop_name}`);
      setResetting(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not reset password"));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(v: Vendor) {
    const next = v.status === "active" ? "blocked" : "active";
    const action = next === "active" ? "unblock" : "block";
    try {
      await api.post(`/vendors/${v.id}/${action}`);
      setItems((cur) => cur.map((x) => (x.id === v.id ? { ...x, status: next } : x)));
      toast.success(`${v.shop_name} ${next}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, `Could not ${action} ${v.shop_name}`));
    }
  }

  return (
    <>
      <MobileHeader title="Vendors" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Network"
          icon={Store}
          title="Vendors"
          description="Onboard, manage and monitor shop owners in your area."
          action={
            <GradientButton onClick={() => setAdding({ name: "", mobile: "", shop_name: "", password: "", vendor_category_id: "", commission_pct: "10" })}>
              <Plus className="h-4 w-4" /> New vendor
            </GradientButton>
          }
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Total vendors" value={items.length} icon={Store} tone="brand"   spark={[2, 3, 3, 3, 3, 3, 3, 3]} />
          <StatCard label="Active"        value={totalActive}  icon={Store} tone="emerald" spark={[2, 3, 3, 3, 3, 3, 3, 3]} />
          <StatCard label="Blocked"       value={items.filter((v) => v.status === "blocked").length} icon={Store} tone="amber" spark={[0, 0, 0, 0, 0, 0, 0, 0]} />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search shop, owner, mobile…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
            </div>
            <Select value={status} onValueChange={(v) => v && setStatus(v as "all" | "active" | "inactive" | "blocked")}>
              <SelectTrigger className="h-10 rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[1.4fr_1fr_140px_90px_120px_56px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Shop / Owner</span>
            <span>Taluk</span>
            <span>Mobile</span>
            <span>Commission</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          {loading ? (
            <div className="p-3"><TableSkeleton rows={6} cols={5} /></div>
          ) : paged.length === 0 ? (
            <EmptyState icon={Store} title="No vendors match your filters" />
          ) : (
            <div className="divide-y divide-border">
              {paged.map((v, i) => (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[1.4fr_1fr_140px_90px_120px_56px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-xs font-semibold text-brand">
                      {(v.shop_name || v.name || "?").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{v.shop_name || "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">{v.name}</p>
                    </div>
                  </div>
                  <p className="hidden text-sm text-muted-foreground md:block">{v.taluk || "—"}</p>
                  <p className="hidden text-sm text-muted-foreground md:block">{v.mobile}</p>
                  <p className="hidden text-sm font-medium md:block">{Number(v.commission_pct ?? 0).toFixed(2)}%</p>
                  <div className="hidden md:block"><StatusBadge status={v.status} /></div>
                  <div className="flex items-center gap-2 justify-self-end">
                    <span className="md:hidden"><StatusBadge status={v.status} /></span>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button type="button" aria-label="Row actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => startEdit(v)}>
                          <Pencil className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setResetting({ id: v.id, shop_name: v.shop_name, password: "" })}>
                          <KeyRound className="h-4 w-4" /> Reset password
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggle(v)}>
                          {v.status === "active" ? "Block" : "Activate"}
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
            <DialogTitle>New vendor</DialogTitle>
            <DialogDescription>Onboard a shop owner under your taluk.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5"><Label>Owner name</Label><Input value={adding?.name ?? ""} onChange={(e) => setAdding((p) => p && ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Mobile</Label><Input inputMode="numeric" value={adding?.mobile ?? ""} onChange={(e) => setAdding((p) => p && ({ ...p, mobile: e.target.value.replace(/\D/g, "") }))} /></div>
            <div className="space-y-1.5"><Label>Shop name</Label><Input value={adding?.shop_name ?? ""} onChange={(e) => setAdding((p) => p && ({ ...p, shop_name: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Vendor category</Label>
              <Select
                value={adding?.vendor_category_id ?? ""}
                onValueChange={(v) => v && setAdding((p) => p && ({ ...p, vendor_category_id: v }))}
              >
                <SelectTrigger className="h-10 rounded-xl bg-surface-2/60">
                  <SelectValue placeholder={categories.length ? "Choose a category" : "Loading…"}>
                    {(value: unknown) => {
                      const id = Number(value);
                      const c = categories.find((c) => c.id === id);
                      return c ? c.name : "";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Commission % <span className="text-muted-foreground">(of each order)</span></Label>
              <Input type="number" step="0.01" min={0} max={100} value={adding?.commission_pct ?? "10"} onChange={(e) => setAdding((p) => p && ({ ...p, commission_pct: e.target.value }))} placeholder="10" />
            </div>
            <div className="space-y-1.5"><Label>Password</Label><Input type="password" autoComplete="new-password" value={adding?.password ?? ""} onChange={(e) => setAdding((p) => p && ({ ...p, password: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdding(null)} disabled={saving}>Cancel</Button>
            <GradientButton onClick={save} disabled={saving}>{saving ? "Creating…" : "Create vendor"}</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Edit vendor</DialogTitle>
            <DialogDescription>Update owner name, shop name, or category.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5"><Label>Owner name</Label><Input value={editing?.name ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Shop name</Label><Input value={editing?.shop_name ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, shop_name: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Vendor category</Label>
              <Select
                value={editing?.vendor_category_id ?? ""}
                onValueChange={(v) => v && setEditing((p) => p && ({ ...p, vendor_category_id: v }))}
              >
                <SelectTrigger className="h-10 rounded-xl bg-surface-2/60">
                  <SelectValue placeholder={categories.length ? "Choose a category" : "Loading…"}>
                    {(value: unknown) => {
                      const id = Number(value);
                      const c = categories.find((c) => c.id === id);
                      return c ? c.name : "";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Commission % <span className="text-muted-foreground">(of each order)</span></Label>
              <Input type="number" step="0.01" min={0} max={100} value={editing?.commission_pct ?? "10"} onChange={(e) => setEditing((p) => p && ({ ...p, commission_pct: e.target.value }))} placeholder="10" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <GradientButton onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save changes"}</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetting} onOpenChange={(o) => !o && setResetting(null)}>
        <DialogContent className="rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>Set a new login password for {resetting?.shop_name || "this vendor"}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>New password</Label>
              <Input
                type="password"
                autoComplete="new-password"
                value={resetting?.password ?? ""}
                onChange={(e) => setResetting((p) => p && ({ ...p, password: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetting(null)} disabled={saving}>Cancel</Button>
            <GradientButton onClick={saveResetPw} disabled={saving}>{saving ? "Saving…" : "Reset password"}</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
