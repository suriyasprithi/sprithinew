"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Package, RotateCcw, Store, MapPin, User } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { api, apiErrorMessage } from "@/lib/api";

type Meta = {
  shop: string | null;
  taluk: string | null;
  customer_name: string | null;
  customer_mobile: string | null; // masked, e.g. 98******76
};

type Item = {
  id: number;
  amount: number;
  direction: "credit" | "debit";
  type: string;
  reference: string | null;
  notes: string;
  created_at: string;
  meta?: Meta | null;
};

type Payload = {
  wallet: string;
  balance: number;
  total_credit: number;
  total_debit: number;
  items: Item[];
};

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

function fmtDateTime(s: string): string {
  if (!s) return "—";
  const d = new Date(s.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// "order#123" → "Order #123", "qr#45" → "QR #45".
function orderNo(ref: string | null): string | null {
  if (!ref) return null;
  const m = ref.match(/(order|qr)#(\d+)/i);
  if (!m) return ref;
  return `${m[1].toLowerCase() === "qr" ? "QR" : "Order"} #${m[2]}`;
}

export default function BuybackOrdersPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/wallet/history", { params: { wallet: "buyback" } });
        setData(res.data.data as Payload);
      } catch (e) {
        toast.error(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const items = data?.items ?? [];

  return (
    <>
      <AppHeader title="Buyback Orders" />
      <section className="mx-auto max-w-md space-y-4 p-4 pb-24 md:max-w-3xl md:p-8">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <LuxuryCard glow hoverLift={false} className="relative overflow-hidden p-6 brand-gradient text-brand-foreground">
            <div className="absolute inset-0 brand-gradient-soft opacity-40" />
            <div className="relative space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider opacity-80">Buyback wallet</p>
                <RotateCcw className="h-5 w-5 opacity-80" />
              </div>
              <p className="text-3xl font-bold tracking-tight">{fmtINR(data?.balance ?? 0)}</p>
              <p className="text-xs opacity-80">Earned from the buyback orders below</p>
            </div>
          </LuxuryCard>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <LuxuryCard hoverLift={false} className="p-10 text-center">
            <RotateCcw className="mx-auto mb-3 h-10 w-10 text-brand" />
            <p className="text-sm font-medium">No buyback orders yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              When a buyback credit reaches you, the order details show up here.
            </p>
          </LuxuryCard>
        ) : (
          <div className="space-y-2">
            {items.map((it, i) => (
              <motion.div key={it.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <LuxuryCard className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-sm font-semibold">
                      <Package className="h-4 w-4 text-brand" /> {orderNo(it.reference) ?? "Buyback credit"}
                    </p>
                    <p className="shrink-0 text-sm font-bold text-emerald-500">+{fmtINR(it.amount)}</p>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {it.meta?.shop && (
                      <p className="flex items-center gap-1.5"><Store className="h-3.5 w-3.5 shrink-0" /> <span className="font-medium text-foreground">{it.meta.shop}</span></p>
                    )}
                    {it.meta?.taluk && (
                      <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" /> {it.meta.taluk}</p>
                    )}
                    {it.meta?.customer_name && (
                      <p className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 shrink-0" /> {it.meta.customer_name}{it.meta.customer_mobile ? ` · ${it.meta.customer_mobile}` : ""}</p>
                    )}
                    <p>{fmtDateTime(it.created_at)}</p>
                  </div>
                </LuxuryCard>
              </motion.div>
            ))}
          </div>
        )}

        <Link
          href="/wallet"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-2/40 px-4 py-3 text-sm font-medium text-muted-foreground hover:border-brand/40 hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" /> Back to wallet
        </Link>
      </section>
    </>
  );
}
