"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/data-table/empty-state";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/stores/auth";

type Status = "pending" | "approved" | "rejected";
type Row = {
  id: number;
  order_id: number;
  customer_id: number;
  reason: string | null;
  status: Status;
  created_at: string | null;
  total: number | string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  shop_name: string | null;
  vendor_name: string | null;
};

const PILL: Record<Status, string> = {
  pending:  "bg-amber-500/10 text-amber-500",
  approved: "bg-emerald-500/10 text-emerald-500",
  rejected: "bg-rose-500/10 text-rose-500",
};
const fmtINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export default function ReturnsPage() {
  const user = useAuth((s) => s.user);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Returns are now reviewed by the SHOP that fulfilled the order. A vendor sees
  // only their own orders' returns; admin (legacy) still sees all.
  const base = user?.role === "vendor" ? "/vendor/returns" : "/admin/returns";

  async function refresh() {
    setLoading(true);
    try {
      const res = await api.get(base);
      setRows((res.data.data?.items ?? []) as Row[]);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (user) void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.role]);

  async function decide(id: number, action: "approve" | "reject") {
    setBusy(id);
    try {
      await api.post(`${base}/${id}/${action}`);
      toast.success(action === "approve" ? "Return approved — customer notified" : "Return rejected — customer notified");
      await refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    const d = (r.created_at ?? "").slice(0, 10);            // YYYY-MM-DD of the request
    if (fromDate && d && d < fromDate) return false;
    if (toDate && d && d > toDate) return false;
    if (q) {
      const hay = `${r.order_id} ${r.customer_name ?? ""} ${r.customer_mobile ?? ""} ${r.reason ?? ""}`.toLowerCase();
      if (! hay.includes(q)) return false;
    }
    return true;
  });
  const counts: Record<string, number> = { all: filtered.length, pending: 0, approved: 0, rejected: 0 };
  for (const r of filtered) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const shown = filter === "all" ? filtered : filtered.filter((r) => r.status === filter);
  const hasFilters = !!q || !!fromDate || !!toDate || filter !== "all";

  return (
    <>
      <MobileHeader title="Returns" />
      <section className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Orders"
          icon={RotateCcw}
          title="Return Requests"
          description="Customers request returns within the return window. Approve or reject — the customer is notified either way."
        />

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #, customer, mobile…"
            className="h-9 min-w-[200px] flex-1 rounded-lg border border-border bg-surface-2/40 px-3 text-sm outline-none focus:border-brand/50"
          />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            From
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 rounded-lg border border-border bg-surface-2/40 px-2 text-sm outline-none focus:border-brand/50" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            To
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 rounded-lg border border-border bg-surface-2/40 px-2 text-sm outline-none focus:border-brand/50" />
          </label>
          {hasFilters && (
            <button type="button" onClick={() => { setSearch(""); setFromDate(""); setToDate(""); setFilter("all"); }} className="h-9 rounded-lg border border-border px-3 text-xs text-muted-foreground transition-colors hover:border-brand/40">
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {([["all", "All"], ["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={"rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors " + (filter === key ? "border-brand bg-brand/10 text-brand" : "border-border bg-surface-2/40 text-muted-foreground hover:border-brand/40")}
            >
              {label} ({counts[key]})
            </button>
          ))}
        </div>

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[1fr_1fr_90px_110px_150px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Order / customer</span><span>Reason</span><span>Status</span><span>Requested</span><span className="text-right">Actions</span>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : shown.length === 0 ? (
            <EmptyState icon={RotateCcw} title="No return requests" description={filter === "all" ? "Customer return requests will appear here for review." : `No ${filter} returns.`} />
          ) : (
            <div className="divide-y divide-border">
              {shown.map((r) => (
                <div key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 md:grid-cols-[1fr_1fr_90px_110px_150px]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">Order #{r.order_id} · {fmtINR(Number(r.total ?? 0))}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.customer_name || "—"}{r.customer_mobile ? ` · ${r.customer_mobile}` : ""}{r.shop_name ? ` · ${r.shop_name}` : ""}
                    </p>
                  </div>
                  <p className="hidden truncate text-xs text-muted-foreground md:block">{r.reason || "—"}</p>
                  <div className="hidden md:block">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${PILL[r.status]}`}>{r.status}</span>
                  </div>
                  <span className="hidden text-xs text-muted-foreground md:block">{(r.created_at ?? "").replace("T", " ").slice(0, 16) || "—"}</span>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <span className={`md:hidden inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${PILL[r.status]}`}>{r.status}</span>
                    {r.status === "pending" && (
                      <>
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-emerald-500" disabled={busy === r.id} onClick={() => void decide(r.id, "approve")}>
                          {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-rose-500" disabled={busy === r.id} onClick={() => void decide(r.id, "reject")}>
                          <X className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
