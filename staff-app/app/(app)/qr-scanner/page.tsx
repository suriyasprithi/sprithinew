"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, QrCode, Share2, Search, ArrowRightLeft, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { Pagination } from "@/components/data-table/pagination";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/stores/auth";

const PAGE_SIZE = 8;
const fmtINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtDateTime = (s: string | null) => (s ?? "").replace("T", " ").slice(0, 16);

type QrPurchase = {
  id: number;
  total: number | string;
  created_at: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  source: "qr" | "entered";
  vendor_share: number | string;   // amount actually sitting in the QR wallet
  transferred: boolean;            // already moved to the main wallet?
};

/**
 * Vendor QR display. Encodes the vendor's mobile_number so the customer-app's
 * QR scanner can read it and POST /purchase/qr to settle the order.
 */
export default function QrScannerPage() {
  const { user, hydrate } = useAuth();
  const mobile = user?.mobile_number ?? "";
  const name   = user?.name ?? "Vendor";

  const [purchases, setPurchases] = useState<QrPurchase[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [xferId, setXferId] = useState<number | null>(null);

  // Move one QR purchase's share from the QR wallet to the main wallet.
  async function transferOne(p: QrPurchase) {
    setXferId(p.id);
    try {
      await api.post(`/purchase/${p.id}/transfer`, {});
      setPurchases((cur) => cur.map((x) => (x.id === p.id ? { ...x, transferred: true } : x)));
      toast.success(`${fmtINR(Number(p.vendor_share))} moved to main wallet`);
      await hydrate?.(); // refresh wallet balances from /auth/me
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setXferId(null);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/purchase/mine");
        const all = (res.data.data?.items ?? []) as QrPurchase[];
        // Only customer-scanned QR sales belong here; vendor-entered purchases
        // are shown on the Customer purchase page.
        setPurchases(all.filter((p) => p.source === "qr"));
      } catch {
        setPurchases([]);
      } finally {
        setLoadingPurchases(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return purchases;
    return purchases.filter((p) =>
      (p.customer_name ?? "").toLowerCase().includes(q) ||
      (p.customer_mobile ?? "").includes(q));
  }, [purchases, search]);

  useEffect(() => setPage(1), [search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
      <section className="mx-auto max-w-7xl space-y-6 p-4 pb-24 md:p-8">
        <PageHeader
          eyebrow="Payments"
          icon={QrCode}
          title="Your shop QR"
          description="Let customers scan this to pay in-store. They open the SPRITHI customer app → Scan → camera, then point at this code."
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_1fr] lg:items-start">
          {/* Left — QR card */}
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
                    <img src={qrSrc} alt={`${name} payment QR`} className="h-56 w-56 md:h-64 md:w-64" />
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

          {/* Right — Recent QR purchases (full-width searchable, paginated table) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Recent QR purchases</p>
              {purchases.length > 0 && (
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">{purchases.length}</span>
              )}
            </div>

            <div className="glass rounded-2xl p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer name or mobile…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
              </div>
            </div>

            <div className="luxe-card overflow-hidden">
              <div className="hidden grid-cols-[1fr_110px_140px_170px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
                <span>Customer</span>
                <span className="text-right">Amount</span>
                <span className="text-right">Date</span>
                <span className="text-right">Transfer</span>
              </div>
              {loadingPurchases ? (
                <div className="p-3"><TableSkeleton rows={5} cols={3} /></div>
              ) : filtered.length === 0 ? (
                <EmptyState icon={QrCode} title="No QR purchases yet" description="They'll appear here when a customer pays via your QR." />
              ) : (
                <div className="divide-y divide-border">
                  {paged.map((p, i) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[1fr_110px_140px_170px]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-xs font-semibold text-brand">
                          {(p.customer_name || p.customer_mobile || "C").charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{p.customer_name || "Customer"}</p>
                          <p className="truncate text-xs text-muted-foreground">{p.customer_mobile || "—"}</p>
                        </div>
                      </div>
                      <p className="hidden text-right text-sm font-semibold text-brand md:block">{fmtINR(Number(p.total))}</p>
                      <p className="hidden text-right text-xs text-muted-foreground md:block">{fmtDateTime(p.created_at)}</p>
                      {/* Action — desktop col 4; on mobile this is the right cell (also shows amount) */}
                      <div className="flex flex-col items-end gap-1 justify-self-end">
                        <p className="text-sm font-semibold text-brand md:hidden">{fmtINR(Number(p.total))}</p>
                        {p.transferred ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                            <Check className="h-3 w-3" /> Transferred
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            className="h-8 rounded-lg"
                            disabled={xferId === p.id}
                            onClick={() => void transferOne(p)}
                          >
                            {xferId === p.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <><ArrowRightLeft className="h-3.5 w-3.5" /> {fmtINR(Number(p.vendor_share))}</>
                            )}
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
              {!loadingPurchases && filtered.length > 0 && (
                <div className="border-t border-border bg-surface-2/40 px-4 py-3">
                  <Pagination page={safePage} pageCount={pageCount} onPageChange={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
                </div>
              )}
            </div>
          </div>
        </div>

        <LuxuryCard hoverLift={false} className="p-5 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">How it works</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>Print or display this QR at your counter.</li>
            <li>Customer opens the SPRITHI customer app and taps <span className="text-foreground">Scan</span>.</li>
            <li>They point their camera at the code, enter the bill amount, and confirm.</li>
            <li>The amount lands in your <span className="text-foreground">QR wallet</span> and the sale shows up in <span className="text-foreground">Orders</span>.</li>
            <li>Open <span className="text-foreground">Wallet → QR wallet → Transfer</span> to move it into your main wallet to spend or withdraw.</li>
          </ol>
        </LuxuryCard>
      </section>
    </>
  );
}
