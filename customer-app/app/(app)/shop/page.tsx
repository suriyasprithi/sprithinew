"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { AppHeader } from "@/components/layout/app-header";
import { CardGridSkeleton } from "@/components/skeletons";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { ProductImage } from "@/components/ui/custom/product-image";
import { api, apiErrorMessage } from "@/lib/api";
import { cartBadge } from "@/lib/cart";
import { useRouter } from "next/navigation";

type Product = {
  id: number; name: string; description: string | null; price: number; stock: number;
  image: string | null; category_id: number | null; vendor_id: number | null;
  vendor_name: string | null; category_name: string | null; has_variants: boolean;
  min_price?: number; max_price?: number;
};
type Category = { id: number; name: string };

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

export default function ShopPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (q) params.q = q;
      if (activeCat) params.category_id = activeCat;
      const res = await api.get("/catalog/products", { params });
      setProducts((res.data.data?.items ?? []) as Product[]);
      setCategories((res.data.data?.categories ?? []) as Category[]);
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeCat]);

  async function addToCart(p: Product) {
    // Products with variants must be added from the product detail page where
    // the customer can pick a variant.
    if (p.has_variants) {
      router.push(`/product?id=${p.id}`);
      return;
    }
    try {
      await api.post("/cart/add", { product_id: p.id, qty: 1 });
      cartBadge.bump(1);
      toast.success(`${p.name} added to cart`);
    } catch (e) { toast.error(apiErrorMessage(e)); }
  }

  return (
    <>
      <AppHeader title="Shop" />
      <section className="mx-auto max-w-md space-y-4 p-4 pb-24 md:max-w-6xl md:p-8">
        <div className="glass rounded-2xl p-3">
          <form onSubmit={(e) => { e.preventDefault(); void load(); }} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
            </div>
            <GradientButton type="submit">Search</GradientButton>
          </form>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveCat(null)}
            className={"shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors " +
              (activeCat == null ? "border-brand bg-brand text-brand-foreground" : "border-border bg-surface hover:border-brand/40")}
          >All</button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={"shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors " +
                (activeCat === c.id ? "border-brand bg-brand text-brand-foreground" : "border-border bg-surface hover:border-brand/40")}
            >{c.name}</button>
          ))}
        </div>

        {loading ? (
          <CardGridSkeleton />
        ) : products.length === 0 ? (
          <LuxuryCard hoverLift={false} className="p-10 text-center text-sm text-muted-foreground">No products found.</LuxuryCard>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                <LuxuryCard className="overflow-hidden">
                  <div className="aspect-square overflow-hidden">
                    <ProductImage src={p.image} alt={p.name} className="transition-transform hover:scale-105" />
                  </div>
                  <div className="space-y-2 p-3">
                    <Link href={`/product?id=${p.id}`} className="line-clamp-2 text-sm font-semibold hover:text-brand">
                      {p.name}
                    </Link>
                    {p.vendor_name && <p className="text-[10px] text-muted-foreground">{p.vendor_name}</p>}
                    <p className="text-base font-bold text-brand">
                      {p.has_variants && p.min_price != null && p.max_price != null && p.min_price !== p.max_price
                        ? `${fmtINR(p.min_price)} – ${fmtINR(p.max_price)}`
                        : `${fmtINR(p.price)}${p.has_variants ? "+" : ""}`}
                    </p>
                    <button
                      onClick={() => void addToCart(p)}
                      disabled={p.stock === 0}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg brand-gradient py-1.5 text-xs font-medium text-brand-foreground disabled:opacity-50"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" /> Add
                    </button>
                  </div>
                </LuxuryCard>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
