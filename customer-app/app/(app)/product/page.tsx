"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, ShoppingCart, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { ProductImage } from "@/components/ui/custom/product-image";
import { api, apiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

type AttrValue = string | number | boolean | string[] | null;
type Product = {
  id: number; name: string; description: string | null; price: number; stock: number;
  image: string | null; vendor_name: string | null; category_name: string | null;
  has_variants: boolean;
  attributes?: Record<string, AttrValue> | null;
};
type Variant = {
  id: number; name: string; price: number; stock: number;
  sku?: string | null;
  options?: Record<string, string>;
};
type VType = { name: string; options: string[] };
type VariantImages = Record<string, Record<string, string[]>>;
type AttributeField = {
  key: string; label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "toggle" | "image" | "color";
  unit?: string; options?: string[]; required?: boolean; placeholder?: string;
};

function matchVariant(variants: Variant[], picks: Record<string, string>): Variant | undefined {
  return variants.find((v) => {
    const opts = v.options ?? {};
    for (const k of Object.keys(picks)) {
      if (opts[k] !== picks[k]) return false;
    }
    return Object.keys(opts).length === Object.keys(picks).length;
  });
}

// Is at least one in-stock variant compatible with the customer trying axis=value
// alongside their other current picks (excluding this axis)?
function isOptionAvailable(variants: Variant[], picks: Record<string, string>, axis: string, value: string): boolean {
  return variants.some((v) => {
    if ((v.stock ?? 0) <= 0) return false;
    const opts = v.options ?? {};
    if (opts[axis] !== value) return false;
    for (const k of Object.keys(picks)) {
      if (k === axis) continue;
      if (opts[k] !== picks[k]) return false;
    }
    return true;
  });
}

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function ProductInner() {
  const search = useSearchParams();
  const router = useRouter();
  const id = Number(search.get("id") || 0);

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantTypes, setVariantTypes] = useState<VType[]>([]);
  const [variantImages, setVariantImages] = useState<VariantImages>({});
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [imgIndex, setImgIndex] = useState(0);
  const [schema, setSchema] = useState<AttributeField[]>([]);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const res = await api.get(`/catalog/products/${id}`);
        const p = res.data.data?.item as Product;
        const vs = (res.data.data?.variants ?? []) as Variant[];
        const vt = (res.data.data?.variant_types ?? []) as VType[];
        const vi = (res.data.data?.variant_images ?? {}) as VariantImages;
        const sc = (res.data.data?.attribute_schema ?? []) as AttributeField[];
        if (!p) { toast.error("Not found"); router.replace("/shop"); return; }
        setProduct(p); setVariants(vs); setVariantTypes(vt); setVariantImages(vi); setSchema(sc);
        // Auto-pick the first in-stock variant's options (fall back to first variant if none in stock).
        const seed = vs.find((v) => (v.stock ?? 0) > 0) ?? vs[0];
        if (seed?.options) setPicks({ ...seed.options });
      } catch (e) {
        toast.error(apiErrorMessage(e));
        router.replace("/shop");
      } finally { setLoading(false); }
    })();
  }, [id, router]);

  useEffect(() => { setImgIndex(0); }, [picks]);

  const selectedVariant = variantTypes.length > 0 ? matchVariant(variants, picks) : undefined;
  const price = selectedVariant?.price ?? product?.price ?? 0;
  const stock = selectedVariant?.stock ?? product?.stock ?? 0;

  async function add() {
    if (!product) return;
    if (variantTypes.length > 0 && !selectedVariant) {
      toast.error("Pick all variant options first");
      return;
    }
    try {
      await api.post("/cart/add", {
        product_id: product.id,
        variation_id: selectedVariant?.id ?? undefined,
        qty,
      });
      toast.success("Added to cart");
      router.push("/cart");
    } catch (e) { toast.error(apiErrorMessage(e)); }
  }

  if (loading) {
    return <><AppHeader title="Product" /><section className="mx-auto flex max-w-md items-center justify-center p-8 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</section></>;
  }
  if (!product) return null;

  const attrs = (product.attributes ?? {}) as Record<string, AttrValue>;
  // Walk the schema first so labels + types are preserved; fall back to raw keys for anything not in schema.
  const knownKeys = new Set(schema.map((f) => f.key));
  const hasValue = (v: AttrValue) =>
    v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
  const orderedEntries: Array<{ field?: AttributeField; key: string; value: AttrValue }> = [
    ...schema
      .filter((f) => hasValue(attrs[f.key]))
      .map((f) => ({ field: f, key: f.key, value: attrs[f.key] })),
    ...Object.entries(attrs)
      .filter(([k, v]) => !knownKeys.has(k) && hasValue(v))
      .map(([k, v]) => ({ key: k, value: v })),
  ];
  const imageEntries  = orderedEntries.filter((e) => e.field?.type === "image" && typeof e.value === "string");
  const detailEntries = orderedEntries.filter((e) => e.field?.type !== "image");

  // Pick the first axis (in declared order) that has images for the currently-picked option.
  const variantGallery: string[] = (() => {
    for (const t of variantTypes) {
      const opt = picks[t.name];
      if (!opt) continue;
      const list = variantImages[t.name]?.[opt];
      if (list && list.length) return list;
    }
    return [];
  })();
  const heroSrc = variantGallery.length > 0
    ? (variantGallery[Math.min(imgIndex, variantGallery.length - 1)] ?? variantGallery[0])
    : product.image;

  return (
    <>
      <AppHeader title={product.name} />
      <section className="mx-auto max-w-md space-y-5 p-4 pb-24 md:max-w-3xl md:p-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <LuxuryCard hoverLift={false} className="overflow-hidden">
            <div className="aspect-video overflow-hidden rounded-xl">
              <ProductImage src={heroSrc} alt={product.name} />
            </div>
          </LuxuryCard>
          {variantGallery.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {variantGallery.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setImgIndex(i)}
                  className={cn(
                    "h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                    i === Math.min(imgIndex, variantGallery.length - 1) ? "border-brand" : "border-border",
                  )}
                >
                  <img src={src} alt={`Thumbnail ${i + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </motion.div>

        <div>
          <h2 className="text-2xl font-bold tracking-tight">{product.name}</h2>
          {(product.vendor_name || product.category_name) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {product.vendor_name}{product.vendor_name && product.category_name ? " · " : ""}{product.category_name}
            </p>
          )}
          <p className="mt-3 text-3xl font-bold text-brand">{fmtINR(price)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Stock: {stock}</p>
        </div>

        {product.description && <p className="text-sm text-muted-foreground">{product.description}</p>}

        {variantTypes.length > 0 && variantTypes.map((t) => (
          <div key={t.name}>
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{t.name}</p>
            <div className="flex flex-wrap gap-2">
              {t.options.map((opt) => {
                const isPicked = picks[t.name] === opt;
                const available = isOptionAvailable(variants, picks, t.name, opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPicks((p) => ({ ...p, [t.name]: opt }))}
                    disabled={!available && !isPicked}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      isPicked
                        ? "border-brand bg-brand/10 text-brand brand-glow"
                        : available
                          ? "border-border bg-surface hover:border-brand/40"
                          : "cursor-not-allowed border-border bg-surface text-muted-foreground line-through opacity-50",
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
          <p className="text-[11px] text-muted-foreground">
            SKU: <span className="font-mono">{selectedVariant.sku}</span>
          </p>
        )}

        {imageEntries.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Gallery</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {imageEntries.map((e) => (
                <LuxuryCard key={e.key} hoverLift={false} className="overflow-hidden">
                  <div className="aspect-square">
                    <img src={String(e.value)} alt={e.field?.label ?? e.key} className="h-full w-full object-cover" />
                  </div>
                  {e.field?.label && <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{e.field.label}</p>}
                </LuxuryCard>
              ))}
            </div>
          </div>
        )}

        {detailEntries.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Specifications</p>
            <LuxuryCard hoverLift={false} className="divide-y divide-border text-sm">
              {detailEntries.map((e) => {
                const label = e.field?.label ?? e.key;
                let display: string;
                if (Array.isArray(e.value)) display = e.value.join(", ");
                else if (e.field?.type === "toggle") display = e.value ? "Yes" : "No";
                else if (e.field?.type === "number" && e.field.unit) display = `${e.value} ${e.field.unit}`;
                else display = String(e.value);
                return (
                  <div key={e.key} className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-right font-medium">{display}</span>
                  </div>
                );
              })}
            </LuxuryCard>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-border bg-surface-2/40">
            <button className="px-3 py-2 text-lg hover:text-brand" onClick={() => setQty(Math.max(1, qty - 1))}><Minus className="h-4 w-4" /></button>
            <span className="px-3 font-medium">{qty}</span>
            <button className="px-3 py-2 text-lg hover:text-brand" onClick={() => setQty(Math.min(stock, qty + 1))}><Plus className="h-4 w-4" /></button>
          </div>
          <GradientButton size="lg" className="flex-1" disabled={stock === 0 || (variantTypes.length > 0 && !selectedVariant)} onClick={() => void add()}>
            <ShoppingCart className="h-4 w-4" /> {stock === 0 ? "Out of stock" : `Add · ${fmtINR(price * qty)}`}
          </GradientButton>
        </div>
      </section>
    </>
  );
}

export default function ProductDetailPage() {
  return <Suspense fallback={null}><ProductInner /></Suspense>;
}
