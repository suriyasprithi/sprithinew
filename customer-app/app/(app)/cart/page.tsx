"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Minus, Plus, ShoppingBag, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { ProductImage } from "@/components/ui/custom/product-image";
import { api, apiErrorMessage } from "@/lib/api";
import { cartBadge } from "@/lib/cart";

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

type CartRow = {
  cart_id: number;
  product_id: number;
  name: string;
  price: number | string;
  image?: string | null;
  qty: number;
  subtotal: number | string;
  gst_rate?: number | string;
  gst_amount?: number | string;
  vendor_id: number;
  vendor_shop?: string | null;
  variation_id: number | null;
  variation_label: string | null;
};

export default function CartPage() {
  const [items, setItems] = useState<CartRow[]>([]);
  const [gstTotal, setGstTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const res = await api.get("/cart");
      const rows = (res.data.data?.items ?? []) as CartRow[];
      setItems(rows);
      setGstTotal(Number(res.data.data?.gst_total ?? 0));
      cartBadge.set(rows.reduce((s, r) => s + (Number(r.qty) || 0), 0));
    } catch (e) {
      toast.error(apiErrorMessage(e));
      setItems([]);
      setGstTotal(0);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void refresh(); }, []);

  async function setQty(cartId: number, qty: number) {
    if (qty < 1) return;
    try {
      await api.patch(`/cart/${cartId}`, { qty });
      void refresh();
    } catch (e) { toast.error(apiErrorMessage(e)); }
  }
  async function remove(cartId: number) {
    try {
      await api.delete(`/cart/${cartId}`);
      toast.success("Removed");
      void refresh();
    } catch (e) { toast.error(apiErrorMessage(e)); }
  }

  const subtotal = items.reduce((s, i) => s + Number(i.price) * i.qty, 0);
  // The real delivery fee depends on the delivery date/slot chosen at checkout,
  // so the cart preview shows no number — it's computed on the Checkout page.
  const total = subtotal + gstTotal;

  return (
    <>
      <AppHeader title="Cart" />
      <section className="mx-auto max-w-md space-y-4 p-4 pb-24 md:max-w-3xl md:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
        ) : items.length === 0 ? (
          <LuxuryCard hoverLift={false} className="p-10 text-center">
            <ShoppingBag className="mx-auto mb-3 h-12 w-12 text-brand" />
            <p className="text-sm font-medium">Your cart is empty</p>
            <p className="mt-1 text-xs text-muted-foreground">Browse the shop to add some items.</p>
            <Link href="/shop-public" className="mt-5 inline-block">
              <GradientButton>Browse shop</GradientButton>
            </Link>
          </LuxuryCard>
        ) : (
          <>
            <div className="space-y-2">
              {items.map((it, i) => (
                <motion.div key={it.cart_id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <LuxuryCard className="flex gap-3 p-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                      <ProductImage src={it.image ?? ""} alt={it.name} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{it.name}</p>
                      {it.vendor_shop && (
                        <p className="inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <Store className="h-3 w-3" /> {it.vendor_shop}
                        </p>
                      )}
                      {it.variation_label && <p className="text-xs text-muted-foreground">{it.variation_label}</p>}
                      <p className="mt-1 text-sm font-bold text-brand">{fmtINR(Number(it.price))}</p>
                      {Number(it.gst_amount) > 0 && (
                        <p className="text-[11px] text-muted-foreground">+ GST {Number(it.gst_rate)}% · ₹{Number(it.gst_amount).toFixed(2)}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end justify-between">
                      <button onClick={() => void remove(it.cart_id)} className="text-muted-foreground hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2/40">
                        <button onClick={() => void setQty(it.cart_id, it.qty - 1)} className="px-2 py-1 hover:text-brand"><Minus className="h-3 w-3" /></button>
                        <span className="px-2 text-sm font-medium">{it.qty}</span>
                        <button onClick={() => void setQty(it.cart_id, it.qty + 1)} className="px-2 py-1 hover:text-brand"><Plus className="h-3 w-3" /></button>
                      </div>
                    </div>
                  </LuxuryCard>
                </motion.div>
              ))}
            </div>

            <LuxuryCard hoverLift={false} className="space-y-2 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmtINR(subtotal)}</span></div>
              {gstTotal > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>₹{gstTotal.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">Delivery fee</span><span className="text-xs text-muted-foreground">Calculated at checkout</span></div>
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold"><span>Total</span><span className="text-brand">{fmtINR(total)}</span></div>
            </LuxuryCard>

            <Link href="/pay" className="block">
              <GradientButton size="lg" className="w-full">Checkout</GradientButton>
            </Link>
            <Link
              href="/home"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-2/40 px-4 py-3 text-sm font-medium text-muted-foreground hover:border-brand/40 hover:text-brand"
            >
              <ArrowLeft className="h-4 w-4" /> Continue shopping
            </Link>
          </>
        )}
      </section>
    </>
  );
}
