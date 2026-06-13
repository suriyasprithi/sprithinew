"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, QrCode, Share2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";

const fmtINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

type QrPurchase = {
  id: number;
  total: number | string;
  created_at: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  source: "qr" | "entered";
};

/**
 * Vendor QR display. Encodes the vendor's mobile_number so the customer-app's
 * QR scanner can read it and POST /purchase/qr to settle the order.
 */
export default function QrScannerPage() {
  const { user } = useAuth();
  const mobile = user?.mobile_number ?? "";
  const name   = user?.name ?? "Vendor";

  const [purchases, setPurchases] = useState<QrPurchase[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/purchase/mine");
        setPurchases((res.data.data?.items ?? []) as QrPurchase[]);
      } catch {
        setPurchases([]);
      } finally {
        setLoadingPurchases(false);
      }
    })();
  }, []);

  // QR payload: just the mobile number. Customer-app's /qr endpoint already
  // accepts `vendor_mobile` so plain digits keep it forward-compatible.
  const qrSrc = useMemo(() => {
    if (!mobile) return "";
    const data = encodeURIComponent(mobile);
    return `https://api.qrserver.com/v1/create-qr-code/?size=480x480&qzone=2&data=${data}`;
  }, [mobile]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(mobile);
      toast.success("Mobile number copied");
    } catch { toast.error("Couldn't copy"); }
  }

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `${name} — Pay via SPRITHI`, text: `Pay ${name} on SPRITHI`, url: qrSrc });
      } catch { /* user dismissed */ }
    } else {
      void copy();
    }
  }

  return (
    <>
      <MobileHeader title="QR Scanner" />
      <section className="mx-auto max-w-md space-y-5 p-4 pb-24 md:p-8">
        <PageHeader
          eyebrow="Payments"
          icon={QrCode}
          title="Your shop QR"
          description="Let customers scan this to pay in-store. They open the SPRITHI customer app → Scan → camera, then point at this code."
        />

        {!mobile ? (
          <LuxuryCard hoverLift={false} className="p-8 text-center text-sm text-muted-foreground">
            Sign in to see your QR.
          </LuxuryCard>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <LuxuryCard hoverLift={false} className="space-y-5 p-6">
              <div className="flex items-center justify-center">
                <div className="rounded-2xl border border-border bg-white p-3 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrSrc} alt={`${name} payment QR`} className="h-64 w-64 md:h-72 md:w-72" />
                </div>
              </div>

              <div className="text-center">
                <p className="text-base font-semibold">{name}</p>
                <button onClick={() => void copy()} className="mt-1 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-brand" type="button">
                  {mobile}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-11 rounded-xl" onClick={() => void share()}>
                  <Share2 className="h-4 w-4" /> Share
                </Button>
                <a
                  href={qrSrc}
                  download={`sprithi-${mobile}.png`}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-input bg-background text-sm font-medium transition-colors hover:bg-accent"
                >
                  <Download className="h-4 w-4" /> Download
                </a>
              </div>
            </LuxuryCard>
          </motion.div>
        )}

        <LuxuryCard hoverLift={false} className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Recent QR purchases</p>
            {purchases.length > 0 && (
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">{purchases.length}</span>
            )}
          </div>
          {loadingPurchases ? (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          ) : purchases.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">No purchases yet. They'll appear here when a customer pays via your QR.</p>
          ) : (
            <ul className="divide-y divide-border">
              {purchases.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-xs font-semibold text-brand">
                      {(p.customer_name || p.customer_mobile || "C").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.customer_name || p.customer_mobile || "Customer"}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {(p.created_at ?? "").replace("T", " ").slice(0, 16)} · {p.source === "entered" ? "Vendor entered" : "Scanned QR"}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-brand">{fmtINR(Number(p.total))}</p>
                </li>
              ))}
            </ul>
          )}
        </LuxuryCard>

        <LuxuryCard hoverLift={false} className="p-5 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">How it works</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>Print or display this QR at your counter.</li>
            <li>Customer opens the SPRITHI customer app and taps <span className="text-foreground">Scan</span>.</li>
            <li>They point their camera at the code, enter the bill amount, and confirm.</li>
            <li>Your wallet is credited immediately and the order shows up in <span className="text-foreground">Orders</span>.</li>
          </ol>
        </LuxuryCard>
      </section>
    </>
  );
}
