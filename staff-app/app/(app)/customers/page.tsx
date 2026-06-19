"use client";

import { useEffect, useState } from "react";
import { Users, Search, MoreHorizontal, Ban, CheckCircle2, Wallet as WalletIcon, Pencil, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { mock, type ManagedCustomer } from "@/lib/mock";

const PAGE_SIZE = 20;
const fmtINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const fmtDate = (s: string) => (s ? new Date(s.replace(" ", "T")).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

type CustomerStats = { total: number; active: number; inactive: number; wallet_sum: number };

// Edit form carries an extra (write-only) password field the row model doesn't have.
type EditForm = ManagedCustomer & { password: string };
type WalletForm = { id: number; name: string; balance: number; direction: "credit" | "debit"; amount: string; notes: string };

// Admin "Add customer" — created without OTP (unlike public signup).
type CreateForm = {
  name: string; mobile: string; password: string; email: string; pincode: string;
  dob: string; state_id: string; district_id: string; taluk_id: string; referrer_code: string;
};
const BLANK_CREATE: CreateForm = { name: "", mobile: "", password: "", email: "", pincode: "", dob: "", state_id: "", district_id: "", taluk_id: "", referrer_code: "" };
type GeoData = {
  states: { id: number; name: string }[];
  districts: { id: number; state_id: number; name: string }[];
  taluks: { id: number; district_id: number; name: string }[];
};
const selectCls = "h-10 w-full appearance-none rounded-xl border border-input bg-surface-2/60 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50";

// Normalize backend payload to ManagedCustomer — the backend may use mobile_number / wallet
function normalizeCustomer(raw: unknown): ManagedCustomer {
  const r = raw as Record<string, unknown>;
  const mobile = (r.mobile ?? r.mobile_number ?? "") as string;
  const wallet = Number(r.wallet_balance ?? r.wallet ?? 0);
  return {
    id: Number(r.id ?? 0),
    name: (r.name ?? "") as string,
    mobile,
    email: (r.email ?? "") as string,
    pincode: (r.pincode ?? "") as string,
    wallet_balance: Number.isFinite(wallet) ? wallet : 0,
    status: r.status === "active" ? "active" : "inactive",
    created_at: (r.created_at ?? "") as string,
    referrer_name: (r.referrer_name ?? null) as string | null,
    referrer_mobile: (r.referrer_mobile ?? null) as string | null,
  };
}

export default function AdminCustomersPage() {
  const [items, setItems] = useState<ManagedCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<CustomerStats>({ total: 0, active: 0, inactive: 0, wallet_sum: 0 });

  const [editing, setEditing] = useState<EditForm | null>(null);
  const [wallet, setWallet] = useState<WalletForm | null>(null);
  const [creating, setCreating] = useState<CreateForm | null>(null);
  const [geo, setGeo] = useState<GeoData>({ states: [], districts: [], taluks: [] });
  const [saving, setSaving] = useState(false);

  // Geo options for the Add-customer dropdowns (public endpoint, cascaded client-side).
  useEffect(() => {
    void (async () => {
      try {
        const r = await api.get("/public/locations");
        setGeo({
          states: r.data?.data?.states ?? [],
          districts: r.data?.data?.districts ?? [],
          taluks: r.data?.data?.taluks ?? [],
        });
      } catch { /* dropdowns stay empty — fields are optional */ }
    })();
  }, []);

  // Debounce the search box — it drives a server-side query, not local filtering.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // A new query or status filter always restarts at page 1.
  useEffect(() => { setPage(1); }, [debouncedSearch, status]);

  // Fetch one server page at a time; the backend owns filtering, paging and the
  // aggregate stat counts (there are far more customers than fit on one page).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await api.get("/admin/customers", {
          params: {
            q: debouncedSearch || undefined,
            status: status !== "all" ? status : undefined,
            page,
            per_page: PAGE_SIZE,
          },
        });
        if (cancelled) return;
        const payload = res.data.data;
        const raw = (Array.isArray(payload?.items) ? payload.items
                   : Array.isArray(payload) ? payload
                   : []) as unknown[];
        setItems(raw.map(normalizeCustomer));
        setTotal(Number(payload?.total ?? raw.length));
        const s = payload?.stats;
        if (s) {
          setStats({
            total: Number(s.total ?? 0),
            active: Number(s.active ?? 0),
            inactive: Number(s.inactive ?? 0),
            wallet_sum: Number(s.wallet_sum ?? 0),
          });
        }
      } catch (err) {
        if (cancelled) return;
        // Network or backend not reachable — fall back to mock so the page stays usable
        toast.error(apiErrorMessage(err, "Could not load customers, showing offline sample"));
        const m = await mock.customers();
        setItems(m);
        setTotal(m.length);
        setStats({
          total: m.length,
          active: m.filter((c) => c.status === "active").length,
          inactive: m.filter((c) => c.status !== "active").length,
          wallet_sum: m.reduce((sum, c) => sum + c.wallet_balance, 0),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedSearch, status, page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  async function toggle(c: ManagedCustomer) {
    const next = c.status === "active" ? "inactive" : "active";
    const action = next === "active" ? "activate" : "deactivate";
    try {
      await api.post(`/admin/customers/${c.id}/${action}`);
      setItems((cur) => cur.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
      setStats((s) => ({
        ...s,
        active: s.active + (next === "active" ? 1 : -1),
        inactive: s.inactive + (next === "inactive" ? 1 : -1),
      }));
      toast.success(`${c.name} ${next === "active" ? "activated" : "deactivated"}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, `Could not ${action} ${c.name}`));
    }
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: editing.name.trim(),
        email: editing.email.trim(),
        mobile_number: editing.mobile.trim(),
        pincode: editing.pincode.trim(),
      };
      if (editing.password.trim()) body.password = editing.password;
      const res = await api.patch(`/admin/customers/${editing.id}`, body);
      const updated = normalizeCustomer(res.data.data);
      setItems((cur) => cur.map((x) => (x.id === editing.id ? updated : x)));
      toast.success("Customer saved");
      setEditing(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save customer"));
    } finally {
      setSaving(false);
    }
  }

  async function saveWallet() {
    if (!wallet) return;
    const amt = parseFloat(wallet.amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (wallet.direction === "debit" && amt > wallet.balance) { toast.error("Amount exceeds balance"); return; }
    setSaving(true);
    try {
      const res = await api.post(`/admin/customers/${wallet.id}/wallet`, {
        amount: amt,
        direction: wallet.direction,
        notes: wallet.notes.trim() || undefined,
      });
      const newBal = Number(res.data.data?.wallet_balance ?? wallet.balance);
      setItems((cur) => cur.map((x) => (x.id === wallet.id ? { ...x, wallet_balance: newBal } : x)));
      setStats((s) => ({ ...s, wallet_sum: s.wallet_sum + (newBal - wallet.balance) }));
      toast.success(`Wallet ${wallet.direction === "credit" ? "credited" : "debited"} for ${wallet.name}`);
      setWallet(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update wallet"));
    } finally {
      setSaving(false);
    }
  }

  async function saveCreate() {
    if (!creating) return;
    if (!creating.name.trim()) { toast.error("Name is required"); return; }
    if (!/^[0-9]{10}$/.test(creating.mobile.trim())) { toast.error("Enter a valid 10-digit mobile"); return; }
    if (creating.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setSaving(true);
    try {
      const res = await api.post("/admin/customers", {
        name: creating.name.trim(),
        mobile_number: creating.mobile.trim(),
        password: creating.password,
        email: creating.email.trim() || undefined,
        pincode: creating.pincode.trim() || undefined,
        dob: creating.dob || undefined,
        state_id: creating.state_id || undefined,
        district_id: creating.district_id || undefined,
        taluk_id: creating.taluk_id || undefined,
        referrer_code: creating.referrer_code.trim() || undefined,
      });
      const created = normalizeCustomer(res.data.data);
      setItems((cur) => [created, ...cur]);
      setTotal((t) => t + 1);
      setStats((s) => ({ ...s, total: s.total + 1, active: s.active + 1 }));
      toast.success("Customer created");
      setCreating(null);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not create customer"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <MobileHeader title="Customers" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Users"
          icon={Users}
          title="Customers"
          description="Manage customer accounts, wallet balances and access."
          action={
            <GradientButton onClick={() => setCreating({ ...BLANK_CREATE })}>
              <UserPlus className="h-4 w-4" /> Add customer
            </GradientButton>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total customers" value={stats.total}      icon={Users}        tone="brand"   spark={[4, 5, 5, 6, 6, 7, 7, 8]} />
          <StatCard label="Active"          value={stats.active}     icon={CheckCircle2} tone="emerald" spark={[4, 5, 5, 6, 6, 7, 7, 8]} />
          <StatCard label="Inactive"        value={stats.inactive}   icon={Ban}          tone="amber"   spark={[1, 1, 1, 1, 1, 1, 1, 1]} />
          <StatCard label="Wallet held"     value={stats.wallet_sum} icon={WalletIcon}   tone="violet"  spark={[3, 4, 5, 5, 6, 6, 7, 7]} format={fmtINR} />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search id, name, mobile, pincode…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
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
          <div className="overflow-x-auto">
            <div className="md:min-w-[1080px]">
              <div className="hidden grid-cols-[56px_minmax(150px,1.3fr)_120px_minmax(170px,1.6fr)_150px_110px_110px_100px_44px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
                <span>ID</span>
                <span>Customer</span>
                <span>Mobile</span>
                <span>Email</span>
                <span>Referred By</span>
                <span>Created</span>
                <span>Wallet</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
              </div>
              {loading ? (
                <div className="p-3"><TableSkeleton rows={6} cols={5} /></div>
              ) : items.length === 0 ? (
                <EmptyState icon={Users} title="No customers match your filters" description="Try a different search or status filter." />
              ) : (
                <div className="divide-y divide-border">
                  {items.map((c, i) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[56px_minmax(150px,1.3fr)_120px_minmax(170px,1.6fr)_150px_110px_110px_100px_44px]"
                    >
                      <p className="hidden font-mono text-xs text-muted-foreground md:block">#{c.id}</p>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-xs font-semibold text-brand">
                          {(c.name || "?").charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{c.name || "—"}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            <span className="md:hidden">#{c.id} · </span>
                            {c.mobile || c.pincode || "—"}
                          </p>
                        </div>
                      </div>
                      <p className="hidden text-sm font-mono text-muted-foreground md:block">{c.mobile || "—"}</p>
                      <p className="hidden truncate text-sm text-muted-foreground md:block" title={c.email || ""}>{c.email || "—"}</p>
                      <div className="hidden min-w-0 md:block">
                        {c.referrer_name ? (
                          <>
                            <p className="truncate text-sm">{c.referrer_name}</p>
                            {c.referrer_mobile && <p className="truncate text-xs text-muted-foreground">{c.referrer_mobile}</p>}
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>
                      <p className="hidden text-sm text-muted-foreground md:block">{fmtDate(c.created_at)}</p>
                      <p className="hidden text-sm font-medium text-emerald-400 md:block">{fmtINR(c.wallet_balance)}</p>
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
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => setEditing({ ...c, password: "" })}>
                              <Pencil className="h-4 w-4" /> Edit customer
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setWallet({ id: c.id, name: c.name, balance: c.wallet_balance, direction: "credit", amount: "", notes: "" })}>
                              <WalletIcon className="h-4 w-4" /> Adjust wallet
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggle(c)}>
                              {c.status === "active" ? <><Ban className="h-4 w-4" /> Deactivate</> : <><CheckCircle2 className="h-4 w-4" /> Activate</>}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {!loading && total > 0 && (
            <div className="border-t border-border bg-surface-2/40 px-4 py-3">
              <Pagination page={safePage} pageCount={pageCount} onPageChange={setPage} total={total} pageSize={PAGE_SIZE} />
            </div>
          )}
        </div>
      </section>

      {/* Edit customer */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Edit customer</DialogTitle>
            <DialogDescription>Update account details or set a new password.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={editing?.name ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={editing?.email ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, email: e.target.value }))} placeholder="—" /></div>
            <div className="space-y-1.5"><Label>Mobile</Label><Input value={editing?.mobile ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, mobile: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Pincode</Label><Input value={editing?.pincode ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, pincode: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>New password <span className="text-muted-foreground">(leave blank to keep)</span></Label>
              <Input type="password" autoComplete="new-password" value={editing?.password ?? ""} onChange={(e) => setEditing((p) => p && ({ ...p, password: e.target.value }))} />
            </div>
            <div className="rounded-xl bg-surface-2/40 p-3 text-xs text-muted-foreground">
              <p>Referred by: <span className="text-foreground">{editing?.referrer_name || "—"}</span>{editing?.referrer_mobile ? ` · ${editing.referrer_mobile}` : ""}</p>
              <p className="mt-1">Joined: <span className="text-foreground">{fmtDate(editing?.created_at ?? "")}</span></p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <GradientButton onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save changes"}</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust wallet */}
      <Dialog open={!!wallet} onOpenChange={(o) => !o && setWallet(null)}>
        <DialogContent className="rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Adjust wallet</DialogTitle>
            <DialogDescription>
              {wallet ? `${wallet.name} · current balance ${fmtINR(wallet.balance)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Action</Label>
              <Select value={wallet?.direction ?? "credit"} onValueChange={(v) => v && setWallet((p) => p && ({ ...p, direction: v as "credit" | "debit" }))}>
                <SelectTrigger className="h-10 rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Add money</SelectItem>
                  <SelectItem value="debit">Deduct money</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input type="number" min={0} step="0.01" value={wallet?.amount ?? ""} onChange={(e) => setWallet((p) => p && ({ ...p, amount: e.target.value }))} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Note <span className="text-muted-foreground">(optional)</span></Label>
              <Input value={wallet?.notes ?? ""} onChange={(e) => setWallet((p) => p && ({ ...p, notes: e.target.value }))} placeholder="Reason for adjustment" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWallet(null)} disabled={saving}>Cancel</Button>
            <GradientButton onClick={saveWallet} disabled={saving}>{saving ? "Saving…" : wallet?.direction === "debit" ? "Deduct" : "Add"}</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add customer (no OTP) */}
      <Dialog open={!!creating} onOpenChange={(o) => !o && setCreating(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Add customer</DialogTitle>
            <DialogDescription>Creates an active customer directly — no OTP needed.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2"><Label>Full name *</Label><Input value={creating?.name ?? ""} onChange={(e) => setCreating((p) => p && ({ ...p, name: e.target.value }))} placeholder="Ramesh Kumar" /></div>
            <div className="space-y-1.5"><Label>Mobile *</Label><Input inputMode="numeric" value={creating?.mobile ?? ""} onChange={(e) => setCreating((p) => p && ({ ...p, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))} placeholder="10-digit" /></div>
            <div className="space-y-1.5"><Label>Password *</Label><Input type="password" autoComplete="new-password" value={creating?.password ?? ""} onChange={(e) => setCreating((p) => p && ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={creating?.email ?? ""} onChange={(e) => setCreating((p) => p && ({ ...p, email: e.target.value }))} placeholder="you@example.com" /></div>
            <div className="space-y-1.5"><Label>Pincode</Label><Input value={creating?.pincode ?? ""} onChange={(e) => setCreating((p) => p && ({ ...p, pincode: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Date of birth</Label><Input type="date" value={creating?.dob ?? ""} onChange={(e) => setCreating((p) => p && ({ ...p, dob: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Referral code</Label><Input inputMode="numeric" value={creating?.referrer_code ?? ""} onChange={(e) => setCreating((p) => p && ({ ...p, referrer_code: e.target.value.replace(/\D/g, "").slice(0, 10) }))} placeholder="Referrer's mobile" /></div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <select className={selectCls} value={creating?.state_id ?? ""} onChange={(e) => setCreating((p) => p && ({ ...p, state_id: e.target.value, district_id: "", taluk_id: "" }))}>
                <option value="">Select state</option>
                {geo.states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>District</Label>
              <select className={selectCls} disabled={!creating?.state_id} value={creating?.district_id ?? ""} onChange={(e) => setCreating((p) => p && ({ ...p, district_id: e.target.value, taluk_id: "" }))}>
                <option value="">{creating?.state_id ? "Select district" : "Pick a state first"}</option>
                {geo.districts.filter((d) => String(d.state_id) === creating?.state_id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Taluk <span className="text-muted-foreground">(optional)</span></Label>
              <select className={selectCls} disabled={!creating?.district_id} value={creating?.taluk_id ?? ""} onChange={(e) => setCreating((p) => p && ({ ...p, taluk_id: e.target.value }))}>
                <option value="">{creating?.district_id ? "Any" : "Pick a district first"}</option>
                {geo.taluks.filter((t) => String(t.district_id) === creating?.district_id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(null)} disabled={saving}>Cancel</Button>
            <GradientButton onClick={saveCreate} disabled={saving}>{saving ? "Creating…" : "Create customer"}</GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
