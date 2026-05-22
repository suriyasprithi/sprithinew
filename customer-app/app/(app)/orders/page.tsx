"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, MapPin, ShoppingBag, Store } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { api, apiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";

type OrderRow = {
  id: number;
  customer_id: number;
  vendor_id: number | null;
  total: number | string;
  status: OrderStatus;
  notes?: string | null;
  created_at?: string | null;
  vendor_name?: string | null;
  shop_name?: string | null;
  area?: string | null;
  pincode?: string | null;
  taluk_name?: string | null;
  district_name?: string | null;
};

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending:   "bg-amber-500/10 text-amber-400 border-amber-500/30",
  paid:      "bg-sky-500/10 text-sky-400 border-sky-500/30",
  shipped:   "bg-violet-500/10 text-violet-400 border-violet-500/30",
  delivered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  cancelled: "bg-rose-500/10 text-rose-400 border-rose-500/30",
};

export default function OrdersPage() {
  const [items, setItems] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/orders/mine");
        setItems((res.data.data?.items ?? []) as OrderRow[]);
      } catch (e) {
        toast.error(apiErrorMessage(e));
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <AppHeader title="Orders" />
      <section className="mx-auto max-w-md space-y-3 p-4 pb-24 md:max-w-3xl md:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
        ) : items.length === 0 ? (
          <LuxuryCard hoverLift={false} className="p-10 text-center">
            <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-brand" />
            <p className="text-sm font-medium">No orders yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Orders you place will show up here.</p>
          </LuxuryCard>
        ) : (
          items.map((o, i) => {
            const vendorLabel = o.shop_name || o.vendor_name || "—";
            const areaParts = [o.area, o.taluk_name, o.pincode].filter(Boolean) as string[];
            return (
              <motion.div key={o.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <LuxuryCard className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Order #{o.id}</p>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase", STATUS_STYLE[o.status] ?? STATUS_STYLE.pending)}>{o.status}</span>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <Store className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{vendorLabel}</p>
                      {areaParts.length > 0 && (
                        <p className="inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {areaParts.join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground">{(o.created_at ?? "").replace("T", " ").slice(0, 16)}</p>
                    <p className="text-lg font-bold text-brand">{fmtINR(Number(o.total))}</p>
                  </div>
                </LuxuryCard>
              </motion.div>
            );
          })
        )}
      </section>
    </>
  );
}
