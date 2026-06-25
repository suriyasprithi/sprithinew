"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, Search, Hourglass, Check, Banknote, ChevronDown, Loader2, XCircle, FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { Pagination } from "@/components/data-table/pagination";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { ProductImage } from "@/components/ui/custom/product-image";
import { api, apiErrorMessage, fileUrl } from "@/lib/api";
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
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

// Statuses a vendor can set (the backend accepts exactly these).
const SETTABLE = ["pending", "confirmed", "packed", "shipped", "delivered", "paid", "completed", "cancelled"] as const;
// Display labels for every status — includes the legacy import values
// (assigned/picked) so an order already in one of those still shows a clean
// label in the trigger, even though they're not selectable.
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending", confirmed: "Confirmed", packed: "Packed", assigned: "Assigned", picked: "Picked",
  shipped: "Out for Delivery", delivered: "Delivered", paid: "Paid", completed: "Completed", cancelled: "Cancelled",
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
  const [cancelTarget, setCancelTarget] = useState<OrderRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  // Prescription order "purchase bill": vendor adds the medicines + prices.
  const [billTarget, setBillTarget] = useState<OrderRow | null>(null);
  const [billLines, setBillLines] = useState<{ name: string; qty: string; price: string }[]>([]);
  const [billBusy, setBillBusy] = useState(false);
  const [page, setPage] = useState(1);
  // On-demand item details, loaded when an order row is expanded.
  const [openId, setOpenId] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [itemsById, setItemsById] = useState<Record<number, OrderItem[]>>({});
  // Prescription file URL per order (medical orders only), loaded with detail.
  const [prescriptionById, setPrescriptionById] = useState<Record<number, string | null>>({});

  async function toggleDetail(id: number) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (id in itemsById) return;
    setLoadingId(id);
    try {
      const res = await api.get(`/orders/${id}`);
      setItemsById((m) => ({ ...m, [id]: (res.data.data?.items ?? []) as OrderItem[] }));
      setPrescriptionById((m) => ({ ...m, [id]: fileUrl(res.data.data?.order?.prescription_path ?? null) }));
    } catch (e) {
      toast.error(apiErrorMessage(e));
      setItemsById((m) => ({ ...m, [id]: [] }));
      setPrescriptionById((m) => ({ ...m, [id]: null }));
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
          cancel_reason?: string | null;
          cancelled_by?: string | null;
          sale_mode?: string | null;
          prescription_path?: string | null;
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
          cancel_reason: r.cancel_reason ?? null,
          cancelled_by: r.cancelled_by ?? null,
          sale_mode: r.sale_mode ?? null,
          prescription_path: r.prescription_path ?? null,
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

  const pending = items.filter((o) => ["pending", "confirmed", "packed", "shipped"].includes(o.status));
  const delivered = items.filter((o) => ["delivered", "paid", "completed"].includes(o.status));
  const totalRevenue = items.reduce((s, o) => s + o.total, 0);

  async function changeStatus(o: OrderRow, next: string) {
    if (!next || next === o.status) return;
    // Cancelling needs a reason the customer will see — capture it via a dialog
    // and hit the dedicated /cancel endpoint (restocks + notifies the customer).
    if (next === "cancelled") { setCancelTarget(o); setCancelReason(""); return; }
    try {
      await api.patch(`/orders/${o.id}/status`, { status: next });
      setItems((cur) => cur.map((x) => (x.id === o.id ? { ...x, status: next as VendorOrder["status"] } : x)));
      toast.success(`Order #${o.id} → ${STATUS_LABELS[next] ?? next}`);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  async function submitVendorCancel() {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) { toast.error("Please enter a reason for cancelling"); return; }
    const o = cancelTarget;
    setCancelBusy(true);
    try {
      await api.post(`/orders/${o.id}/cancel`, { reason: cancelReason.trim() });
      setItems((cur) => cur.map((x) => (x.id === o.id ? { ...x, status: "cancelled" as VendorOrder["status"] } : x)));
      toast.success(`Order #${o.id} cancelled — customer notified`);
      setCancelTarget(null);
      setCancelReason("");
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setCancelBusy(false);
    }
  }

  function openBill(o: OrderRow) {
    setBillTarget(o);
    setBillLines([{ name: "", qty: "1", price: "" }]);
  }
  const billTotal = billLines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);

  async function submitBill() {
    if (!billTarget) return;
    const items = billLines
      .map((l) => ({ name: l.name.trim(), qty: Number(l.qty) || 0, price: Number(l.price) || 0 }))
      .filter((l) => l.name && l.qty > 0 && l.price >= 0);
    if (!items.length) { toast.error("Add at least one item with a price"); return; }
    const o = billTarget;
    setBillBusy(true);
    try {
      const res = await api.post(`/orders/${o.id}/bill`, { items });
      const total = Number(res.data.data?.total ?? 0);
      setItems((cur) => cur.map((x) => (x.id === o.id ? { ...x, status: "confirmed" as VendorOrder["status"], total } : x)));
      toast.success(`Bill added — order #${o.id} confirmed (₹${total.toFixed(2)})`);
      setBillTarget(null);
      setBillLines([]);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBillBusy(false);
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
  const isFinished = (o: OrderRow) => ["delivered", "paid", "completed", "cancelled"].includes(o.status);

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
                { value: "confirmed", label: "Confirmed" },
                { value: "packed", label: "Packed" },
                { value: "assigned", label: "Assigned" },
                { value: "picked", label: "Picked" },
                { value: "shipped", label: "Out for Delivery" },
                { value: "delivered", label: "Delivered" },
                { value: "paid", label: "Paid" },
                { value: "completed", label: "Completed" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            >
              <SelectTrigger className="h-10 rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="packed">Packed</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="picked">Picked</SelectItem>
                <SelectItem value="shipped">Out for Delivery</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
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
                  {o.status === "cancelled" && o.cancel_reason ? (
                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-500">
                      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        <span className="font-semibold">{o.cancelled_by === "vendor" ? "You cancelled" : "Cancelled by customer"}:</span> {o.cancel_reason}
                      </span>
                    </div>
                  ) : null}
                  {o.sale_mode === "prescription" && o.status === "pending" ? (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand/10 px-3 py-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-medium text-brand">
                        <FileText className="h-3.5 w-3.5" /> Prescription order — add the items + bill to confirm
                      </span>
                      <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => openBill(o)}>
                        <Plus className="h-3.5 w-3.5" /> Add bill
                      </Button>
                    </div>
                  ) : null}
                  {openId === o.id && (
                    <div className="mt-3 border-t border-border/60 pt-3">
                      {loadingId === o.id ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                        </div>
                      ) : (
                        <>
                          {(itemsById[o.id]?.length ?? 0) > 0 ? (
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
                          {prescriptionById[o.id] ? (
                            <div className="mt-3 border-t border-border/60 pt-3">
                              <p className="mb-1 text-xs text-muted-foreground">Prescription</p>
                              {prescriptionById[o.id]!.toLowerCase().endsWith(".pdf") ? (
                                <a
                                  href={prescriptionById[o.id]!}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm font-medium text-brand underline"
                                >
                                  View prescription (PDF)
                                </a>
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={prescriptionById[o.id]!}
                                  alt="Prescription"
                                  className="max-h-80 w-full rounded-xl border border-border object-contain"
                                />
                              )}
                            </div>
                          ) : null}
                        </>
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

      {/* Vendor cancel — captures a reason the customer will see. */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) { setCancelTarget(null); setCancelReason(""); } }}>
        <DialogContent className="rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Cancel order #{cancelTarget?.id}</DialogTitle>
            <DialogDescription>The customer will see this reason. Stock is restored and the customer is notified.</DialogDescription>
          </DialogHeader>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
            placeholder="Reason for cancelling (e.g. out of stock)"
            className="w-full rounded-xl border border-input bg-surface-2/60 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setCancelTarget(null); setCancelReason(""); }} disabled={cancelBusy}>Keep order</Button>
            <Button variant="destructive" onClick={() => void submitVendorCancel()} disabled={cancelBusy || !cancelReason.trim()}>
              {cancelBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Cancel order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prescription order: vendor adds the medicines + prices ("purchase bill"). */}
      <Dialog open={!!billTarget} onOpenChange={(o) => { if (!o) { setBillTarget(null); setBillLines([]); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Bill for order #{billTarget?.id}</DialogTitle>
            <DialogDescription>Add the medicines and prices. The customer pays this total (+ any delivery fee) on delivery.</DialogDescription>
          </DialogHeader>

          {billTarget?.prescription_path ? (
            <a href={fileUrl(billTarget.prescription_path) ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium text-brand underline">
              <FileText className="h-3.5 w-3.5" /> View prescription
            </a>
          ) : null}

          <div className="space-y-2">
            {billLines.map((l, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  value={l.name}
                  onChange={(e) => setBillLines((cur) => cur.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))}
                  placeholder="Medicine name"
                  className="h-9 flex-1 rounded-lg border border-input bg-surface-2/60 px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
                <input
                  value={l.qty}
                  onChange={(e) => setBillLines((cur) => cur.map((x, i) => (i === idx ? { ...x, qty: e.target.value.replace(/\D/g, "") } : x)))}
                  inputMode="numeric"
                  placeholder="Qty"
                  className="h-9 w-14 rounded-lg border border-input bg-surface-2/60 px-2 text-center text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
                <input
                  value={l.price}
                  onChange={(e) => setBillLines((cur) => cur.map((x, i) => (i === idx ? { ...x, price: e.target.value.replace(/[^0-9.]/g, "") } : x)))}
                  inputMode="decimal"
                  placeholder="Price"
                  className="h-9 w-20 rounded-lg border border-input bg-surface-2/60 px-2 text-right text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
                <button type="button" onClick={() => setBillLines((cur) => (cur.length > 1 ? cur.filter((_, i) => i !== idx) : cur))} className="text-muted-foreground hover:text-rose-500" aria-label="Remove line">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={() => setBillLines((cur) => [...cur, { name: "", qty: "1", price: "" }])}>
              <Plus className="h-3.5 w-3.5" /> Add item
            </Button>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
            <span>Items total</span><span className="text-brand">₹{billTotal.toFixed(2)}</span>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setBillTarget(null); setBillLines([]); }} disabled={billBusy}>Cancel</Button>
            <Button onClick={() => void submitBill()} disabled={billBusy || billTotal <= 0}>
              {billBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirm bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
