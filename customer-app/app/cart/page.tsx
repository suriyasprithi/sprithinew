"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Minus, Plus, ShoppingBag, ShoppingCart, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TopInfoBar } from "@/components/marketplace/top-info-bar";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { FloatingActions } from "@/components/marketplace/floating-actions";
import { MarketplaceBottomNav } from "@/components/marketplace/mobile-bottom-nav";
import { ProductImage } from "@/components/ui/custom/product-image";
import { api, apiErrorMessage } from "@/lib/api";
import { cartBadge } from "@/lib/cart";
import { getCached, setCached } from "@/lib/page-cache";
import { useAuth } from "@/stores/auth";

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
type CartCache = { items: CartRow[]; gstTotal: number };

export default function CartPage() {
  const router = useRouter();
  const { user, isHydrated } = useAuth();

  // The cart lives on the account — bounce guests to sign-in (and back).
  useEffect(() => {
    if (isHydrated && !user) router.replace("/login?returnTo=/cart");
  }, [isHydrated, user, router]);

  // Stale-while-revalidate: show the last-seen cart instantly, refresh in background.
  const cached = getCached<CartCache>("cart");
  const [items, setItems] = useState<CartRow[]>(cached?.items ?? []);
  const [gstTotal, setGstTotal] = useState(cached?.gstTotal ?? 0);
  const [loading, setLoading] = useState(!cached);

  async function refresh() {
    try {
      const res = await api.get("/cart");
      const rows = (res.data.data?.items ?? []) as CartRow[];
      const gst = Number(res.data.data?.gst_total ?? 0);
      setItems(rows);
      setGstTotal(gst);
      setCached<CartCache>("cart", { items: rows, gstTotal: gst });
      cartBadge.set(rows.reduce((s, r) => s + (Number(r.qty) || 0), 0));
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (user) void refresh(); }, [user]);

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
  const total = subtotal + gstTotal;

  return (
    <div className="marketplace-theme min-h-screen pb-24 md:pb-0">
      <TopInfoBar />
      <MarketplaceHeader cartCount={0} wishlistCount={0} unreadCount={0} />

      <section className="mx-auto max-w-3xl px-4 pt-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mk-text-muted)]">Your bag</p>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight md:text-2xl">
          <ShoppingCart className="h-5 w-5 text-[var(--mk-brand)]" /> Cart
        </h1>
      </section>

      <section className="mx-auto max-w-3xl space-y-4 px-4 pb-12 pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-[var(--mk-text-muted)]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--mk-border)] bg-[var(--mk-surface)] p-12 text-center">
            <span className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--mk-brand-soft)] text-[var(--mk-brand)]">
              <ShoppingBag className="h-7 w-7" />
            </span>
            <p className="text-sm font-semibold">Your cart is empty</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--mk-text-muted)]">Browse the shop to add some items.</p>
            <Link
              href="/browse"
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--mk-brand)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--mk-shadow-sm)] hover:bg-[var(--mk-brand-deep)]"
            >
              <ShoppingBag className="h-4 w-4" /> Browse shop
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.cart_id} className="flex gap-3 rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--mk-surface-2)]">
                    <ProductImage src={it.image ?? ""} alt={it.name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{it.name}</p>
                    {it.vendor_shop && (
                      <p className="inline-flex items-center gap-1 truncate text-xs text-[var(--mk-text-muted)]">
                        <Store className="h-3 w-3" /> {it.vendor_shop}
                      </p>
                    )}
                    {it.variation_label && <p className="text-xs text-[var(--mk-text-muted)]">{it.variation_label}</p>}
                    <p className="mt-1 text-sm font-bold text-[var(--mk-brand)]">{fmtINR(Number(it.price))}</p>
                    {Number(it.gst_amount) > 0 && (
                      <p className="text-[11px] text-[var(--mk-text-muted)]">+ GST {Number(it.gst_rate)}% · ₹{Number(it.gst_amount).toFixed(2)}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <button onClick={() => void remove(it.cart_id)} className="text-[var(--mk-text-muted)] hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                    <div className="flex items-center gap-1 rounded-lg border border-[var(--mk-border)] bg-[var(--mk-surface-2)]">
                      <button onClick={() => void setQty(it.cart_id, it.qty - 1)} className="px-2 py-1 hover:text-[var(--mk-brand)]"><Minus className="h-3 w-3" /></button>
                      <span className="px-2 text-sm font-medium">{it.qty}</span>
                      <button onClick={() => void setQty(it.cart_id, it.qty + 1)} className="px-2 py-1 hover:text-[var(--mk-brand)]"><Plus className="h-3 w-3" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-4 text-sm">
              <div className="flex justify-between"><span className="text-[var(--mk-text-muted)]">Subtotal</span><span>{fmtINR(subtotal)}</span></div>
              {gstTotal > 0 && (
                <div className="flex justify-between"><span className="text-[var(--mk-text-muted)]">GST</span><span>₹{gstTotal.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between"><span className="text-[var(--mk-text-muted)]">Delivery fee</span><span className="text-xs text-[var(--mk-text-muted)]">Calculated at checkout</span></div>
              <div className="mt-2 flex justify-between border-t border-[var(--mk-border)] pt-2 text-base font-bold"><span>Total</span><span className="text-[var(--mk-brand)]">{fmtINR(total)}</span></div>
            </div>

            <Link
              href="/pay"
              className="block w-full rounded-xl bg-[var(--mk-brand)] py-3 text-center text-sm font-bold text-white shadow-[var(--mk-shadow-sm)] transition-colors hover:bg-[var(--mk-brand-deep)]"
            >
              Checkout
            </Link>
            <Link
              href="/home"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface)] px-4 py-3 text-sm font-medium text-[var(--mk-text-muted)] hover:border-[var(--mk-brand)]/40 hover:text-[var(--mk-brand)]"
            >
              <ArrowLeft className="h-4 w-4" /> Continue shopping
            </Link>
          </>
        )}
      </section>

      <MarketplaceFooter />
      <FloatingActions />
      <MarketplaceBottomNav />
    </div>
  );
}
