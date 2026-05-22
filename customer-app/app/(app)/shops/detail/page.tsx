"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, ShoppingCart, Store } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { ProductImage } from "@/components/ui/custom/product-image";
import { api, apiErrorMessage } from "@/lib/api";

type Shop = { id: number; name: string; shop_name: string; area: string; pincode: string; address: string; image: string; product_count: number };
type Product = { id: number; name: string; price: number; stock: number; image: string | null; vendor_name: string | null; category_name: string | null; has_variants: boolean };

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default function ShopDetailPage() {
  return (
    <Suspense fallback={<><AppHeader title="Shop" /><div className="flex items-center justify-center p-10 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div></>}>
      <ShopDetailInner />
    </Suspense>
  );
}

function ShopDetailInner() {
  const sp = useSearchParams();
  const id = sp?.get("id") ?? "";
  const router = useRouter();
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    void (async () => {
      try {
        const res = await api.get(`/catalog/shops/${id}`);
        setShop((res.data.data?.shop ?? null) as Shop | null);
        setProducts((res.data.data?.products ?? []) as Product[]);
      } catch (e) { toast.error(apiErrorMessage(e)); } finally { setLoading(false); }
    })();
  }, [id]);

  async function add(p: Product) {
    if (p.has_variants) {
      router.push(`/product?id=${p.id}`);
      return;
    }
    try {
      await api.post("/cart/add", { product_id: p.id, qty: 1 });
      toast.success(`${p.name} added`);
    } catch (e) { toast.error(apiErrorMessage(e)); }
  }

  if (loading) return <><AppHeader title="Shop" /><div className="flex items-center justify-center p-10 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div></>;
  if (!shop) return <><AppHeader title="Shop" /><div className="p-10 text-center text-sm text-muted-foreground">Shop not found.</div></>;

  return (
    <>
      <AppHeader title={shop.name} />
      <section className="mx-auto max-w-md space-y-4 p-4 pb-24 md:max-w-4xl md:p-8">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <LuxuryCard hoverLift={false} className="flex items-center gap-3 p-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-xl brand-gradient text-brand-foreground brand-glow">
              <Store className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold">{shop.name}</p>
              <p className="truncate text-xs text-muted-foreground">{shop.area}{shop.pincode ? ` · ${shop.pincode}` : ""}</p>
            </div>
            <span className="ml-auto rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand">
              {shop.product_count} items
            </span>
          </LuxuryCard>
        </motion.div>

        {products.length === 0 ? (
          <LuxuryCard hoverLift={false} className="p-10 text-center text-sm text-muted-foreground">No products listed.</LuxuryCard>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                <LuxuryCard className="overflow-hidden">
                  <div className="aspect-square overflow-hidden">
                    <ProductImage src={p.image} alt={p.name} className="transition-transform hover:scale-105" />
                  </div>
                  <div className="space-y-2 p-3">
                    <Link href={`/product?id=${p.id}`} className="line-clamp-2 text-sm font-semibold hover:text-brand">{p.name}</Link>
                    <p className="text-base font-bold text-brand">{fmtINR(p.price)}{p.has_variants ? "+" : ""}</p>
                    <button
                      onClick={() => void add(p)}
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
