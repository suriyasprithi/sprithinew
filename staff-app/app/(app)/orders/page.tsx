"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, Search, Hourglass, Check, Banknote } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/data-table/status-badge";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { Pagination } from "@/components/data-table/pagination";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { mock, type VendorOrder } from "@/lib/mock";

const PAGE_SIZE = 10;
const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const NEXT: Record<VendorOrder["status"], VendorOrder["status"] | null> = {
  pending: "paid", paid: "shipped", shipped: "delivered", delivered: null, cancelled: null,
};

export default function StaffOrdersPage() {
  const [items, setItems] = useState<VendorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | VendorOrder["status"]>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/orders/list");
        type ApiRow = {
          id: number | string;
          customer_name?: string | null;
          total: number | string;
          status: VendorOrder["status"];
          item_count?: number | string;
          created_at?: string | null;
        };
        const rows = ((res.data.data?.items ?? []) as ApiRow[]).map((r): VendorOrder => ({
          id: Number(r.id),
          customer_name: r.customer_name ?? "—",
          total: Number(r.total) || 0,
          status: r.status,
          item_count: Number(r.item_count ?? 0),
          created_at: (r.created_at ?? "").slice(0, 16),
        }));
        setItems(rows);
      } catch (e) {
        toast.error(apiErrorMessage(e));
        setItems(await mock.vendorOrders());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => items.filter((o) => {
    if (search) {
      const q = search.toLowerCase();
      if (!String(o.id).includes(q) && !o.customer_name.toLowerCase().includes(q)) return false;
    }
    if (status !== "all" && o.status !== status) return false;
    return true;
  }), [items, search, status]);

  useEffect(() => setPage(1), [search, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pending = items.filter((o) => o.status === "pending" || o.status === "paid");
  const delivered = items.filter((o) => o.status === "delivered");
  const totalRevenue = items.reduce((s, o) => s + o.total, 0);

  async function advance(o: VendorOrder) {
    const next = NEXT[o.status];
    if (!next) return;
    try {
      await api.patch(`/orders/${o.id}/status`, { status: next });
      setItems((cur) => cur.map((x) => (x.id === o.id ? { ...x, status: next } : x)));
      toast.success(`Order #${o.id} → ${next}`);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  return (
    <>
      <MobileHeader title="Orders" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 pb-24 md:p-8">
        <PageHeader
          eyebrow="Operations"
          icon={ShoppingBag}
          title="Orders"
          description="Fulfil your incoming orders — mark them shipped / delivered as you progress."
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total orders"  value={items.length}    icon={ShoppingBag} tone="brand"   spark={[2, 3, 3, 3, 4, 4, 5, 5]} />
          <StatCard label="Pending"       value={pending.length}  icon={Hourglass}   tone="amber"   spark={[1, 1, 2, 1, 2, 2, 1, 1]} />
          <StatCard label="Delivered"     value={delivered.length}icon={Check}       tone="emerald" spark={[1, 1, 1, 2, 2, 3, 3, 4]} />
          <StatCard label="Total revenue" value={totalRevenue}    icon={Banknote}    tone="violet"  spark={[3, 4, 4, 5, 6, 7, 7, 8]} format={fmtINR} />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order id, customer…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
            </div>
            <Select value={status} onValueChange={(v) => v && setStatus(v as "all" | VendorOrder["status"])}>
              <SelectTrigger className="h-10 rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[120px_1.4fr_140px_120px_180px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Order</span>
            <span>Customer</span>
            <span>Amount</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          {loading ? (
            <div className="p-3"><TableSkeleton rows={5} cols={5} /></div>
          ) : paged.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="No orders match your filters" />
          ) : (
            <div className="divide-y divide-border">
              {paged.map((o, i) => (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[120px_1.4fr_140px_120px_180px]"
                >
                  <p className="hidden font-mono text-xs text-muted-foreground md:block">#{o.id}</p>
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <ShoppingBag className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        <span className="md:hidden">Order #{o.id} · </span>
                        {o.customer_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{o.item_count} items · {o.created_at}</p>
                    </div>
                  </div>
                  <p className="hidden text-sm font-bold text-brand md:block">{fmtINR(o.total)}</p>
                  <div className="hidden md:block"><StatusBadge status={o.status} /></div>
                  <div className="flex items-center gap-2 justify-self-end">
                    <p className="text-sm font-bold text-brand md:hidden">{fmtINR(o.total)}</p>
                    <span className="md:hidden"><StatusBadge status={o.status} /></span>
                    {NEXT[o.status] && (
                      <GradientButton size="sm" onClick={() => advance(o)}>
                        Mark {NEXT[o.status]}
                      </GradientButton>
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
