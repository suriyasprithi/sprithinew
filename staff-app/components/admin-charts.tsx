"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatGridSkeleton } from "@/components/skeletons";
import { api, apiErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import { UserPlus, Store, ShoppingCart, Banknote, CreditCard, Wallet, MessageSquare } from "lucide-react";

type Stats = {
  totals: {
    customers: number; vendors: number; orders: number; revenue: number;
    pending_payments: number; pending_withdrawals: number; pending_support: number;
  };
  orders_series: { date: string; orders: number; revenue: number }[];
  customers_series: { month: string; count: number }[];
};

const formatCurrency = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export function AdminCharts() {
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const r = await api.get("/admin/stats"); setData(r.data.data as Stats); }
      catch (err) { toast.error(apiErrorMessage(err)); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <StatGridSkeleton count={6} />;
  if (!data) return null;

  const t = data.totals;
  const tiles = [
    { label: "Customers",          value: String(t.customers),         icon: UserPlus,    color: "bg-blue-100 text-blue-700" },
    { label: "Vendors",            value: String(t.vendors),           icon: Store,       color: "bg-emerald-100 text-emerald-700" },
    { label: "Orders",             value: String(t.orders),            icon: ShoppingCart,color: "bg-orange-100 text-orange-700" },
    { label: "Revenue",            value: formatCurrency(t.revenue),   icon: Banknote,    color: "bg-violet-100 text-violet-700" },
    { label: "Pending payments",   value: String(t.pending_payments),  icon: CreditCard,  color: "bg-pink-100 text-pink-700" },
    { label: "Pending withdrawals",value: String(t.pending_withdrawals),icon: Wallet,     color: "bg-amber-100 text-amber-700" },
    { label: "Open tickets",       value: String(t.pending_support),   icon: MessageSquare, color: "bg-cyan-100 text-cyan-700" },
  ];

  const maxOrders = Math.max(1, ...data.orders_series.map((p) => p.orders));
  const maxCustomers = Math.max(1, ...data.customers_series.map((p) => p.count));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {tiles.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="space-y-2 p-4">
                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${s.color}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-semibold">{s.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Orders — last 14 days</CardTitle></CardHeader>
          <CardContent>
            <div className="flex h-32 items-end gap-1">
              {data.orders_series.map((p) => (
                <div key={p.date} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-blue-500"
                    style={{ height: `${(p.orders / maxOrders) * 100}%`, minHeight: "2px" }}
                    title={`${p.date}: ${p.orders} orders`}
                  />
                  <span className="text-[8px] text-muted-foreground">{p.date.slice(8)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">New customers — last 6 months</CardTitle></CardHeader>
          <CardContent>
            <div className="flex h-32 items-end gap-2">
              {data.customers_series.map((p) => (
                <div key={p.month} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-emerald-500"
                    style={{ height: `${(p.count / maxCustomers) * 100}%`, minHeight: "2px" }}
                    title={`${p.month}: ${p.count}`}
                  />
                  <span className="text-[10px] text-muted-foreground">{p.month.slice(5)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
