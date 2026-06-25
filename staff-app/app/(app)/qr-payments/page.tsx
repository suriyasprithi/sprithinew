"use client";

import { useEffect, useState } from "react";
import { Banknote, QrCode } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/data-table/empty-state";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";

type Row = {
  id: number;
  total: number | string | null;
  status: string;
  updated_at: string | null;
  created_at: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  product_names: string | null;
};

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export default function QrPaymentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/orders/qr-payments");
        setRows((res.data.data?.items ?? []) as Row[]);
      } catch (e) {
        toast.error(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const total = rows.reduce((s, r) => s + Number(r.total ?? 0), 0);

  return (
    <>
      <MobileHeader title="QR Payments" />
      <section className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Payments"
          icon={QrCode}
          title="QR Payments"
          description="Orders a customer paid by scanning your QR at delivery. The amount is credited to your QR wallet."
        />

        {!loading && rows.length > 0 && (
          <div className="luxe-card flex items-center justify-between p-4">
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Banknote className="h-4 w-4 text-emerald-500" /> Total received via QR</span>
            <span className="text-lg font-bold text-emerald-600">{fmtINR(total)}</span>
          </div>
        )}

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[90px_1fr_140px_150px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Order</span><span>Customer / items</span><span className="text-right">Amount</span><span className="text-right">Paid</span>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={QrCode} title="No QR payments yet" description="When a customer pays an order by scanning your QR, it appears here." />
          ) : (
            <div className="divide-y divide-border">
              {rows.map((r) => (
                <div key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 md:grid-cols-[90px_1fr_140px_150px]">
                  <p className="font-mono text-xs text-muted-foreground md:order-1">#{r.id}</p>
                  <div className="min-w-0 md:order-2">
                    <p className="truncate text-sm font-semibold">{r.customer_name || "—"}{r.customer_mobile ? ` · ${r.customer_mobile}` : ""}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.product_names || "—"}</p>
                  </div>
                  <p className="text-right text-sm font-bold text-emerald-600 md:order-3">{fmtINR(Number(r.total ?? 0))}</p>
                  <span className="hidden text-right text-xs text-muted-foreground md:order-4 md:block">{(r.updated_at ?? r.created_at ?? "").replace("T", " ").slice(0, 16) || "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
