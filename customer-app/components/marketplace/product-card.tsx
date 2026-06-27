"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Star, Plus, Minus, Store } from "lucide-react";
import { toast } from "sonner";
import { ProductImage } from "@/components/ui/custom/product-image";
import { wishlist } from "@/lib/wishlist";
import { cartBadge } from "@/lib/cart";
import { api, apiErrorMessage } from "@/lib/api";

export type MarketplaceProduct = {
  id: number;
  name: string;
  price: number;
  old_price?: number | null;
  image: string | null;
  vendor_name?: string | null;
  weights?: string[];       // e.g. ["500g", "1kg", "2kg"]
  rating?: number;          // 0..5
  reviews?: number;
  stock?: number;
  badge?: string;           // "20% OFF", "Trending", etc.
  has_variants?: boolean;
  default_variant_id?: number | null;  // backend picks cheapest in-stock variant
  min_price?: number | null;           // cheapest variant price (range low)
  max_price?: number | null;           // dearest variant price (range high)
  variant_axes?: { name: string; count: number }[];  // e.g. [{name:"size",count:4}]
};

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

export function ProductCard({ product, onAdd }: {
  product: MarketplaceProduct;
  onAdd?: (p: MarketplaceProduct, qty: number) => void;
}) {
  const [qty, setQty] = useState(0);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  // Hydrate from localStorage on mount + react to changes in other tabs.
  useEffect(() => {
    setLiked(wishlist.has(product.id));
    return wishlist.subscribe(() => setLiked(wishlist.has(product.id)));
  }, [product.id]);

  const off = product.old_price && product.old_price > product.price
    ? Math.round(((product.old_price - product.price) / product.old_price) * 100)
    : 0;

  // Variant axes shown as individual tag chips (e.g. [4 sizes] [2 colors]); the
  // actual size/colour is picked on the detail page, so no on-card selector.
  const variantChips = product.has_variants && product.variant_axes && product.variant_axes.length > 0
    ? product.variant_axes.map((a) => `${a.count} ${a.name}${a.count !== 1 && !a.name.toLowerCase().endsWith("s") ? "s" : ""}`)
    : [];
  const hasRange = !!product.has_variants && product.min_price != null && product.max_price != null && product.max_price > product.min_price;

  // Persist to the backend cart. If a parent supplies `onAdd`, defer to it
  // (e.g. for a UI-only override or analytics shim). Otherwise POST directly
  // to /cart/add — the api axios interceptor handles 401 by routing to /login.
  async function add() {
    if (busy) return;
    const nextQty = qty + 1;
    setBusy(true);
    try {
      if (onAdd) {
        onAdd(product, nextQty);
      } else {
        // Products with variants require a variation_id — fall back to the
        // backend-provided default (cheapest in-stock active variant).
        const payload: Record<string, unknown> = { product_id: product.id, qty: 1 };
        if (product.has_variants && product.default_variant_id) {
          payload.variation_id = product.default_variant_id;
        }
        await api.post("/cart/add", payload);
        cartBadge.bump(1); // server cart grew by 1 unit → reflect in the badge
      }
      setQty(nextQty);
      if (qty === 0) toast.success(`${product.name} added to cart`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not add to cart"));
    } finally {
      setBusy(false);
    }
  }

  async function decrement() {
    if (busy) return;
    const nextQty = Math.max(0, qty - 1);
    setBusy(true);
    try {
      // No /cart/remove-one endpoint — best-effort: optimistic UI only.
      // Decrementing on the home tile won't perfectly mirror server state if
      // the user has multiple entries; the Cart page is the source of truth.
      if (onAdd) onAdd(product, nextQty);
      setQty(nextQty);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] transition-all hover:-translate-y-1 hover:shadow-[var(--mk-shadow-md)]">
      {/* Image */}
      <Link href={`/product-public?id=${product.id}`} className="relative block">
        <div className="aspect-square overflow-hidden bg-[var(--mk-surface-2)]">
          <ProductImage src={product.image} alt={product.name} className="transition-transform group-hover:scale-105" />
        </div>

        {/* Badges */}
        {(product.badge || off > 0) && (
          <span className="absolute left-2 top-2 inline-flex items-center rounded-md bg-[var(--mk-brand)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
            {product.badge ?? `${off}% OFF`}
          </span>
        )}
        {product.stock != null && product.stock > 0 && product.stock <= 5 && (
          <span className="absolute left-2 top-9 inline-flex items-center rounded-md bg-amber-500/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
            Only {product.stock} left
          </span>
        )}

        {/* Wishlist */}
        <button
          type="button"
          aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
          onClick={(e) => {
            e.preventDefault();
            const nowLiked = wishlist.toggle(product.id);
            toast.success(nowLiked ? `${product.name} added to wishlist` : `${product.name} removed from wishlist`);
          }}
          className={`absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full backdrop-blur transition-colors ${
            liked ? "bg-[var(--mk-brand)] text-white" : "bg-white/90 text-[var(--mk-text)] hover:text-[var(--mk-brand)]"
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
        </button>
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {product.vendor_name && (
          <span className="inline-flex w-fit items-center gap-1 self-start rounded-full bg-[var(--mk-brand-soft)] px-2 py-0.5 text-xs font-bold text-[var(--mk-brand-deep)]">
            <Store className="h-3.5 w-3.5" /> {product.vendor_name}
          </span>
        )}

        <Link href={`/product-public?id=${product.id}`} className="line-clamp-2 text-sm font-semibold leading-tight hover:text-[var(--mk-brand-deep)]">
          {product.name}
        </Link>

        {variantChips.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {variantChips.map((label) => (
              <span key={label} className="inline-flex items-center rounded-full border border-[var(--mk-border)] bg-[var(--mk-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--mk-text-muted)]">
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Rating */}
        {product.rating != null && (
          <div className="flex items-center gap-1 text-xs">
            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
              {product.rating.toFixed(1)} <Star className="h-3 w-3 fill-current" />
            </span>
            {product.reviews != null && <span className="text-[var(--mk-text-muted)]">({product.reviews})</span>}
          </div>
        )}

        {/* Price + actions */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div className="min-w-0">
            <p className="text-base font-bold text-[var(--mk-text)] leading-tight">
              {hasRange && <span className="text-[11px] font-medium text-[var(--mk-text-muted)]">From </span>}
              {fmtINR(product.price)}
            </p>
            {product.old_price && product.old_price > product.price && (
              <p className="text-xs text-[var(--mk-text-muted)] line-through">{fmtINR(product.old_price)}</p>
            )}
          </div>

          {qty === 0 ? (
            <button
              type="button"
              onClick={add}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg border-2 border-[var(--mk-brand)] bg-[var(--mk-brand-soft)] px-3 py-1.5 text-xs font-bold text-[var(--mk-brand-deep)] transition-colors hover:bg-[var(--mk-brand)] hover:text-white disabled:opacity-60"
            >
              ADD
            </button>
          ) : (
            <div className="inline-flex items-center overflow-hidden rounded-lg bg-[var(--mk-brand)] text-white">
              <button onClick={decrement} disabled={busy} className="px-2 py-1 hover:bg-[var(--mk-brand-deep)] disabled:opacity-60">
                <Minus className="h-3 w-3" />
              </button>
              <span className="min-w-6 text-center text-xs font-bold">{qty}</span>
              <button onClick={add} disabled={busy} className="px-2 py-1 hover:bg-[var(--mk-brand-deep)] disabled:opacity-60">
                <Plus className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)]">
      <div className="aspect-square bg-[var(--mk-surface-2)] shimmer" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-1/2 rounded bg-[var(--mk-surface-2)] shimmer" />
        <div className="h-4 w-4/5 rounded bg-[var(--mk-surface-2)] shimmer" />
        <div className="h-4 w-1/3 rounded bg-[var(--mk-surface-2)] shimmer" />
      </div>
    </div>
  );
}
