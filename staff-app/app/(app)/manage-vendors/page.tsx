"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Store, Search, Plus, MoreHorizontal, Pencil, KeyRound, Copy, Trash2, ChevronDown } from "lucide-react";
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/data-table/status-badge";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { Pagination } from "@/components/data-table/pagination";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { cleanMobile, isMobile } from "@/lib/phone";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage, fileUrl } from "@/lib/api";
import type { ManagedVendor } from "@/lib/mock";

const PAGE_SIZE = 10;
const fmtINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const fmtDate = (s: string | null) => (s ? new Date(s.replace(" ", "T")).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const kycPill = (s: string | null) =>
  s === "verified" ? "bg-emerald-500/10 text-emerald-500"
  : s === "pending" ? "bg-amber-500/10 text-amber-500"
  : s === "rejected" ? "bg-rose-500/10 text-rose-500"
  : "bg-surface-2 text-muted-foreground";

type NewVendor = { name: string; mobile: string; shop_name: string; password: string; vendor_category_id: string; commission_pct: string };
type EditVendor = { id: number; name: string; shop_name: string; vendor_category_id: string; commission_pct: string };
type ResetPw = { id: number; shop_name: string; password: string };
type VendorCategoryOption = { id: number; name: string };
type VendorTemplate = { id: number; name: string; vendor_category_id: number | null; commission_pct: number };
type BankInfo = { account_holder: string | null; account_number: string | null; ifsc_code: string | null; bank_name: string | null; upi: string | null };
type Vendor = ManagedVendor & {
  vendor_category_id: number | null;
  commission_pct: number;
  address: string | null;
  area: string | null;
  pincode: string | null;
  bank: BankInfo;
};
type VendorDetail = {
  id: number; name: string; mobile: string; email: string | null; status: string; created_at: string | null;
  shop_name: string | null; category_name: string | null; commission_pct: number | null; gst: string | null;
  address: string | null; area: string | null; pincode: string | null;
  state_name: string | null; district_name: string | null; taluk_name: string | null;
  products_count: number; orders_count: number; total_sales: number;
  account_holder: string | null; bank_name: string | null; account_number: string | null; ifsc_code: string | null; upi: string | null;
  aadhar: string | null; aadhar_image: string | null; pan: string | null; pan_image: string | null; bank_passbook: string | null;
  kyc_status: string | null; kyc_note: string | null;
};

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
  const str = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));
  const bankRaw = (r.bank ?? {}) as Record<string, unknown>;
  return {
    id: Number(r.id ?? 0),
    name: (r.name as string | undefined) || "",
    mobile: (r.mobile_number as string | undefined) || "",
    shop_name: shopName,
    taluk,
    status,
    vendor_category_id,
    commission_pct,
    address: str(profile?.address),
    area: str(profile?.area),
    pincode: str(profile?.pincode),
    bank: {
      account_holder: str(bankRaw.account_holder),
      account_number: str(bankRaw.account_number),
      ifsc_code: str(bankRaw.ifsc_code),
      bank_name: str(bankRaw.bank_name),
      upi: str(bankRaw.upi),
    },
  };
}

export default function ManageVendorsPage() {
  const [items, setItems] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive" | "blocked">("all");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null); // expanded bank/address row
  const [viewing, setViewing] = useState<Vendor | null>(null);
  const [detail, setDetail] = useState<VendorDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adding, setAdding] = useState<NewVendor | null>(null);
  const [editing, setEditing] = useState<EditVendor | null>(null);
  const [resetting, setResetting] = useState<ResetPw | null>(null);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<VendorCategoryOption[]>([]);
  const [templates, setTemplates] = useState<VendorTemplate[]>([]);
  const [tplOpen, setTplOpen] = useState(false);
  const [newTpl, setNewTpl] = useState({ name: "", vendor_category_id: "", commission_pct: "10" });
  const [tplSaving, setTplSaving] = useState(false);

  const loadVendors = useCallback(async () => {
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
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await api.get("/vendor-templates");
      const raw = (res.data?.data?.items ?? []) as Array<Record<string, unknown>>;
      setTemplates(raw.map((r) => ({
        id: Number(r.id ?? 0),
        name: String(r.name ?? ""),
        vendor_category_id: r.vendor_category_id != null ? Number(r.vendor_category_id) : null,
        commission_pct: Number(r.commission_pct ?? 0) || 0,
      })));
    } catch {
      // optional — non-blocking
    }
  }, []);

  useEffect(() => {
    void loadVendors();
    void loadTemplates();
    void (async () => {
      try {
        const res = await api.get("/vendor-categories");
        const raw = (res.data?.data?.items ?? []) as Array<Record<string, unknown>>;
        setCategories(raw.map((r) => ({ id: Number(r.id ?? 0), name: String(r.name ?? "") })).filter((c) => c.id > 0 && c.name));
      } catch (err) {
        toast.error(apiErrorMessage(err, "Could not load vendor categories"));
      }
    })();
  }, [loadVendors, loadTemplates]);

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
    if (!isMobile(adding.mobile)) { toast.error("Enter a valid 10-digit mobile number"); return; }
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
      await api.post("/vendors", {
        name: adding.name,
        mobile_number: adding.mobile,
        password: adding.password,
        shop_name: adding.shop_name,
        vendor_category_id: Number(adding.vendor_category_id),
        commission_pct: commissionPct,
      });
      toast.success("Vendor created");
      setAdding(null);
      // Re-fetch so the new row shows its server-stamped taluk (the form doesn't ask for one).
      void loadVendors();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not create vendor"));
    } finally {
      setSaving(false);
    }
  }

  async function openProfile(v: Vendor) {
    setViewing(v);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await api.get(`/vendors/${v.id}`);
      const d = res.data.data as Record<string, unknown>;
      const num = (x: unknown) => Number(x ?? 0);
      const str = (x: unknown) => (x === null || x === undefined || x === "" ? null : String(x));
      setDetail({
        id: num(d.id), name: String(d.name ?? ""), mobile: String(d.mobile_number ?? ""), email: str(d.email), status: String(d.status ?? ""), created_at: str(d.created_at),
        shop_name: str(d.shop_name), category_name: str(d.category_name), commission_pct: d.commission_pct == null ? null : num(d.commission_pct), gst: str(d.gst),
        address: str(d.address), area: str(d.area), pincode: str(d.pincode),
        state_name: str(d.state_name), district_name: str(d.district_name), taluk_name: str(d.taluk_name),
        products_count: num(d.products_count), orders_count: num(d.orders_count), total_sales: num(d.total_sales),
        account_holder: str(d.account_holder), bank_name: str(d.bank_name), account_number: str(d.account_number), ifsc_code: str(d.ifsc_code), upi: str(d.upi),
        aadhar: str(d.aadhar), aadhar_image: str(d.aadhar_image), pan: str(d.pan), pan_image: str(d.pan_image), bank_passbook: str(d.bank_passbook),
        kyc_status: str(d.kyc_status), kyc_note: str(d.kyc_note),
      });
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load vendor profile"));
    } finally {
      setDetailLoading(false);
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

  async function saveTemplate() {
    if (!newTpl.name || !newTpl.vendor_category_id) { toast.error("Name and category required"); return; }
    const pct = newTpl.commission_pct === "" ? 10 : Number(newTpl.commission_pct);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) { toast.error("Commission must be 0–100"); return; }
    setTplSaving(true);
    try {
      await api.post("/vendor-templates", { name: newTpl.name, vendor_category_id: Number(newTpl.vendor_category_id), commission_pct: pct });
      toast.success("Template saved");
      setNewTpl({ name: "", vendor_category_id: "", commission_pct: "10" });
      void loadTemplates();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save template"));
    } finally {
      setTplSaving(false);
    }
  }

  async function deleteTemplate(id: number) {
    try {
      await api.delete(`/vendor-templates/${id}`);
      setTemplates((cur) => cur.filter((t) => t.id !== id));
      toast.success("Template deleted");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete template"));
    }
  }

  function applyTemplate(tplId: string) {
    const t = templates.find((x) => String(x.id) === tplId);
    if (!t) return;
    setAdding((p) => p && ({
      ...p,
      vendor_category_id: t.vendor_category_id ? String(t.vendor_category_id) : "",
      commission_pct: String(t.commission_pct ?? 10),
    }));
    toast.success(`Applied “${t.name}”`);
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
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setTplOpen(true)}>
                <Copy className="h-4 w-4" /> Templates
              </Button>
              <GradientButton onClick={() => setAdding({ name: "", mobile: "", shop_name: "", password: "", vendor_category_id: "", commission_pct: "10" })}>
                <Plus className="h-4 w-4" /> New vendor
              </GradientButton>
            </div>
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
                >
                  <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[1.4fr_1fr_140px_90px_120px_56px]">
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenId((cur) => (cur === v.id ? null : v.id))}
                        aria-label={openId === v.id ? "Hide bank & address" : "Show bank & address"}
                        aria-expanded={openId === v.id}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${openId === v.id ? "rotate-180" : ""}`} />
                      </button>
                      <button type="button" onClick={() => void openProfile(v)} className="group flex min-w-0 items-center gap-2 text-left">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-xs font-semibold text-brand">
                          {(v.shop_name || v.name || "?").charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold underline-offset-2 group-hover:text-brand group-hover:underline">{v.shop_name || "—"}</p>
                          <p className="truncate text-xs text-muted-foreground">{v.name}</p>
                        </div>
                      </button>
                    </div>
                    <p className="hidden min-w-0 truncate text-sm text-muted-foreground md:block">{v.taluk || "—"}</p>
                    <p className="hidden min-w-0 truncate text-sm text-muted-foreground md:block">{v.mobile}</p>
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
                  </div>

                  {openId === v.id && (
                    <div className="border-t border-border bg-surface-2/30 px-4 py-3 md:pl-[3.75rem]">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bank details</p>
                          {(v.bank.account_holder || v.bank.account_number || v.bank.ifsc_code || v.bank.bank_name || v.bank.upi) ? (
                            <div className="mt-1.5 space-y-0.5 text-xs">
                              {v.bank.account_holder && <p><span className="text-muted-foreground">Holder:</span> <span className="font-medium">{v.bank.account_holder}</span></p>}
                              {v.bank.account_number && <p><span className="text-muted-foreground">A/C No:</span> <span className="font-medium font-mono">{v.bank.account_number}</span></p>}
                              {v.bank.ifsc_code && <p><span className="text-muted-foreground">IFSC:</span> <span className="font-medium font-mono">{v.bank.ifsc_code}</span></p>}
                              {v.bank.bank_name && <p><span className="text-muted-foreground">Bank:</span> <span className="font-medium">{v.bank.bank_name}</span></p>}
                              {v.bank.upi && <p><span className="text-muted-foreground">UPI:</span> <span className="font-medium">{v.bank.upi}</span></p>}
                            </div>
                          ) : (
                            <p className="mt-1.5 text-xs text-muted-foreground">No bank details on file</p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Address</p>
                          {(v.address || v.area || v.pincode) ? (
                            <p className="mt-1.5 text-xs">{[v.address, v.area, v.pincode].filter(Boolean).join(", ")}</p>
                          ) : (
                            <p className="mt-1.5 text-xs text-muted-foreground">No address on file</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
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

      {/* Vendor profile */}
      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) { setViewing(null); setDetail(null); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-border bg-popover sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="truncate">{viewing?.shop_name || viewing?.name || "Vendor"}</span>
              {viewing && <StatusBadge status={viewing.status} />}
            </DialogTitle>
            <DialogDescription>#{viewing?.id} · Vendor profile</DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading profile…</div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field label="Owner" value={detail.name} />
                <Field label="Mobile" value={detail.mobile} />
                <Field label="Email" value={detail.email} />
                <Field label="Joined" value={fmtDate(detail.created_at)} />
                <Field label="Category" value={detail.category_name} />
                <Field label="Commission" value={detail.commission_pct == null ? null : `${detail.commission_pct.toFixed(2)}%`} />
                <Field label="GST" value={detail.gst} />
                <Field label="Total products" value={String(detail.products_count)} />
                <Field label="Total orders" value={String(detail.orders_count)} />
                <Field label="Sales (delivered)" value={fmtINR(detail.total_sales)} />
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <Field label="Address" value={detail.address} />
                  <Field label="Area" value={detail.area} />
                  <Field label="Taluk" value={detail.taluk_name} />
                  <Field label="District" value={detail.district_name} />
                  <Field label="State" value={detail.state_name} />
                  <Field label="Pincode" value={detail.pincode} />
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bank details</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <Field label="Account holder" value={detail.account_holder} />
                  <Field label="Bank name" value={detail.bank_name} />
                  <Field label="Account number" value={detail.account_number} />
                  <Field label="IFSC" value={detail.ifsc_code} />
                  <Field label="UPI" value={detail.upi} />
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">KYC documents</p>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${kycPill(detail.kyc_status)}`}>
                    {detail.kyc_status || "none"}
                  </span>
                </div>
                {detail.kyc_note && <p className="text-xs text-muted-foreground">Note: {detail.kyc_note}</p>}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <Field label="Aadhaar no." value={detail.aadhar} />
                  <Field label="PAN no." value={detail.pan} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <DocImage label="Aadhaar image" url={fileUrl(detail.aadhar_image)} />
                  <DocImage label="PAN image" url={fileUrl(detail.pan_image)} />
                  <DocImage label="Bank passbook" url={fileUrl(detail.bank_passbook)} />
                </div>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">Could not load profile.</div>
          )}
          <DialogFooter className="gap-2 sm:justify-start">
            {viewing && (
              <>
                <Button variant="ghost" onClick={() => { const v = viewing; setViewing(null); setDetail(null); startEdit(v); }}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button variant="ghost" onClick={() => { const v = viewing; setViewing(null); setDetail(null); setResetting({ id: v.id, shop_name: v.shop_name, password: "" }); }}>
                  <KeyRound className="h-4 w-4" /> Reset password
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)}>
        <DialogContent className="rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>New vendor</DialogTitle>
            <DialogDescription>Onboard a shop owner under your taluk.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {templates.length > 0 && (
              <div className="space-y-1.5">
                <Label>Use template <span className="text-muted-foreground">(optional)</span></Label>
                <Combobox
                  value=""
                  onValueChange={(v) => v && applyTemplate(v)}
                  options={templates.map((t) => ({ value: String(t.id), label: t.name }))}
                  placeholder="Pre-fill category + commission from a saved template"
                  searchPlaceholder="Search template…"
                  emptyText="No template found."
                  className="h-10 rounded-xl bg-surface-2/60"
                />
              </div>
            )}
            <div className="space-y-1.5"><Label>Owner name</Label><Input value={adding?.name ?? ""} onChange={(e) => setAdding((p) => p && ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Mobile</Label><Input inputMode="numeric" maxLength={10} value={adding?.mobile ?? ""} onChange={(e) => setAdding((p) => p && ({ ...p, mobile: cleanMobile(e.target.value) }))} /></div>
            <div className="space-y-1.5"><Label>Shop name</Label><Input value={adding?.shop_name ?? ""} onChange={(e) => setAdding((p) => p && ({ ...p, shop_name: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Vendor category</Label>
              <Combobox
                value={adding?.vendor_category_id ?? ""}
                onValueChange={(v) => v && setAdding((p) => p && ({ ...p, vendor_category_id: v }))}
                options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                placeholder={categories.length ? "Choose a category" : "Loading…"}
                searchPlaceholder="Search category…"
                emptyText="No category found."
                className="h-10 rounded-xl bg-surface-2/60"
              />
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
              <Combobox
                value={editing?.vendor_category_id ?? ""}
                onValueChange={(v) => v && setEditing((p) => p && ({ ...p, vendor_category_id: v }))}
                options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                placeholder={categories.length ? "Choose a category" : "Loading…"}
                searchPlaceholder="Search category…"
                emptyText="No category found."
                className="h-10 rounded-xl bg-surface-2/60"
              />
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

      <Dialog open={tplOpen} onOpenChange={setTplOpen}>
        <DialogContent className="rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Vendor templates</DialogTitle>
            <DialogDescription>Save category + commission presets to re-use when creating vendors.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border border-border p-3">
              <div className="space-y-1.5"><Label>Template name</Label><Input value={newTpl.name} onChange={(e) => setNewTpl((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Grocery · 10%" /></div>
              <div className="space-y-1.5">
                <Label>Vendor category</Label>
                <Combobox
                  value={newTpl.vendor_category_id}
                  onValueChange={(v) => v && setNewTpl((p) => ({ ...p, vendor_category_id: v }))}
                  options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                  placeholder={categories.length ? "Choose a category" : "Loading…"}
                  searchPlaceholder="Search category…"
                  emptyText="No category found."
                  className="h-10 rounded-xl bg-surface-2/60"
                />
              </div>
              <div className="space-y-1.5"><Label>Commission %</Label><Input type="number" step="0.01" min={0} max={100} value={newTpl.commission_pct} onChange={(e) => setNewTpl((p) => ({ ...p, commission_pct: e.target.value }))} placeholder="10" /></div>
              <GradientButton onClick={saveTemplate} disabled={tplSaving}>{tplSaving ? "Saving…" : "Save template"}</GradientButton>
            </div>
            <div className="space-y-2">
              {templates.length === 0 ? (
                <p className="py-2 text-center text-sm text-muted-foreground">No templates yet.</p>
              ) : templates.map((t) => {
                const catName = categories.find((c) => c.id === t.vendor_category_id)?.name ?? "—";
                return (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{catName} · {t.commission_pct.toFixed(2)}%</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Delete template"
                      onClick={() => void deleteTemplate(t.id)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTplOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

// KYC document thumbnail → opens the full image in a new tab.
function DocImage({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="h-24 w-full rounded-lg border border-border object-cover transition hover:opacity-90" />
        </a>
      ) : (
        <div className="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-border text-[11px] text-muted-foreground">No image</div>
      )}
    </div>
  );
}

