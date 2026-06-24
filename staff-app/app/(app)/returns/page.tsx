"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/data-table/empty-state";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";

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
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const res = await api.get("/admin/returns");
      setRows((res.data.data?.items ?? []) as Row[]);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void refresh(); }, []);

  async function decide(id: number, action: "approve" | "reject") {
    setBusy(id);
    try {
      await api.post(`/admin/returns/${id}/${action}`);
      toast.success(action === "approve" ? "Return approved — customer notified" : "Return rejected — customer notified");
      await refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

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
        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[1fr_1fr_90px_110px_150px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Order / customer</span><span>Reason</span><span>Status</span><span>Requested</span><span className="text-right">Actions</span>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={RotateCcw} title="No return requests" description="Customer return requests will appear here for review." />
          ) : (
            <div className="divide-y divide-border">
              {rows.map((r) => (
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
