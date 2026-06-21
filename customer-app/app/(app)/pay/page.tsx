"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Banknote, MapPin, Home, AlertCircle, Check, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import {
  AddressFields,
  emptyAddressForm,
  formatAddress,
  type AddressForm,
} from "@/components/address/address-fields";
import { useAuth } from "@/stores/auth";
import { api, apiErrorMessage, type CustomerAddress } from "@/lib/api";

type CartRow = {
  cart_id: number;
  product_id: number;
  name: string;
  price: number | string;
  qty: number;
  variation_label: string | null;
};

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

/** Format total minutes as "45m" / "2h" / "1h 30m". */
const fmtHM = (m: number) => {
  const h = Math.floor(m / 60), mm = m % 60;
  return h ? (mm ? `${h}h ${mm}m` : `${h}h`) : `${mm}m`;
};

type DeliveryRate = { id: number; time_min: number; price: number };

/** Format a Date as a datetime-local input value ("YYYY-MM-DDTHH:MM"), local tz. */
const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

type DeliveryQuote = { free: boolean; amount: number; reason: string };
const quoteHint = (q: DeliveryQuote | null): string => {
  if (!q) return "";
  if (q.free) return q.reason === "eta" ? "Free — scheduled far enough ahead" : "";
  if (q.reason === "night") return "Night-time delivery charge applies";
  if (q.reason === "threshold") return "Order doesn't meet the free-delivery amount";
  return "";
};

function normalize(items: unknown[]): CustomerAddress[] {
  return (items as CustomerAddress[]).map((a) => ({
    ...a,
    id: Number(a.id),
    is_default: Number(a.is_default),
  }));
}

export default function CheckoutPage() {
  const router = useRouter();
  const { user, hydrate } = useAuth();
  const [items, setItems] = useState<CartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [notes, setNotes] = useState("");
  // Wallet payment hidden for now — default to COD. (Restore "wallet" default
  // when the wallet option below is re-enabled.)
  const [payMethod, setPayMethod] = useState<"wallet" | "cod">("cod");

  // Addresses
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [addrForm, setAddrForm] = useState<AddressForm>(emptyAddressForm);
  const [makeDefault, setMakeDefault] = useState(false);
  const [savingAddr, setSavingAddr] = useState(false);

  const [deliveryAt, setDeliveryAt] = useState("");
  const [minDateTime, setMinDateTime] = useState("");
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [rates, setRates] = useState<DeliveryRate[]>([]);
  const [rateId, setRateId] = useState<number | null>(null);

  // Default the delivery time to ~1h from now; min = now so no past times.
  useEffect(() => {
    const now = new Date();
    setMinDateTime(toLocalInput(now));
    setDeliveryAt(toLocalInput(new Date(now.getTime() + 60 * 60 * 1000)));
  }, []);

  // Delivery-time rate options (admin-configured per taluk). Cheapest first; the
  // selected rate's price IS the delivery fee. No rates → fall back to the
  // rule-based quote + the free-time field.
  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/customer/delivery-rates/time");
        const items = ((res.data.data?.items ?? []) as Record<string, unknown>[]).map((r) => ({
          id: Number(r.id), time_min: Number(r.time_min), price: Number(r.price),
        }));
        setRates(items);
        if (items.length) setRateId(items[0].id); // cheapest-first default
      } catch { /* no rates → rule-based fallback */ }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/customer/addresses");
        const list = normalize(res.data.data?.items ?? []);
        setAddresses(list);
        const def = list.find((a) => a.is_default === 1) ?? list[0] ?? null;
        setSelectedId(def?.id ?? null);
        if (list.length === 0) { setChoosing(true); setAddingNew(true); setMakeDefault(true); }
      } catch (e) {
        toast.error(apiErrorMessage(e));
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/cart");
        const rows = (res.data.data?.items ?? []) as CartRow[];
        if (rows.length === 0) { router.replace("/cart"); return; }
        setItems(rows);
      } catch (e) {
        toast.error(apiErrorMessage(e));
        router.replace("/cart");
        return;
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // Live, server-computed delivery charge (rule-based). Recomputed when the
  // chosen delivery date+time changes or once the cart has loaded. The order
  // endpoint recomputes the same amount authoritatively on placement.
  useEffect(() => {
    if (loading || !deliveryAt) return;
    void (async () => {
      try {
        const res = await api.get(`/customer/delivery-quote?delivery_at=${encodeURIComponent(deliveryAt)}`);
        const d = (res.data.data ?? {}) as Record<string, unknown>;
        setQuote({ free: Boolean(d.free), amount: Number(d.amount ?? 0), reason: String(d.reason ?? "") });
      } catch {
        setQuote(null);
      }
    })();
  }, [deliveryAt, loading]);

  async function addNewAddress() {
    if (!addrForm.address_line.trim()) { toast.error("Full address is required"); return; }
    setSavingAddr(true);
    try {
      const res = await api.post("/customer/addresses", { ...addrForm, is_default: makeDefault });
      const list = normalize(res.data.data?.items ?? []);
      setAddresses(list);
      // Select the just-added address (highest id).
      const newestId = list.reduce((m, a) => (a.id > m ? a.id : m), 0);
      setSelectedId(newestId || (list.find((a) => a.is_default === 1)?.id ?? list[0]?.id ?? null));
      setAddrForm(emptyAddressForm);
      setMakeDefault(false);
      setAddingNew(false);
      setChoosing(false);
      toast.success("Address added");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Save failed"));
    } finally {
      setSavingAddr(false);
    }
  }

  const subtotal = items.reduce((s, i) => s + Number(i.price) * i.qty, 0);
  const selectedRate = rates.find((r) => r.id === rateId) ?? null;
  const deliveryFee = selectedRate ? selectedRate.price : (quote ? quote.amount : 0);
  const deliveryFree = selectedRate ? selectedRate.price <= 0 : !!quote?.free;
  const total = subtotal + deliveryFee;
  const balance = user?.wallet_balance ?? 0;
  const selected = addresses.find((a) => a.id === selectedId) ?? null;
  const walletOk = balance >= total;
  // COD has no balance requirement — cash is collected on delivery.
  const canPay = Boolean(selected) && (payMethod === "cod" || walletOk);

  async function place() {
    if (!selectedId) { toast.error("Select a delivery address"); return; }
    setPlacing(true);
    try {
      const res = await api.post("/orders/place", { notes, payment_method: payMethod, address_id: selectedId, delivery_at: deliveryAt, delivery_rate_id: rateId });
      const orderId = res.data.data?.order_id;
      toast.success(payMethod === "cod" ? `Order #${orderId} placed — pay on delivery` : `Order #${orderId} placed!`);
      try { await hydrate(); } catch { /* non-fatal */ }
      router.replace("/orders");
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setPlacing(false);
    }
  }

  if (loading) {
    return <><AppHeader title="Checkout" /><div className="flex items-center justify-center p-10 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div></>;
  }

  return (
    <>
      <AppHeader title="Checkout" />
      <section className="mx-auto max-w-md space-y-4 p-4 pb-24 md:max-w-3xl md:p-8">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <LuxuryCard hoverLift={false} className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Items ({items.length})</p>
            <div className="mt-3 space-y-2">
              {items.map((it) => (
                <div key={it.cart_id} className="flex justify-between text-sm">
                  <span className="truncate pr-2">{it.qty} × {it.name}{it.variation_label ? ` (${it.variation_label})` : ""}</span>
                  <span className="font-medium">{fmtINR(Number(it.price) * it.qty)}</span>
                </div>
              ))}
            </div>
          </LuxuryCard>
        </motion.div>

        <LuxuryCard hoverLift={false} className="space-y-2 p-4 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmtINR(subtotal)}</span></div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Delivery date</span>
            <input
              type="date"
              value={deliveryAt.split("T")[0] ?? ""}
              min={minDateTime.split("T")[0]}
              onChange={(e) => setDeliveryAt(`${e.target.value}T${deliveryAt.split("T")[1] || "12:00"}`)}
              aria-label="Delivery date"
              className="rounded-lg border border-border bg-surface-2/60 px-2 py-1 text-sm font-medium outline-none focus:border-brand/50"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Delivery time</span>
            {rates.length > 0 ? (
              <select
                value={rateId ?? ""}
                onChange={(e) => setRateId(Number(e.target.value))}
                aria-label="Delivery time"
                className="rounded-lg border border-border bg-surface-2/60 px-2 py-1 text-sm font-medium outline-none focus:border-brand/50"
              >
                {rates.map((r) => (
                  <option key={r.id} value={r.id}>
                    Within {fmtHM(r.time_min)} — {r.price > 0 ? fmtINR(r.price) : "Free"}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="time"
                value={deliveryAt.split("T")[1] ?? ""}
                min={(deliveryAt.split("T")[0] ?? "") === minDateTime.split("T")[0] ? minDateTime.split("T")[1] : undefined}
                onChange={(e) => setDeliveryAt(`${deliveryAt.split("T")[0] || minDateTime.split("T")[0]}T${e.target.value}`)}
                aria-label="Delivery time"
                className="rounded-lg border border-border bg-surface-2/60 px-2 py-1 text-sm font-medium outline-none focus:border-brand/50"
              />
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Delivery fee</span>
            {deliveryFree
              ? <span className="font-semibold text-emerald-500">Free Delivery</span>
              : <span className="font-medium">{fmtINR(deliveryFee)}</span>}
          </div>
          {!selectedRate && quoteHint(quote) && (
            <p className="text-[11px] text-muted-foreground">{quoteHint(quote)}</p>
          )}
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold"><span>Total</span><span className="text-brand">{fmtINR(total)}</span></div>
        </LuxuryCard>

        {/* Delivery address */}
        <LuxuryCard hoverLift={false} className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-brand" />
              <p className="text-sm font-semibold">Delivery address</p>
            </div>
            {addresses.length > 0 && !choosing && (
              <Button size="sm" variant="ghost" onClick={() => setChoosing(true)} className="-mr-2 h-7 text-xs">
                Change
              </Button>
            )}
          </div>

          {/* Collapsed: show the selected address */}
          {!choosing && selected && (
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-brand/40 bg-brand/5 p-3 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <div className="min-w-0 flex-1">
                {selected.is_default === 1 && (
                  <span className="mb-1 inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
                    <Star className="h-3 w-3 fill-current" /> Default
                  </span>
                )}
                <p className="leading-snug">{formatAddress(selected)}</p>
              </div>
            </div>
          )}

          {/* Chooser: pick a saved address or add a new one */}
          {choosing && (
            <div className="mt-3 space-y-2">
              {addresses.map((a) => {
                const isSel = a.id === selectedId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { setSelectedId(a.id); setChoosing(false); setAddingNew(false); }}
                    className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition-colors ${
                      isSel ? "border-brand bg-brand/5" : "border-border hover:border-brand/40"
                    }`}
                  >
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${isSel ? "border-brand bg-brand text-brand-foreground" : "border-muted-foreground/40"}`}>
                      {isSel && <Check className="h-3 w-3" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      {a.is_default === 1 && (
                        <span className="mb-0.5 inline-block text-[10px] font-semibold uppercase tracking-wider text-brand">Default</span>
                      )}
                      <p className="leading-snug">{formatAddress(a)}</p>
                    </div>
                  </button>
                );
              })}

              {!addingNew ? (
                <Button variant="outline" className="w-full" onClick={() => { setAddingNew(true); setMakeDefault(addresses.length === 0); }}>
                  <Plus className="h-4 w-4" /> Add new address
                </Button>
              ) : (
                <div className="space-y-3 rounded-xl border border-border p-3">
                  <AddressFields form={addrForm} setForm={setAddrForm} />
                  {addresses.length > 0 && (
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={makeDefault}
                        onChange={(e) => setMakeDefault(e.target.checked)}
                        className="h-4 w-4 accent-brand"
                      />
                      Set as default address
                    </label>
                  )}
                  <div className="flex gap-2">
                    {addresses.length > 0 && (
                      <Button variant="ghost" className="flex-1" disabled={savingAddr} onClick={() => setAddingNew(false)}>
                        Cancel
                      </Button>
                    )}
                    <GradientButton className="flex-1" disabled={savingAddr} onClick={() => void addNewAddress()}>
                      {savingAddr ? "Saving…" : "Save address"}
                    </GradientButton>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No address at all and not currently adding */}
          {!choosing && !selected && (
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">No address selected.</p>
                <Button size="sm" variant="ghost" className="mt-1 h-7 px-0 text-xs text-brand" onClick={() => { setChoosing(true); setAddingNew(addresses.length === 0); }}>
                  Add a delivery address
                </Button>
              </div>
            </div>
          )}
        </LuxuryCard>

        <LuxuryCard hoverLift={false} className="p-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand" />
            <p className="text-sm font-semibold">Delivery notes <span className="text-xs font-normal text-muted-foreground">(optional)</span></p>
          </div>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Landmark / instructions" className="mt-3 rounded-xl bg-surface-2/60 text-sm" />
        </LuxuryCard>

        <LuxuryCard hoverLift={false} className="space-y-2 p-4">
          <p className="text-sm font-semibold">Payment method</p>

          {/* Wallet — hidden for now. Re-enable this block to restore wallet payment. */}
          {/* <button
            type="button"
            onClick={() => setPayMethod("wallet")}
            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
              payMethod === "wallet" ? "border-brand bg-brand/5" : "border-border hover:border-brand/40"
            }`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <WalletIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Pay from wallet</p>
              <p className="text-xs text-muted-foreground">Balance: {fmtINR(balance)}</p>
            </div>
            {payMethod === "wallet" && !walletOk && (
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">Insufficient</span>
            )}
          </button> */}

          {/* Cash on delivery */}
          <button
            type="button"
            onClick={() => setPayMethod("cod")}
            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
              payMethod === "cod" ? "border-brand bg-brand/5" : "border-border hover:border-brand/40"
            }`}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Banknote className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Cash on Delivery</p>
              <p className="text-xs text-muted-foreground">Pay {fmtINR(total)} in cash when it arrives</p>
            </div>
          </button>
        </LuxuryCard>

        {!canPay && (
          <p className="flex items-center gap-1.5 text-xs text-rose-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {!selected
              ? "Select your delivery address above to continue."
              : "Insufficient wallet balance — choose Cash on Delivery instead."}
          </p>
        )}

        <GradientButton size="lg" className="w-full" disabled={!canPay || placing} onClick={() => void place()}>
          {placing
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : payMethod === "cod" ? `Place COD Order · ${fmtINR(total)}` : `Pay ${fmtINR(total)}`}
        </GradientButton>
      </section>
    </>
  );
}
