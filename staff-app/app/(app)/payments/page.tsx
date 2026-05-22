"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, Search, Check, X, Hourglass, MoreHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/data-table/status-badge";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { Pagination } from "@/components/data-table/pagination";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { mock, type ManualPayment } from "@/lib/mock";

const PAGE_SIZE = 10;
const fmtINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default function AdminPaymentsPage() {
  const [items, setItems] = useState<ManualPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | ManualPayment["status"]>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    void (async () => {
      setItems(await mock.manualPayments());
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => items.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      if (!p.user_name.toLowerCase().includes(q) && !p.txn_id.toLowerCase().includes(q) && !p.user_mobile.includes(q)) return false;
    }
    if (status !== "all" && p.status !== status) return false;
    return true;
  }), [items, search, status]);

  useEffect(() => setPage(1), [search, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pending = items.filter((p) => p.status === "pending");
  const pendingValue = pending.reduce((s, p) => s + p.amount, 0);
  const approvedValue = items.filter((p) => p.status === "approved").reduce((s, p) => s + p.amount, 0);

  function process(id: number, action: "approve" | "reject") {
    setItems((cur) => cur.map((p) => (p.id === id ? { ...p, status: action === "approve" ? "approved" : "rejected" } : p)));
    toast.success(`#${id} ${action}d`);
  }

  return (
    <>
      <MobileHeader title="Manual top-ups" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Finance"
          icon={CreditCard}
          title="Manual top-ups"
          description="Customer-uploaded payment proofs. Approve to credit their wallet."
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total requests"   value={items.length}     icon={CreditCard} tone="brand"   spark={[1, 2, 2, 2, 2, 2, 2, 2]} />
          <StatCard label="Pending"          value={pending.length}   icon={Hourglass}  tone="amber"   spark={[1, 2, 1, 2, 1, 2, 1, 1]} />
          <StatCard label="Pending value"    value={pendingValue}     icon={CreditCard} tone="pink"    spark={[2, 3, 3, 3, 4, 4, 4, 4]} format={fmtINR} />
          <StatCard label="Approved value"   value={approvedValue}    icon={Check}      tone="emerald" spark={[1, 2, 3, 3, 4, 5, 5, 6]} format={fmtINR} />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search user, mobile, txn id…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
            </div>
            <Select value={status} onValueChange={(v) => v && setStatus(v as "all" | ManualPayment["status"])}>
              <SelectTrigger className="h-10 rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[1.2fr_140px_160px_120px_180px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Customer</span>
            <span>Amount</span>
            <span>Txn id</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          {loading ? (
            <div className="p-3"><TableSkeleton rows={5} cols={5} /></div>
          ) : paged.length === 0 ? (
            <EmptyState icon={CreditCard} title="No payments match your filters" />
          ) : (
            <div className="divide-y divide-border">
              {paged.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[1.2fr_140px_160px_120px_180px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-xs font-semibold text-brand">
                      {p.user_name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{p.user_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.user_mobile} · {p.created_at}</p>
                    </div>
                  </div>
                  <p className="hidden text-sm font-medium text-emerald-400 md:block">{fmtINR(p.amount)}</p>
                  <p className="hidden font-mono text-xs text-muted-foreground md:block truncate">{p.txn_id}</p>
                  <div className="hidden md:block"><StatusBadge status={p.status} /></div>
                  <div className="flex items-center gap-2 justify-self-end">
                    <span className="md:hidden"><StatusBadge status={p.status} /></span>
                    {p.status === "pending" ? (
                      <div className="hidden gap-1 md:flex">
                        <Button size="sm" className="h-8 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" onClick={() => process(p.id, "approve")}>
                          <Check className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-rose-400 hover:bg-rose-500/10" onClick={() => process(p.id, "reject")}>
                          <X className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    ) : <span className="hidden text-xs text-muted-foreground md:block">—</span>}
                    {p.status === "pending" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button type="button" aria-label="Row actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent md:hidden">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => process(p.id, "approve")}><Check className="h-4 w-4" /> Approve</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => process(p.id, "reject")} className="text-rose-400 focus:text-rose-400"><X className="h-4 w-4" /> Reject</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
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
    </>
  );
}
