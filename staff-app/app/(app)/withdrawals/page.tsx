"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, Search, Check, X, Hourglass, MoreHorizontal, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/data-table/status-badge";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { Pagination } from "@/components/data-table/pagination";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { mock, type AdminWithdrawal } from "@/lib/mock";

const PAGE_SIZE = 10;
const fmtINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

type PayoutDetails = Record<string, string>;
type Row = AdminWithdrawal & { details: PayoutDetails; role: string | null; address: string | null };

function parseDetails(raw: unknown): PayoutDetails {
  if (!raw) return {};
  if (typeof raw === "object") return raw as PayoutDetails;
  try { return JSON.parse(String(raw)) as PayoutDetails; } catch { return {}; }
}

export default function AdminWithdrawalsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | AdminWithdrawal["status"]>("all");
  const [method, setMethod] = useState<"all" | "bank" | "upi">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "customer" | "vendor" | "taluk" | "district" | "state">("all");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState<Row | null>(null);
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      type ApiRow = {
        id: number | string;
        amount: number | string;
        method: string;
        status: string;
        created_at?: string | null;
        details_json?: unknown;
        user?: { name?: string | null; mobile_number?: string | null; role?: string | null; address?: string | null } | null;
      };
      const res = await api.get("/admin/withdrawals/pending");
      const rows = ((res.data.data?.items ?? []) as ApiRow[]).map((r): Row => ({
        id: Number(r.id),
        user_name: r.user?.name || "—",
        mobile: r.user?.mobile_number || "",
        amount: Number(r.amount) || 0,
        method: r.method === "upi" ? "upi" : "bank",
        // backend marks an approved payout 'paid'
        status: r.status === "paid" ? "approved" : r.status === "rejected" ? "rejected" : "pending",
        created_at: (r.created_at ?? "").replace("T", " ").slice(0, 16),
        details: parseDetails(r.details_json),
        role: r.user?.role ?? null,
        address: r.user?.address ?? null,
      }));
      setItems(rows);
    } catch (e) {
      toast.error(apiErrorMessage(e));
      setItems((await mock.adminWithdrawals()).map((w) => ({ ...w, details: {} })));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void refresh(); }, []);

  const filtered = useMemo(() => items.filter((w) => {
    if (search) {
      const q = search.toLowerCase();
      if (!w.user_name.toLowerCase().includes(q) && !w.mobile.includes(q)) return false;
    }
    if (status !== "all" && w.status !== status) return false;
    if (method !== "all" && w.method !== method) return false;
    if (typeFilter !== "all" && w.role !== typeFilter) return false;
    return true;
  }), [items, search, status, method, typeFilter]);

  useEffect(() => setPage(1), [search, status, method, typeFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pending = items.filter((w) => w.status === "pending");
  const pendingValue = pending.reduce((s, w) => s + w.amount, 0);
  const approvedValue = items.filter((w) => w.status === "approved").reduce((s, w) => s + w.amount, 0);

  async function process(id: number, action: "approve" | "reject") {
    setBusyId(id);
    try {
      await api.post(`/admin/withdrawals/${id}/${action}`);
      toast.success(`#${id} ${action}d`);
      await refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  // Reject needs a reason the user will see (in their notification + withdrawal
  // history), so it goes through a dialog instead of an instant action.
  async function confirmReject() {
    if (!rejecting) return;
    const id = rejecting.id;
    setBusyId(id);
    try {
      await api.post(`/admin/withdrawals/${id}/reject`, { notes: rejectNote.trim() });
      toast.success(`#${id} rejected`);
      setRejecting(null);
      setRejectNote("");
      await refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <MobileHeader title="Withdrawals" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Finance"
          icon={Banknote}
          title="Withdrawal requests"
          description="Approve payouts to user bank accounts and UPI IDs."
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total requests" value={items.length}   icon={Banknote}  tone="brand"   spark={[1, 2, 2, 2, 2, 2, 2, 2]} />
          <StatCard label="Pending"        value={pending.length} icon={Hourglass} tone="amber"   spark={[1, 1, 1, 1, 1, 1, 1, 1]} />
          <StatCard label="Pending value"  value={pendingValue}   icon={Banknote}  tone="pink"    spark={[2, 2, 2, 2, 3, 3, 3, 3]} format={fmtINR} />
          <StatCard label="Paid out"       value={approvedValue}  icon={Check}     tone="emerald" spark={[1, 2, 3, 3, 4, 5, 5, 6]} format={fmtINR} />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_150px_150px_150px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search user, mobile…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
            </div>
            <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger className="h-10 rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any type</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
                <SelectItem value="taluk">Taluk</SelectItem>
                <SelectItem value="district">District</SelectItem>
                <SelectItem value="state">State</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => v && setStatus(v as "all" | AdminWithdrawal["status"])}>
              <SelectTrigger className="h-10 rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={method} onValueChange={(v) => v && setMethod(v as "all" | "bank" | "upi")}>
              <SelectTrigger className="h-10 rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any method</SelectItem>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[1.1fr_90px_110px_80px_110px_1.1fr_150px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>User</span>
            <span>Type</span>
            <span>Amount</span>
            <span>Method</span>
            <span>Status</span>
            <span>Address</span>
            <span className="text-right">Actions</span>
          </div>
          {loading ? (
            <div className="p-3"><TableSkeleton rows={5} cols={5} /></div>
          ) : paged.length === 0 ? (
            <EmptyState icon={Banknote} title="No withdrawals match your filters" />
          ) : (
            <div className="divide-y divide-border">
              {paged.map((w, i) => (
                <motion.div
                  key={w.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[1.1fr_90px_110px_80px_110px_1.1fr_150px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-xs font-semibold text-brand">
                      {w.user_name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{w.user_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{w.mobile} · {w.created_at}</p>
                      <p className="truncate text-[11px] capitalize text-brand md:hidden">{w.role ?? "—"}{w.address ? ` · ${w.address}` : ""}</p>
                    </div>
                  </div>
                  <span className="hidden md:flex"><span className="inline-flex items-center rounded-md bg-brand/10 px-2 py-0.5 text-[11px] font-semibold capitalize text-brand">{w.role ?? "—"}</span></span>
                  <p className="hidden text-sm font-medium text-emerald-400 md:block">{fmtINR(w.amount)}</p>
                  <p className="hidden text-xs uppercase text-muted-foreground md:block">{w.method}</p>
                  <div className="hidden md:block"><StatusBadge status={w.status} /></div>
                  <p className="hidden truncate text-xs text-muted-foreground md:block" title={w.address ?? ""}>{w.address ?? "—"}</p>
                  <div className="flex items-center gap-2 justify-self-end">
                    <span className="md:hidden"><StatusBadge status={w.status} /></span>
                    {/* Preview payout (bank/UPI) details — every row, every status */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="hidden h-8 w-8 text-muted-foreground hover:text-brand md:inline-flex"
                      onClick={() => setPreviewing(w)}
                      aria-label="View payout details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {w.status === "pending" ? (
                      <div className="hidden gap-1 md:flex">
                        <Button size="sm" className="h-8 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" disabled={busyId === w.id} onClick={() => void process(w.id, "approve")}>
                          <Check className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-rose-400 hover:bg-rose-500/10" disabled={busyId === w.id} onClick={() => { setRejectNote(""); setRejecting(w); }}>
                          <X className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    ) : <span className="hidden text-xs text-muted-foreground md:block">—</span>}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button type="button" aria-label="Row actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent md:hidden">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setPreviewing(w)}><Eye className="h-4 w-4" /> View payout details</DropdownMenuItem>
                        {w.status === "pending" && (
                          <>
                            <DropdownMenuItem onClick={() => void process(w.id, "approve")}><Check className="h-4 w-4" /> Approve</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setRejectNote(""); setRejecting(w); }} className="text-rose-400 focus:text-rose-400"><X className="h-4 w-4" /> Reject</DropdownMenuItem>
                          </>
                        )}
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

      <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Payout details</DialogTitle>
            <DialogDescription>
              {previewing?.user_name}{previewing?.mobile ? ` · ${previewing.mobile}` : ""}
            </DialogDescription>
          </DialogHeader>
          {previewing && (
            <div className="divide-y divide-border rounded-xl border border-border">
              <DetailRow label="Amount" value={fmtINR(previewing.amount)} />
              <DetailRow label="Method" value={previewing.method.toUpperCase()} />
              {previewing.method === "upi" ? (
                <DetailRow label="UPI ID" value={previewing.details.upi} mono />
              ) : (
                <>
                  <DetailRow label="Account holder" value={previewing.details.account_holder} />
                  <DetailRow label="Bank name"      value={previewing.details.bank_name} />
                  <DetailRow label="Account number" value={previewing.details.account_number} mono />
                  <DetailRow label="IFSC"           value={previewing.details.ifsc} mono />
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejecting} onOpenChange={(o) => { if (!o) { setRejecting(null); setRejectNote(""); } }}>
        <DialogContent className="rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Reject withdrawal</DialogTitle>
            <DialogDescription>
              {rejecting?.user_name}{rejecting?.mobile ? ` · ${rejecting.mobile}` : ""}{rejecting ? ` — ${fmtINR(rejecting.amount)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium">Reason <span className="font-normal text-muted-foreground">(shown to the user)</span></p>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              placeholder="e.g. Bank details don't match your KYC. Please update and re-request."
              className="w-full rounded-xl border border-border bg-surface-2/60 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setRejecting(null); setRejectNote(""); }}>Cancel</Button>
            <Button
              className="bg-rose-500 text-white hover:bg-rose-600"
              disabled={busyId === rejecting?.id || !rejectNote.trim()}
              onClick={() => void confirmReject()}
            >
              <X className="h-4 w-4" /> Reject
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DetailRow({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${mono ? "font-mono" : ""} ${value ? "" : "text-muted-foreground"}`}>{value || "Not set"}</span>
    </div>
  );
}
