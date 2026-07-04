"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Minus, Plus, ShoppingCart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ProductImage } from "@/components/ui/custom/product-image";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { api, apiErrorMessage } from "@/lib/api";
import { cartBadge } from "@/lib/cart";
import { useAuth } from "@/stores/auth";
import { cn } from "@/lib/utils";

type Product = {
  id: number; name: string; description: string | null; price: number; stock: number;
  image: string | null; vendor_name: string | null; category_name: string | null;
  sub_category_name?: string | null; has_variants: boolean; old_price?: number | null;
};
type Variant = {
  id: number; name: string; price: number; stock: number;
  sku?: string | null; mrp?: number | null; image?: string | null; options?: Record<string, string>;
};
type VType = { name: string; options: string[] };
type VariantImages = Record<string, Record<string, string[]>>;

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

function matchVariant(variants: Variant[], picks: Record<string, string>): Variant | undefined {
  return variants.find((v) => {
    const opts = v.options ?? {};
    for (const k of Object.keys(picks)) if (opts[k] !== picks[k]) return false;
    return Object.keys(opts).length === Object.keys(picks).length;
  });
}
function isOptionAvailable(variants: Variant[], _picks: Record<string, string>, axis: string, value: string): boolean {
  return variants.some((v) => (v.stock ?? 0) > 0 && (v.options ?? {})[axis] === value);
}
function pickValue(variants: Variant[], picks: Record<string, string>, axis: string, value: string): Record<string, string> {
  const candidates = variants
    .filter((v) => (v.options ?? {})[axis] === value && (v.stock ?? 0) > 0)
    .map((v) => {
      const opts = v.options ?? {};
      let score = 0;
      for (const k of Object.keys(picks)) if (k !== axis && opts[k] === picks[k]) score++;
      return { v, score };
    })
    .sort((a, b) => b.score - a.score || (b.v.stock ?? 0) - (a.v.stock ?? 0));
  if (candidates.length === 0) return { ...picks, [axis]: value };
  return { ...(candidates[0].v.options ?? {}) };
}

/**
 * In-page product detail for the browse shop view. Same data + interactions as
 * the /product-public page (image + variant gallery, variant chips, price/MRP,
 * add-to-cart) but rendered inline so the shop context (left rail) is kept.
 */
export function ProductQuickView({ productId, onClose }: { productId: number; onClose: () => void }) {
  const router = useRouter();
  const { user, isHydrated } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantTypes, setVariantTypes] = useState<VType[]>([]);
  const [variantImages, setVariantImages] = useState<VariantImages>({});
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [imgIndex, setImgIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setProduct(null); setQty(1); setImgIndex(0);
    void (async () => {
      try {
        const res = await api.get(`/public/products/${productId}`);
        if (cancelled) return;
        const p = res.data.data?.item as Product;
        const vs = (res.data.data?.variants ?? []) as Variant[];
        const vt = (res.data.data?.variant_types ?? []) as VType[];
        const vi = (res.data.data?.variant_images ?? {}) as VariantImages;
        if (!p) { toast.error("Not found"); onClose(); return; }
        setProduct(p); setVariants(vs); setVariantTypes(vt); setVariantImages(vi);
        const seed = vs.find((v) => (v.stock ?? 0) > 0) ?? vs[0];
        setPicks(seed?.options ? { ...seed.options } : {});
      } catch (e) {
        if (!cancelled) { toast.error(apiErrorMessage(e)); onClose(); }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [productId, onClose]);

  useEffect(() => { setImgIndex(0); }, [picks]);

  const selectedVariant = variantTypes.length > 0 ? matchVariant(variants, picks) : undefined;
  const price = selectedVariant?.price ?? product?.price ?? 0;
  const stock = selectedVariant?.stock ?? product?.stock ?? 0;
  const oldPrice = selectedVariant
    ? (selectedVariant.mrp != null && selectedVariant.mrp > selectedVariant.price ? selectedVariant.mrp : null)
    : (product?.old_price != null && product.old_price > price ? product.old_price : null);
  const off = oldPrice && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;

  let variantGallery: string[] = [];
  for (const t of variantTypes) {
    const opt = picks[t.name];
    if (!opt) continue;
    const list = variantImages[t.name]?.[opt];
    if (list && list.length) { variantGallery = list; break; }
  }
  const heroSrc = variantGallery.length > 0
    ? (variantGallery[Math.min(imgIndex, variantGallery.length - 1)] ?? variantGallery[0])
    : (selectedVariant?.image || product?.image || null);

  async function add() {
    if (!product) return;
    if (variantTypes.length > 0 && !selectedVariant) { toast.error("Pick all variant options first"); return; }
    const returnTo = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/browse";
    if (isHydrated && !user) {
      toast.message("Sign in to add items to your cart");
      router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    try {
      await api.post("/cart/add", { product_id: product.id, variation_id: selectedVariant?.id ?? undefined, qty });
      cartBadge.bump(qty);
      toast.success("Added to cart");
      router.push("/cart");
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        toast.message("Sign in to add items to your cart");
        router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      toast.error(apiErrorMessage(e));
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClose}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--mk-brand-deep)] hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to products
      </button>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-16 text-sm text-[var(--mk-text-muted)]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !product ? null : (
        <div className="grid gap-6 rounded-2xl border border-[var(--mk-border)] bg-[var(--mk-surface)] p-4 md:grid-cols-2 md:p-6">
          {/* IMAGE + variant gallery thumbnails */}
          <div>
            <div className="aspect-square w-full overflow-hidden rounded-xl bg-[var(--mk-surface-2)]">
              <ProductImage src={heroSrc} alt={product.name} eager />
            </div>
            {variantGallery.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {variantGallery.map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setImgIndex(i)}
                    className={cn(
                      "h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                      i === Math.min(imgIndex, variantGallery.length - 1) ? "border-[var(--mk-brand)]" : "border-[var(--mk-border)]",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Thumbnail ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* INFO */}
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{product.name}</h2>
              {(product.vendor_name || product.category_name) && (
                <p className="mt-1 text-xs text-[var(--mk-text-muted)]">
                  {product.vendor_name}{product.vendor_name && product.category_name ? " · " : ""}{product.category_name}
                  {product.sub_category_name ? ` › ${product.sub_category_name}` : ""}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <p className="text-3xl font-bold text-[var(--mk-brand)]">{fmtINR(price)}</p>
                {oldPrice && oldPrice > price && (
                  <>
                    <span className="text-lg text-[var(--mk-text-muted)] line-through">{fmtINR(oldPrice)}</span>
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">{off}% OFF</span>
                  </>
                )}
              </div>
              <p className="mt-1 text-xs text-[var(--mk-text-muted)]">Stock: {stock}</p>
            </div>

            {product.description?.trim() && product.description.trim() !== "0" && (
              <p className="text-sm text-[var(--mk-text-muted)]">{product.description}</p>
            )}

            {variantTypes.map((t) => (
              <div key={t.name}>
                <p className="mb-2 text-xs uppercase tracking-wider text-[var(--mk-text-muted)]">{t.name}</p>
                <div className="flex flex-wrap gap-2">
                  {t.options.map((opt) => {
                    const isPicked = picks[t.name] === opt;
                    const available = isOptionAvailable(variants, picks, t.name, opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setPicks((p) => pickValue(variants, p, t.name, opt))}
                        disabled={!available && !isPicked}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm transition-colors",
                          isPicked
                            ? "border-[var(--mk-brand)] bg-[var(--mk-brand)]/10 text-[var(--mk-brand-deep)]"
                            : available
                              ? "border-[var(--mk-border)] bg-[var(--mk-surface)] hover:border-[var(--mk-brand)]/40"
                              : "cursor-not-allowed border-[var(--mk-border)] bg-[var(--mk-surface)] text-[var(--mk-text-muted)] line-through opacity-50",
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {variantTypes.length > 0 && selectedVariant?.sku && (
              <p className="text-[11px] text-[var(--mk-text-muted)]">SKU: <span className="font-mono">{selectedVariant.sku}</span></p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <div className="flex items-center rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface-2)]">
                <button className="px-3 py-2 hover:text-[var(--mk-brand)]" onClick={() => setQty(Math.max(1, qty - 1))}><Minus className="h-4 w-4" /></button>
                <span className="px-3 font-medium">{qty}</span>
                <button className="px-3 py-2 hover:text-[var(--mk-brand)]" onClick={() => setQty(Math.min(Math.max(1, stock), qty + 1))}><Plus className="h-4 w-4" /></button>
              </div>
              <GradientButton size="lg" className="flex-1" disabled={stock === 0 || (variantTypes.length > 0 && !selectedVariant)} onClick={() => void add()}>
                <ShoppingCart className="h-4 w-4" /> {stock === 0 ? "Out of stock" : `Add · ${fmtINR(price * qty)}`}
              </GradientButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
