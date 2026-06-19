"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, Search, Hourglass, Check, Banknote, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { Pagination } from "@/components/data-table/pagination";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { ProductImage } from "@/components/ui/custom/product-image";
import { api, apiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { mock, type VendorOrder } from "@/lib/mock";

type OrderItem = {
  id: number;
  name: string | null;
  display_name?: string | null;
  variant_name?: string | null;
  product_image?: string | null;
  qty: number;
  price: number | string;
  subtotal: number | string;
};

// Order row + the per-order delivery driver assignment.
type OrderRow = VendorOrder & { driver_id: number | null; driver_name: string | null };
// Driver available to deliver in this vendor's area. `busy` = already on another
// active order, so it's hidden from every order's dropdown until that frees up.
type DriverOpt = { id: number; name: string; busy: boolean };

const PAGE_SIZE = 10;
const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

// Statuses a vendor can set (the backend accepts exactly these).
const SETTABLE = ["pending", "paid", "shipped", "delivered", "cancelled"] as const;
// Display labels for every status — includes the legacy import values
// (assigned/picked) so an order already in one of those still shows a clean
// label in the trigger, even though they're not selectable.
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", assigned: "Assigned", picked: "Picked",
  paid: "Paid", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled",
};
const STATUS_ITEMS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

export default function StaffOrdersPage() {
  const [items, setItems] = useState<OrderRow[]>([]);
  const [drivers, setDrivers] = useState<DriverOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Includes legacy-import statuses (assigned/picked) that live alongside the
  // app's own pending/paid/shipped/delivered so they can be filtered too.
  const [status, setStatus] = useState<"all" | VendorOrder["status"] | "assigned" | "picked">("all");
  const [page, setPage] = useState(1);
  // On-demand item details, loaded when an order row is expanded.
  const [openId, setOpenId] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [itemsById, setItemsById] = useState<Record<number, OrderItem[]>>({});

  async function toggleDetail(id: number) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (id in itemsById) return;
    setLoadingId(id);
    try {
      const res = await api.get(`/orders/${id}`);
      setItemsById((m) => ({ ...m, [id]: (res.data.data?.items ?? []) as OrderItem[] }));
    } catch (e) {
      toast.error(apiErrorMessage(e));
      setItemsById((m) => ({ ...m, [id]: [] }));
    } finally {
      setLoadingId((cur) => (cur === id ? null : cur));
    }
  }

  // Drivers in the vendor's area, with a busy flag (assigned to another active
  // order). Reloaded after each assignment so busy state stays current.
  async function loadDrivers() {
    try {
      const res = await api.get("/staff/drivers");
      const raw = (Array.isArray(res.data.data?.items) ? res.data.data.items : []) as Record<string, unknown>[];
      setDrivers(raw.map((d) => ({
        id: Number(d.id ?? 0),
        name: String(d.name ?? ""),
        busy: Boolean(d.busy),
      })));
    } catch {
      // Optional — orders still load without the driver list.
    }
  }

  useEffect(() => {
    void loadDrivers();
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
          driver_id?: number | string | null;
          driver_name?: string | null;
        };
        const rows = ((res.data.data?.items ?? []) as ApiRow[]).map((r): OrderRow => ({
          id: Number(r.id),
          customer_name: r.customer_name ?? "—",
          total: Number(r.total) || 0,
          status: r.status,
          item_count: Number(r.item_count ?? 0),
          created_at: (r.created_at ?? "").slice(0, 16),
          driver_id: r.driver_id ? Number(r.driver_id) : null,
          driver_name: r.driver_name ?? null,
        }));
        setItems(rows);
      } catch (e) {
        toast.error(apiErrorMessage(e));
        const fallback = await mock.vendorOrders();
        setItems(fallback.map((o) => ({ ...o, driver_id: null, driver_name: null })));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Value→label map for the closed driver dropdowns. Includes every driver plus
  // any driver already stamped on an order (in case they're not in the list),
  // so the trigger can show the assigned name even when the menu is closed.
  const driverItems = useMemo(() => {
    const m = new Map<string, string>([["0", "Unassigned"]]);
    for (const d of drivers) m.set(String(d.id), d.name);
    for (const o of items) if (o.driver_id && o.driver_name) m.set(String(o.driver_id), o.driver_name);
    return Array.from(m, ([value, label]) => ({ value, label }));
  }, [drivers, items]);

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

  async function changeStatus(o: OrderRow, next: string) {
    if (!next || next === o.status) return;
    try {
      await api.patch(`/orders/${o.id}/status`, { status: next });
      setItems((cur) => cur.map((x) => (x.id === o.id ? { ...x, status: next as VendorOrder["status"] } : x)));
      toast.success(`Order #${o.id} → ${STATUS_LABELS[next] ?? next}`);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  async function changeDriver(o: OrderRow, v: string | null) {
    if (v == null) return;
    const driverId = v === "0" ? null : Number(v);
    if ((o.driver_id ?? null) === driverId) return;
    try {
      await api.patch(`/orders/${o.id}/driver`, { driver_id: driverId });
      const name = driverId ? (drivers.find((d) => d.id === driverId)?.name ?? null) : null;
      setItems((cur) => cur.map((x) => (x.id === o.id ? { ...x, driver_id: driverId, driver_name: name } : x)));
      toast.success(driverId ? `Driver assigned to #${o.id}` : `Driver removed from #${o.id}`);
      await loadDrivers(); // busy state changed
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  // Every driver in the area is selectable for any order — a driver may now hold
  // multiple orders at once. (The `busy` flag is kept only as a label hint.)
  const driverOptionsFor = (_o: OrderRow) => drivers;
  // Finished orders never enter the driver's delivery queue → assigning a driver
  // there is a dead end. Show the driver read-only instead of an editable picker.
  const isFinished = (o: OrderRow) => o.status === "delivered" || o.status === "cancelled";

  return (
    <>
      <MobileHeader title="Orders" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 pb-24 md:p-8">
        <PageHeader
          eyebrow="Operations"
          icon={ShoppingBag}
          title="Orders"
          description="Fulfil your incoming orders — assign a driver and mark them shipped / delivered as you progress."
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
            <Select
              value={status}
              onValueChange={(v) => v && setStatus(v as "all" | VendorOrder["status"] | "assigned" | "picked")}
              items={[
                { value: "all", label: "Any status" },
                { value: "pending", label: "Pending" },
                { value: "assigned", label: "Assigned" },
                { value: "picked", label: "Picked" },
                { value: "paid", label: "Paid" },
                { value: "shipped", label: "Shipped" },
                { value: "delivered", label: "Delivered" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            >
              <SelectTrigger className="h-10 rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="picked">Picked</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[90px_1.4fr_110px_140px_150px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Order</span>
            <span>Customer</span>
            <span>Amount</span>
            <span>Status</span>
            <span>Driver</span>
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
                  className="px-4 py-3 transition-colors hover:bg-surface-2/40"
                >
                  <div className="flex flex-col gap-3 md:grid md:grid-cols-[90px_1.4fr_110px_140px_150px] md:items-center">
                    <p className="hidden font-mono text-xs text-muted-foreground md:block">#{o.id}</p>
                    <button type="button" onClick={() => void toggleDetail(o.id)} className="flex min-w-0 items-center gap-3 text-left">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                        <ShoppingBag className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          <span className="md:hidden">Order #{o.id} · </span>
                          {o.customer_name}
                        </p>
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          {o.product_names || `${o.item_count} items`} · {o.created_at}
                          <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", openId === o.id && "rotate-180")} />
                        </p>
                      </div>
                    </button>
                    {/* Desktop: amount + status + driver */}
                    <p className="hidden text-sm font-bold text-brand md:block">{fmtINR(o.total)}</p>
                    <div className="hidden md:block">
                      <Select value={o.status} onValueChange={(v) => v && void changeStatus(o, v)} items={STATUS_ITEMS}>
                        <SelectTrigger className="h-8 w-full rounded-lg bg-surface-2/60 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SETTABLE.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="hidden md:block">
                      {isFinished(o) ? (
                        <span className="text-xs text-muted-foreground">{o.driver_name || "—"}</span>
                      ) : (
                        <Select value={String(o.driver_id ?? 0)} onValueChange={(v) => void changeDriver(o, v)} items={driverItems}>
                          <SelectTrigger className="h-8 w-full rounded-lg bg-surface-2/60 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Unassigned</SelectItem>
                            {driverOptionsFor(o).map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}{d.busy && d.id !== o.driver_id ? " · busy" : ""}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    {/* Mobile: amount + status on one line, driver below */}
                    <div className="flex items-center justify-between gap-3 md:hidden">
                      <p className="text-sm font-bold text-brand">{fmtINR(o.total)}</p>
                      <Select value={o.status} onValueChange={(v) => v && void changeStatus(o, v)} items={STATUS_ITEMS}>
                        <SelectTrigger className="h-8 w-36 rounded-lg bg-surface-2/60 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SETTABLE.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 md:hidden">
                      <span className="shrink-0 text-xs text-muted-foreground">Driver</span>
                      {isFinished(o) ? (
                        <span className="flex-1 text-xs text-muted-foreground">{o.driver_name || "—"}</span>
                      ) : (
                        <Select value={String(o.driver_id ?? 0)} onValueChange={(v) => void changeDriver(o, v)} items={driverItems}>
                          <SelectTrigger className="h-8 flex-1 rounded-lg bg-surface-2/60 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Unassigned</SelectItem>
                            {driverOptionsFor(o).map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}{d.busy && d.id !== o.driver_id ? " · busy" : ""}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                  {openId === o.id && (
                    <div className="mt-3 border-t border-border/60 pt-3">
                      {loadingId === o.id ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                        </div>
                      ) : (itemsById[o.id]?.length ?? 0) > 0 ? (
                        <ul className="space-y-3">
                          {itemsById[o.id]!.map((it) => {
                            const name = it.display_name || it.name || "Item";
                            const sub = Number(it.subtotal) || Number(it.price) * Number(it.qty);
                            return (
                              <li key={it.id} className="flex items-center gap-3">
                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2">
                                  <ProductImage src={it.product_image} alt={name} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{name}</p>
                                  {it.variant_name && it.variant_name !== name ? (
                                    <p className="truncate text-xs text-muted-foreground">{it.variant_name}</p>
                                  ) : null}
                                  <p className="text-xs text-muted-foreground">Qty {it.qty} × {fmtINR(Number(it.price))}</p>
                                </div>
                                <p className="shrink-0 text-sm font-semibold">{fmtINR(sub)}</p>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground">No item details.</p>
                      )}
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
    </>
  );
}
