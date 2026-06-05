"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Trash2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { TopInfoBar } from "@/components/marketplace/top-info-bar";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { FloatingActions } from "@/components/marketplace/floating-actions";
import { MarketplaceBottomNav } from "@/components/marketplace/mobile-bottom-nav";
import { ProductCard, ProductCardSkeleton, type MarketplaceProduct } from "@/components/marketplace/product-card";
import { api, apiErrorMessage } from "@/lib/api";
import { wishlist } from "@/lib/wishlist";

type ApiProduct = {
  id: number | string;
  name: string;
  price: number | string;
  image: string | null;
  stock: number | string;
  vendor_name?: string | null;
  has_variants?: boolean;
  default_variant_id?: number | null;
};

function adapt(raw: ApiProduct): MarketplaceProduct {
  return {
    id: Number(raw.id),
    name: raw.name,
    price: Number(raw.price),
    image: raw.image,
    vendor_name: raw.vendor_name ?? null,
    stock: Number(raw.stock),
    has_variants: !!raw.has_variants,
    default_variant_id: raw.default_variant_id ?? null,
  };
}

export default function WishlistPage() {
  const [ids, setIds] = useState<number[]>([]);
  const [items, setItems] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Keep the local id list in sync with the wishlist store. The initial read
  // runs post-mount (not as a lazy initializer) so the static-export HTML and
  // the client's first render agree — avoids a hydration mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: hydrate external store after mount
    setIds(wishlist.ids());
    return wishlist.subscribe(() => setIds(wishlist.ids()));
  }, []);

  // Fetch product details for each id. Re-runs when ids change so newly
  // removed/added items reflect immediately.
  useEffect(() => {
    let active = true;
    void (async () => {
      if (ids.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const results = await Promise.all(
          ids.map((id) =>
            api.get(`/public/products/${id}`)
              .then((r) => ({ id, product: r.data.data?.item as ApiProduct | undefined, gone: false }))
              // Only a 404 means the product is truly gone; treat network/other
              // errors as transient so we don't drop valid wishlist entries.
              .catch((e) => ({
                id,
                product: undefined as ApiProduct | undefined,
                gone: (e as { response?: { status?: number } })?.response?.status === 404,
              })),
          ),
        );
        if (!active) return;
        const products = results
          .map((r) => r.product)
          .filter((p): p is ApiProduct => !!p)
          .map(adapt);
        // Self-heal: prune ids whose product no longer exists so the header
        // badge can't get stuck counting dead entries (count 2, but 0 items).
        const goneIds = results.filter((r) => r.gone).map((r) => r.id);
        if (goneIds.length) goneIds.forEach((id) => wishlist.remove(id));
        setItems(products);
      } catch (err) {
        if (!active) return;
        toast.error(apiErrorMessage(err, "Couldn't load wishlist"));
        setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [ids]);

  function clearAll() {
    wishlist.clear();
    toast.success("Wishlist cleared");
  }

  return (
    <div className="marketplace-theme min-h-screen pb-24 md:pb-0">
      <TopInfoBar />
      <MarketplaceHeader cartCount={0} wishlistCount={ids.length} unreadCount={0} />

      <section className="mx-auto max-w-7xl px-4 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mk-text-muted)]">My favourites</p>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight md:text-2xl">
              <Heart className="h-5 w-5 fill-[var(--mk-brand)] text-[var(--mk-brand)]" /> Wishlist
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {!loading && (
              <p className="text-sm text-[var(--mk-text-muted)]">{items.length} item{items.length === 1 ? "" : "s"}</p>
            )}
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--mk-text)] hover:border-[var(--mk-brand)]/40 hover:text-[var(--mk-brand)]"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear all
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 pt-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: Math.min(8, Math.max(2, ids.length)) }).map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyWishlist />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>

      <MarketplaceFooter />
      <FloatingActions />
      <MarketplaceBottomNav />
    </div>
  );
}

function EmptyWishlist() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--mk-border)] bg-[var(--mk-surface)] p-12 text-center">
      <span className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--mk-brand-soft)] text-[var(--mk-brand)]">
        <Heart className="h-7 w-7" />
      </span>
      <p className="text-sm font-semibold">Your wishlist is empty</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--mk-text-muted)]">
        Tap the heart on any product to save it here for later.
      </p>
      <Link
        href="/shop-public"
        className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--mk-brand)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--mk-shadow-sm)] hover:bg-[var(--mk-brand-deep)]"
      >
        <ShoppingBag className="h-4 w-4" /> Browse shop
      </Link>
    </div>
  );
}
