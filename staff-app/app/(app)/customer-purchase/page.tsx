"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, CreditCard, Plus, Receipt, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { Pagination } from "@/components/data-table/pagination";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { cleanMobile, isMobile } from "@/lib/phone";

const PAGE_SIZE = 10;
const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtDateTime = (s: string | null) => (s ?? "").replace("T", " ").slice(0, 16);
const fmtDate = (s: string | null) => (s ?? "").replace("T", " ").slice(0, 10);

type SaleMode = "online" | "offline";

type Purchase = {
  id: number;
  total: number | string;
  created_at: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  source: "qr" | "entered";
  sale_mode: SaleMode | null;
  linked_order_id: number | null;
  note: string | null;
};

type OrderOpt = {
  id: number;
  total: number | string;
  status: string | null;
  created_at: string | null;
};

/**
 * Vendor-initiated in-store purchase. The vendor picks Online (links one of the
 * customer's real orders — the amount comes from that order) or Offline (manual
 * amount + optional note). The money flow is unchanged either way; this only
 * tags and records the sale. Two tabs below list the Online vs Offline records.
 */
export default function CustomerPurchasePage() {
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState("");
  const [amount, setAmount] = useState("");
  const [saleMode, setSaleMode] = useState<SaleMode | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Online: the customer's real orders to link this purchase to.
  const [orders, setOrders] = useState<OrderOpt[]>([]);
  const [orderId, setOrderId] = useState<number | "">("");
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [rows, setRows] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<SaleMode>("online");

  // Customer-purchase rows only — offline synthetic records + online real orders
  // marked paid here. QR-scanned sales belong to the QR scanner page.
  async function refresh() {
    setLoading(true);
    try {
      const res = await api.get("/purchase/mine");
      const all = (res.data.data?.items ?? []) as Purchase[];
      setRows(all.filter((r) => r.source !== "qr"));
    } catch (e) {
      toast.error(apiErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }
  // Initial load — inline so no setState fires synchronously in the effect body
  // (loading already starts true). Post-record reloads go through refresh().
  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/purchase/mine");
        const all = (res.data.data?.items ?? []) as Purchase[];
        setRows(all.filter((r) => r.source !== "qr"));
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // When Online + a valid mobile, load that customer's real orders for linking.
  useEffect(() => {
    if (saleMode !== "online" || !isMobile(mobile)) { setOrders([]); setOrderId(""); return; }
    let cancelled = false;
    setLoadingOrders(true);
    setOrderId("");
    void (async () => {
      try {
        const res = await api.get("/purchase/customer-orders", { params: { mobile } });
        if (!cancelled) setOrders((res.data.data?.items ?? []) as OrderOpt[]);
      } catch {
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setLoadingOrders(false);
      }
    })();
    return () => { cancelled = true; };
  }, [saleMode, mobile]);

  const onlineRows = useMemo(() => rows.filter((r) => r.sale_mode === "online"), [rows]);
  const offlineRows = useMemo(() => rows.filter((r) => r.sale_mode !== "online"), [rows]);
  const activeRows = tab === "online" ? onlineRows : offlineRows;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activeRows;
    return activeRows.filter((r) =>
      (r.customer_name ?? "").toLowerCase().includes(q) ||
      (r.customer_mobile ?? "").includes(q));
  }, [activeRows, search]);

  useEffect(() => setPage(1), [search, tab]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalAmount = rows.reduce((s, r) => s + Number(r.total), 0);

  // Online amount is driven by the chosen order; offline is typed.
  // o.id arrives from the API as a string, orderId is a number — compare numerically.
  const selectedOrder = orders.find((o) => Number(o.id) === orderId) ?? null;
  const effectiveAmount = saleMode === "online" ? Number(selectedOrder?.total ?? 0) : Number(amount);

  function resetForm() {
    setMobile(""); setAmount(""); setSaleMode(""); setNote("");
    setOrders([]); setOrderId("");
  }

  async function charge() {
    if (!isMobile(mobile)) { toast.error("Enter a valid 10-digit customer mobile"); return; }
    if (!saleMode) { toast.error("Select Online or Offline"); return; }
    if (saleMode === "online" && !orderId) { toast.error("Select an order"); return; }
    const amt = effectiveAmount;
    if (saleMode === "offline" && (!amt || amt <= 0)) { toast.error("Enter an amount"); return; }
    setBusy(true);
    try {
      const res = await api.post("/purchase/from-customer", {
        customer_mobile: mobile,
        amount: amt,
        sale_mode: saleMode,
        ...(saleMode === "online" ? { order_id: orderId } : {}),
        ...(saleMode === "offline" && note.trim() ? { note: note.trim() } : {}),
      });
      toast.success(
        saleMode === "online"
          ? (res.data?.message ?? `Order #${orderId} marked paid`)
          : `₹${amt} recorded for ${mobile}`,
      );
      resetForm();
      setOpen(false);
      void refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <MobileHeader title="Customer purchase" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 pb-24 md:p-8">
        <PageHeader
          eyebrow="Payments"
          icon={CreditCard}
          title="Customer purchase"
          description="Record a customer's purchase. Online links one of their orders; Offline is a manual entry."
          action={
            <GradientButton onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Add
            </GradientButton>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="Purchases"       value={rows.length}  icon={Receipt}    tone="brand"   spark={[2, 3, 3, 4, 4, 4, 5, 5]} />
          <StatCard label="Total collected" value={totalAmount}  icon={CreditCard} tone="emerald" spark={[2, 3, 4, 4, 5, 5, 6, 6]} format={fmtINR} />
        </div>

        {/* Online / Offline tabs */}
        <div className="flex gap-2">
          {(["online", "offline"] as const).map((t) => {
            const count = t === "online" ? onlineRows.length : offlineRows.length;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold capitalize transition-colors ${
                  tab === t ? "bg-brand text-white" : "bg-surface-2/60 text-muted-foreground hover:bg-accent"
                }`}
              >
                {t}
                <span className={`rounded-full px-1.5 text-[11px] ${tab === t ? "bg-white/20" : "bg-foreground/10"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer name or mobile…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
          </div>
        </div>

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[72px_1fr_140px_130px_170px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>#</span>
            <span>Customer</span>
            <span>{tab === "online" ? "Order" : "Note"}</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Date</span>
          </div>
          {loading ? (
            <div className="p-3"><TableSkeleton rows={6} cols={5} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Receipt} title={`No ${tab} purchases`} description="Tap “Add” to record one." />
          ) : (
            <div className="divide-y divide-border">
              {paged.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[72px_1fr_140px_130px_170px]"
                >
                  <p className="hidden font-mono text-xs text-muted-foreground md:block">#{r.id}</p>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-xs font-semibold text-brand">
                      {(r.customer_name || "?").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{r.customer_name || "Customer"}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.customer_mobile || "—"}</p>
                      <p className="truncate text-xs text-muted-foreground md:hidden">
                        {tab === "online"
                          ? (r.linked_order_id ? `Order #${r.linked_order_id}` : "")
                          : (r.note || "")}
                      </p>
                    </div>
                  </div>
                  <div className="hidden truncate text-xs text-muted-foreground md:block">
                    {tab === "online"
                      ? (r.linked_order_id ? `#${r.linked_order_id}` : "—")
                      : (r.note || "—")}
                  </div>
                  <p className="justify-self-end text-sm font-semibold text-brand md:text-right">{fmtINR(Number(r.total))}</p>
                  <p className="hidden text-right text-xs text-muted-foreground md:block">{fmtDateTime(r.created_at)}</p>
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

      {/* Add-purchase popup */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Customer purchase</DialogTitle>
            <DialogDescription>
              Pick <b>Online</b> to link one of the customer&apos;s orders, or <b>Offline</b> for a manual record.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="m">Customer mobile</Label>
              <Input
                id="m"
                inputMode="numeric"
                value={mobile}
                onChange={(e) => setMobile(cleanMobile(e.target.value))}
                placeholder="9876543210"
                className="h-11 rounded-xl bg-surface-2/60"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Sale type</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["online", "offline"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSaleMode(m)}
                    className={`h-11 rounded-xl border text-sm font-semibold capitalize transition-colors ${
                      saleMode === m
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-input bg-surface-2/60 text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Online — link an order; amount comes from it */}
            {saleMode === "online" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="order">Order</Label>
                  <select
                    id="order"
                    value={orderId === "" ? "" : String(orderId)}
                    onChange={(e) => setOrderId(e.target.value ? Number(e.target.value) : "")}
                    disabled={!isMobile(mobile) || loadingOrders}
                    className="h-11 w-full rounded-xl border border-input bg-surface-2/60 px-3 text-sm disabled:opacity-60"
                  >
                    <option value="">
                      {!isMobile(mobile)
                        ? "Enter mobile first"
                        : loadingOrders
                          ? "Loading orders…"
                          : orders.length === 0
                            ? "No orders for this customer"
                            : "Select an order"}
                    </option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        #{o.id} · {fmtINR(Number(o.total))} · {fmtDate(o.created_at)}{o.status ? ` · ${o.status}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Amount (₹)</Label>
                  <Input
                    value={selectedOrder ? String(selectedOrder.total) : ""}
                    readOnly
                    placeholder="From selected order"
                    className="h-11 rounded-xl bg-surface-2/40"
                  />
                </div>
                <p className="text-xs text-muted-foreground">The order is marked <b>paid</b> and your commission is charged to your wallet. No new order is added.</p>
              </>
            )}

            {/* Offline — manual amount + optional note */}
            {saleMode === "offline" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="a">Amount (₹)</Label>
                  <Input
                    id="a"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="100"
                    className="h-11 rounded-xl bg-surface-2/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="note">Note (optional)</Label>
                  <Input
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Paid by cash in store"
                    className="h-11 rounded-xl bg-surface-2/60"
                  />
                </div>
              </>
            )}

            <GradientButton size="lg" className="w-full" disabled={busy} onClick={() => void charge()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (saleMode === "online" ? "Mark order paid" : (effectiveAmount > 0 ? `Record ₹${effectiveAmount}` : "Record"))}
            </GradientButton>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
