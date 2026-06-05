"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Wallet as WalletIcon, Banknote, MapPin, Home, AlertCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { useAuth } from "@/stores/auth";
import { api, apiErrorMessage, AuthUser } from "@/lib/api";

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

type AddressForm = { address_line: string; landmark: string; city: string; pincode: string };

export default function CheckoutPage() {
  const router = useRouter();
  const { user, hydrate, setUser } = useAuth();
  const [items, setItems] = useState<CartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [notes, setNotes] = useState("");
  const [payMethod, setPayMethod] = useState<"wallet" | "cod">("wallet");
  const [useSavedAddress, setUseSavedAddress] = useState(false);
  const [editingAddr, setEditingAddr] = useState(false);
  const [savingAddr, setSavingAddr] = useState(false);
  const [addrForm, setAddrForm] = useState<AddressForm>({ address_line: "", landmark: "", city: "", pincode: "" });

  type KmSlab = { id: number; from_km: number; to_km: number; price_per_km: number };
  const [smallestSlab, setSmallestSlab] = useState<KmSlab | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/customer/delivery-rates/km");
        const raw = (Array.isArray(res.data.data?.items) ? res.data.data.items : []) as unknown[];
        const slabs = raw.map((r) => {
          const x = r as Record<string, unknown>;
          return {
            id: Number(x.id ?? 0),
            from_km: Number(x.from_km ?? 0),
            to_km: Number(x.to_km ?? 0),
            price_per_km: Number(x.price_per_km ?? 0),
          };
        });
        // Smallest by from_km (e.g. 0-3 km slab)
        const smallest = slabs.length
          ? slabs.reduce((best, s) => (s.from_km < best.from_km ? s : best), slabs[0])
          : null;
        setSmallestSlab(smallest);
      } catch {
        // Non-blocking — falls back to flat fee
      }
    })();
  }, []);

  function openAddrEdit() {
    setAddrForm({
      address_line: user?.address_line ?? "",
      landmark:     user?.landmark ?? "",
      city:         user?.city ?? "",
      pincode:      user?.pincode ?? "",
    });
    setEditingAddr(true);
  }

  async function saveAddr() {
    setSavingAddr(true);
    try {
      const res = await api.patch("/auth/me/address", addrForm);
      setUser(res.data.data as AuthUser);
      toast.success("Address updated");
      setEditingAddr(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Save failed"));
    } finally {
      setSavingAddr(false);
    }
  }

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

  const subtotal = items.reduce((s, i) => s + Number(i.price) * i.qty, 0);
  const deliveryFee = smallestSlab
    ? Math.round(smallestSlab.to_km * smallestSlab.price_per_km * 100) / 100
    : 25;
  const total = subtotal + deliveryFee;
  const balance = user?.wallet_balance ?? 0;
  const hasAddress = Boolean(user?.address_line || user?.landmark || user?.city || user?.pincode);
  const addrSelected = hasAddress && useSavedAddress;
  const walletOk = balance >= total;
  // COD has no balance requirement — cash is collected on delivery.
  const canPay = addrSelected && (payMethod === "cod" || walletOk);

  async function place() {
    setPlacing(true);
    try {
      const res = await api.post("/orders/place", { notes, payment_method: payMethod });
      const orderId = res.data.data?.order_id;
      toast.success(payMethod === "cod" ? `Order #${orderId} placed — pay on delivery` : `Order #${orderId} placed!`);
      // Refresh wallet balance in the auth store so /wallet + header reflect the debit.
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
                <div key={it.id} className="flex justify-between text-sm">
                  <span className="truncate pr-2">{it.qty} × {it.name}{it.variation_label ? ` (${it.variation_label})` : ""}</span>
                  <span className="font-medium">{fmtINR(it.price * it.qty)}</span>
                </div>
              ))}
            </div>
          </LuxuryCard>
        </motion.div>

        <LuxuryCard hoverLift={false} className="space-y-2 p-4 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmtINR(subtotal)}</span></div>
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">
              Delivery fee
              {smallestSlab && (
                <span className="ml-1 text-xs text-muted-foreground/70">
                  ({smallestSlab.to_km} km × {fmtINR(smallestSlab.price_per_km)}/km)
                </span>
              )}
            </span>
            <span>{fmtINR(deliveryFee)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold"><span>Total</span><span className="text-brand">{fmtINR(total)}</span></div>
        </LuxuryCard>

        <LuxuryCard hoverLift={false} className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-brand" />
              <p className="text-sm font-semibold">Delivery address</p>
            </div>
            {!editingAddr && hasAddress && (
              <Button size="sm" variant="ghost" onClick={openAddrEdit} className="-mr-2 h-7 gap-1.5 text-xs">
                <Pencil className="h-3.5 w-3.5" /> Change
              </Button>
            )}
          </div>

          {editingAddr ? (
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="addr_line">Full address</Label>
                <Textarea
                  id="addr_line"
                  rows={2}
                  value={addrForm.address_line}
                  onChange={(e) => setAddrForm({ ...addrForm, address_line: e.target.value })}
                  placeholder="House no, street, area"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="addr_landmark">Landmark</Label>
                <Input
                  id="addr_landmark"
                  value={addrForm.landmark}
                  onChange={(e) => setAddrForm({ ...addrForm, landmark: e.target.value })}
                  placeholder="Near…"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="addr_city">City</Label>
                  <Input
                    id="addr_city"
                    value={addrForm.city}
                    onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="addr_pin">Pincode</Label>
                  <Input
                    id="addr_pin"
                    inputMode="numeric"
                    value={addrForm.pincode}
                    onChange={(e) => setAddrForm({ ...addrForm, pincode: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" className="flex-1" disabled={savingAddr} onClick={() => setEditingAddr(false)}>Cancel</Button>
                <GradientButton className="flex-1" disabled={savingAddr} onClick={() => void saveAddr()}>
                  {savingAddr ? "Saving…" : "Save address"}
                </GradientButton>
              </div>
            </div>
          ) : hasAddress ? (
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-2/60 p-3 transition-colors hover:border-brand/40">
              <input
                type="checkbox"
                checked={useSavedAddress}
                onChange={(e) => setUseSavedAddress(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
              />
              <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                {user?.address_line && <p className="font-medium">{user.address_line}</p>}
                {user?.landmark && <p className="text-muted-foreground">Near {user.landmark}</p>}
                {(user?.city || user?.pincode) && (
                  <p className="text-muted-foreground">
                    {[user?.city, user?.pincode].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </label>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">No address saved.</p>
                  <p className="text-xs text-muted-foreground">Add one below to continue.</p>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={openAddrEdit}>
                <Pencil className="h-4 w-4" /> Add address
              </Button>
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

          {/* Wallet */}
          <button
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
          </button>

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
            {!addrSelected
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
