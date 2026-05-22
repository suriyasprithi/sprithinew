"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Wallet as WalletIcon, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { useAuth } from "@/stores/auth";
import { api, apiErrorMessage } from "@/lib/api";

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

export default function CheckoutPage() {
  const router = useRouter();
  const { user, hydrate } = useAuth();
  const [items, setItems] = useState<CartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [notes, setNotes] = useState("");

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
  const deliveryFee = 25;
  const total = subtotal + deliveryFee;
  const balance = user?.wallet_balance ?? 0;
  const canPay = balance >= total;

  async function place() {
    setPlacing(true);
    try {
      const res = await api.post("/orders/place", { notes });
      const orderId = res.data.data?.order_id;
      toast.success(`Order #${orderId} placed!`);
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
          <div className="flex justify-between"><span className="text-muted-foreground">Delivery fee</span><span>{fmtINR(deliveryFee)}</span></div>
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold"><span>Total</span><span className="text-brand">{fmtINR(total)}</span></div>
        </LuxuryCard>

        <LuxuryCard hoverLift={false} className="p-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand" />
            <p className="text-sm font-semibold">Delivery notes <span className="text-xs font-normal text-muted-foreground">(optional)</span></p>
          </div>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Landmark / instructions" className="mt-3 rounded-xl bg-surface-2/60 text-sm" />
        </LuxuryCard>

        <LuxuryCard hoverLift={false} className={canPay ? "" : "border-rose-500/30 bg-rose-500/5"}>
          <div className="flex items-center gap-3 p-4 text-sm">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${canPay ? "bg-brand/10 text-brand" : "bg-rose-500/10 text-rose-400"}`}>
              <WalletIcon className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <p className="font-semibold">Pay from wallet</p>
              <p className="text-xs text-muted-foreground">Balance: {fmtINR(balance)}</p>
            </div>
            {!canPay && <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">Insufficient</span>}
          </div>
        </LuxuryCard>

        <GradientButton size="lg" className="w-full" disabled={!canPay || placing} onClick={() => void place()}>
          {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay ${fmtINR(total)}`}
        </GradientButton>
      </section>
    </>
  );
}
