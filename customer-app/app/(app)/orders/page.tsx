"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, Check, ChevronDown, Loader2, MapPin, RotateCcw, Search, ShoppingBag, Store, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { ProductImage } from "@/components/ui/custom/product-image";
import { api, apiErrorMessage, fileUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

type OrderStatus = "pending" | "confirmed" | "packed" | "shipped" | "delivered" | "paid" | "completed" | "cancelled";

type OrderRow = {
  id: number;
  customer_id: number;
  vendor_id: number | null;
  total: number | string;
  status: OrderStatus;
  notes?: string | null;
  created_at?: string | null;
  vendor_name?: string | null;
  shop_name?: string | null;
  area?: string | null;
  pincode?: string | null;
  taluk_name?: string | null;
  district_name?: string | null;
  driver_name?: string | null;
  product_names?: string | null;
  delivered_at?: string | null;
  return_window_days?: number;
  return_eligible_until?: string | null;
  can_return?: boolean;
  return_requested?: boolean;
  return_status?: string | null;
  cancel_window_hours?: number;
  cancel_eligible_until?: string | null;
  can_cancel?: boolean;
};

type DriverInfo = { id: number; name: string; mobile: string | null; id_card_url: string | null };

type OrderItem = {
  id: number;
  name: string | null;
  display_name?: string | null;
  variant_name?: string | null;
  product_image?: string | null;
  vendor_shop?: string | null;
  qty: number;
  price: number | string;
  subtotal: number | string;
  variation_label?: string | null;
};
type OrderDetail = { items: OrderItem[]; driver: DriverInfo | null; prescriptionUrl: string | null };

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending:   "bg-amber-500/10 text-amber-400 border-amber-500/30",
  confirmed: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  packed:    "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  shipped:   "bg-violet-500/10 text-violet-400 border-violet-500/30",
  delivered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  paid:      "bg-teal-500/10 text-teal-400 border-teal-500/30",
  completed: "bg-emerald-600/15 text-emerald-600 border-emerald-600/30",
  cancelled: "bg-rose-500/10 text-rose-400 border-rose-500/30",
};

// Customer-facing delivery progress. The backend only has 5 statuses, so the
// intermediate stages are derived (display-only — no backend change):
//   pending → Placed · paid → Confirmed · shipped → Out for Delivery · delivered → Delivered.
const STAGES = ["Order Placed", "Confirmed", "Packed", "Out for Delivery", "Delivered", "Paid", "Completed"] as const;
const STATUS_STAGE: Record<OrderStatus, number> = {
  pending: 0, confirmed: 1, packed: 2, shipped: 3, delivered: 4, paid: 5, completed: 6, cancelled: -1,
};

function StatusStepper({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-500">
        <XCircle className="h-4 w-4" /> Order cancelled
      </div>
    );
  }
  const reached = STATUS_STAGE[status] ?? 0;
  return (
    <div className="mt-3 flex items-start">
      {STAGES.map((label, i) => {
        const done   = i <= reached;
        const isLast = i === STAGES.length - 1;
        return (
          <div key={label} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : (i <= reached ? "bg-brand" : "bg-border"))} />
              <span className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold",
                done ? "border-brand bg-brand text-brand-foreground" : "border-border bg-surface-2 text-muted-foreground",
              )}>
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={cn("h-0.5 flex-1", isLast ? "bg-transparent" : (i < reached ? "bg-brand" : "bg-border"))} />
            </div>
            <span className={cn("mt-1 text-center text-[8.5px] leading-tight", done ? "font-medium text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending", confirmed: "Confirmed", packed: "Packed", shipped: "Out for Delivery",
  delivered: "Delivered", paid: "Paid", completed: "Completed", cancelled: "Cancelled",
};

function FilterPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        active ? "border-brand bg-brand text-brand-foreground" : "border-border bg-surface-2/60 text-muted-foreground hover:border-brand/40",
      )}
    >
      {label}
    </button>
  );
}

export default function OrdersPage() {
  const [items, setItems] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  // On-demand driver/ID-card proof, loaded when an order is expanded.
  const [openId, setOpenId] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [detailById, setDetailById] = useState<Record<number, OrderDetail>>({});
  const [returningId, setReturningId] = useState<number | null>(null);
  const [returnOpenId, setReturnOpenId] = useState<number | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [cancelOpenId, setCancelOpenId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");

  async function toggleDetail(id: number) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (id in detailById) return;
    setLoadingId(id);
    try {
      const res = await api.get(`/orders/${id}`);
      const d = res.data.data ?? {};
      setDetailById((m) => ({ ...m, [id]: {
        items: (d.items ?? []) as OrderItem[],
        driver: (d.driver ?? null) as DriverInfo | null,
        prescriptionUrl: fileUrl(d.order?.prescription_path ?? null),
      } }));
    } catch (e) {
      toast.error(apiErrorMessage(e));
      setDetailById((m) => ({ ...m, [id]: { items: [], driver: null, prescriptionUrl: null } }));
    } finally {
      setLoadingId((cur) => (cur === id ? null : cur));
    }
  }

  async function load() {
    try {
      const res = await api.get("/orders/mine");
      setItems((res.data.data?.items ?? []) as OrderRow[]);
    } catch (e) {
      toast.error(apiErrorMessage(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function requestReturn(id: number) {
    if (!returnReason.trim()) { toast.error("Please enter a reason for the return"); return; }
    setReturningId(id);
    try {
      await api.post(`/orders/${id}/return`, { reason: returnReason.trim() });
      toast.success("Return requested — our team will reach out.");
      setReturnOpenId(null);
      setReturnReason("");
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setReturningId(null);
    }
  }

  async function cancelOrder(id: number) {
    setCancellingId(id);
    try {
      const res = await api.post(`/orders/${id}/cancel`, { reason: cancelReason.trim() || undefined });
      const pen = Number(res.data.data?.penalty ?? 0);
      toast.success(pen > 0 ? `Order cancelled — ₹${pen} penalty applied` : "Order cancelled");
      setCancelOpenId(null);
      setCancelReason("");
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setCancellingId(null);
    }
  }

  const statusesPresent = Array.from(new Set(items.map((o) => o.status)));
  const filtered = items.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = [String(o.id), o.shop_name, o.vendor_name, o.product_names, o.area, o.taluk_name, o.pincode]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <>
      <AppHeader title="Orders" />
      <section className="mx-auto max-w-md space-y-3 p-4 pb-24 md:max-w-3xl md:p-8">
        {!loading && items.length > 0 && (
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order #, shop, product…"
                className="h-11 w-full rounded-xl border border-border bg-surface-2/60 pl-9 pr-3 text-sm outline-none focus:border-brand/50"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <FilterPill active={statusFilter === "all"} onClick={() => setStatusFilter("all")} label={`All (${items.length})`} />
              {statusesPresent.map((s) => (
                <FilterPill key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} label={STATUS_LABEL[s] ?? s} />
              ))}
            </div>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
        ) : items.length === 0 ? (
          <LuxuryCard hoverLift={false} className="p-10 text-center">
            <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-brand" />
            <p className="text-sm font-medium">No orders yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Orders you place will show up here.</p>
          </LuxuryCard>
        ) : filtered.length === 0 ? (
          <LuxuryCard hoverLift={false} className="p-10 text-center">
            <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">No orders match</p>
            <p className="mt-1 text-xs text-muted-foreground">Try a different search or status filter.</p>
          </LuxuryCard>
        ) : (
          filtered.map((o, i) => {
            // A multi-vendor order has no single vendor_id, so no shop name —
            // the per-item shop names below show who sells what.
            const vendorLabel = o.shop_name || o.vendor_name || "Multiple shops";
            const areaParts = [o.area, o.taluk_name, o.pincode].filter(Boolean) as string[];
            return (
              <motion.div key={o.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <LuxuryCard className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Order #{o.id}</p>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase", STATUS_STYLE[o.status] ?? STATUS_STYLE.pending)}>{o.status}</span>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <Store className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{vendorLabel}</p>
                      {areaParts.length > 0 && (
                        <p className="inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {areaParts.join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>

                  {o.product_names && (
                    <p className="mt-2 truncate text-xs text-muted-foreground">{o.product_names}</p>
                  )}

                  {/* Delivery progress (BUG-033) */}
                  <StatusStepper status={o.status} />

                  <div className="mt-3 flex items-end justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground">{(o.created_at ?? "").replace("T", " ").slice(0, 16)}</p>
                    <p className="text-lg font-bold text-brand">{fmtINR(Number(o.total))}</p>
                  </div>

                  {o.status === "pending" && o.can_cancel && (
                    <div className="mt-3 border-t border-border/60 pt-3">
                      {cancelOpenId === o.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            rows={2}
                            placeholder="Reason for cancellation"
                            className="w-full rounded-xl border border-border bg-surface-2/60 p-2.5 text-sm outline-none focus:border-brand/50"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => { setCancelOpenId(null); setCancelReason(""); }} className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-2">Keep order</button>
                            <button
                              type="button"
                              disabled={cancellingId === o.id}
                              onClick={() => void cancelOrder(o.id)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 disabled:opacity-50"
                            >
                              {cancellingId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} Confirm cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">Cancellable until {(o.cancel_eligible_until ?? "").replace("T", " ").slice(0, 16)}</p>
                          <button
                            type="button"
                            onClick={() => { setCancelOpenId(o.id); setCancelReason(""); }}
                            className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Cancel order
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {o.delivered_at && o.status !== "cancelled" && (o.return_window_days ?? 0) > 0 && (
                    <div className="mt-3 border-t border-border/60 pt-3">
                      {o.return_status === "approved" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500">
                          <RotateCcw className="h-3.5 w-3.5" /> Return approved
                        </span>
                      ) : o.return_status === "pending" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-500">
                          <RotateCcw className="h-3.5 w-3.5" /> Return requested
                        </span>
                      ) : o.can_return ? (
                        returnOpenId === o.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={returnReason}
                              onChange={(e) => setReturnReason(e.target.value)}
                              rows={2}
                              placeholder="Reason for return (required)"
                              className="w-full rounded-xl border border-border bg-surface-2/60 p-2.5 text-sm outline-none focus:border-brand/50"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <button type="button" onClick={() => { setReturnOpenId(null); setReturnReason(""); }} className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-surface-2">Cancel</button>
                              <button
                                type="button"
                                disabled={returningId === o.id || !returnReason.trim()}
                                onClick={() => void requestReturn(o.id)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10 disabled:opacity-50"
                              >
                                {returningId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Submit return
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">
                              Returnable until {(o.return_eligible_until ?? "").replace("T", " ").slice(0, 16)}
                            </p>
                            <button
                              type="button"
                              onClick={() => { setReturnOpenId(o.id); setReturnReason(""); }}
                              className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10"
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Request Return
                            </button>
                          </div>
                        )
                      ) : o.return_status === "rejected" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-500">
                          <RotateCcw className="h-3.5 w-3.5" /> Return declined
                        </span>
                      ) : (
                        <p className="text-xs text-muted-foreground">Return window closed for this order.</p>
                      )}
                    </div>
                  )}

                  <div className="mt-3 border-t border-border/60 pt-3">
                    <button
                      type="button"
                      onClick={() => void toggleDetail(o.id)}
                      className="flex w-full items-center justify-between text-left"
                    >
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                        {o.driver_name ? (
                          <><BadgeCheck className="h-4 w-4 text-emerald-500" /> Delivered by {o.driver_name}</>
                        ) : (
                          <><ShoppingBag className="h-4 w-4 text-brand" /> View items</>
                        )}
                      </span>
                      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", openId === o.id && "rotate-180")} />
                    </button>
                    {openId === o.id && (
                      <div className="mt-3 space-y-3">
                        {loadingId === o.id ? (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                          </div>
                        ) : (
                          <>
                            {(detailById[o.id]?.items.length ?? 0) > 0 ? (
                              <ul className="space-y-3">
                                {detailById[o.id]!.items.map((it) => {
                                  const name = it.display_name || it.name || "Item";
                                  const sub = Number(it.subtotal) || Number(it.price) * Number(it.qty);
                                  return (
                                    <li key={it.id} className="flex items-center gap-3">
                                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2">
                                        <ProductImage src={it.product_image} alt={name} />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">{name}</p>
                                        {it.vendor_shop ? (
                                          <p className="inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
                                            <Store className="h-3 w-3" /> {it.vendor_shop}
                                          </p>
                                        ) : null}
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
                            {detailById[o.id]?.prescriptionUrl ? (
                              <div className="border-t border-border/60 pt-3">
                                <p className="mb-1 text-xs text-muted-foreground">Prescription</p>
                                {detailById[o.id]!.prescriptionUrl!.toLowerCase().endsWith(".pdf") ? (
                                  <a
                                    href={detailById[o.id]!.prescriptionUrl!}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm font-medium text-brand underline"
                                  >
                                    View prescription (PDF)
                                  </a>
                                ) : (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={detailById[o.id]!.prescriptionUrl!}
                                    alt="Prescription"
                                    className="w-full rounded-xl border border-border object-contain"
                                  />
                                )}
                              </div>
                            ) : null}
                            {detailById[o.id]?.driver ? (
                              <div className="border-t border-border/60 pt-3">
                                <p className="mb-1 text-xs text-muted-foreground">Delivery driver</p>
                                <p className="text-sm font-medium">{detailById[o.id]!.driver!.name}</p>
                                {detailById[o.id]!.driver!.mobile ? (
                                  <a href={`tel:${detailById[o.id]!.driver!.mobile}`} className="text-sm font-semibold text-brand">
                                    {detailById[o.id]!.driver!.mobile}
                                  </a>
                                ) : null}
                              </div>
                            ) : null}
                            {detailById[o.id]?.driver?.id_card_url ? (
                              <div className="border-t border-border/60 pt-3">
                                <p className="mb-1 text-xs text-muted-foreground">Driver ID card</p>
                                <button
                                  type="button"
                                  onClick={() => setIdPreview(detailById[o.id]!.driver!.id_card_url!)}
                                  className="inline-flex flex-col items-start gap-1"
                                  aria-label="Preview driver ID card"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={detailById[o.id]!.driver!.id_card_url!}
                                    alt="Driver ID card"
                                    className="h-24 w-auto rounded-lg border border-border object-contain"
                                  />
                                  <span className="text-[10px] text-brand">Tap to preview</span>
                                </button>
                              </div>
                            ) : o.driver_name ? (
                              <p className="text-xs text-muted-foreground">Driver ID card not uploaded.</p>
                            ) : null}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </LuxuryCard>
              </motion.div>
            );
          })
        )}
      </section>

      {/* In-app ID-card preview (no new window). Tap anywhere to close. */}
      {idPreview && (
        <button
          type="button"
          onClick={() => setIdPreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          aria-label="Close ID card preview"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={idPreview} alt="Driver ID card" className="max-h-[85vh] max-w-full rounded-xl border border-border object-contain" />
        </button>
      )}
    </>
  );
}
