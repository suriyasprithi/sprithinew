"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, CreditCard, Plus, Receipt, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { Pagination } from "@/components/data-table/pagination";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { cleanMobile, isMobile } from "@/lib/phone";

const PAGE_SIZE = 10;
const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const fmtDateTime = (s: string | null) => (s ?? "").replace("T", " ").slice(0, 16);

// History tag for a vendor-entered purchase. Untagged legacy rows read as Offline.
function SaleBadge({ mode }: { mode: "online" | "offline" | null }) {
  const online = mode === "online";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${online ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
      {online ? "Online" : "Offline"}
    </span>
  );
}

type SaleMode = "online" | "offline";

type Purchase = {
  id: number;
  total: number | string;
  created_at: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  source: "qr" | "entered";
  sale_mode: SaleMode | null;
};

/**
 * Vendor-initiated in-store purchase: the vendor opens a popup, types the
 * customer's mobile and the bill amount. The backend debits the customer's
 * wallet, credits the vendor's main wallet their share, and runs the commission
 * cascade. Below, a full-width, searchable, paginated table lists the purchases
 * this vendor entered here (source=entered).
 */
export default function CustomerPurchasePage() {
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState("");
  const [amount, setAmount] = useState("");
  const [saleMode, setSaleMode] = useState<SaleMode | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [rows, setRows] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Only the purchases entered from this page (not customer-scanned QR).
  async function refresh() {
    setLoading(true);
    try {
      const res = await api.get("/purchase/mine");
      const all = (res.data.data?.items ?? []) as Purchase[];
      setRows(all.filter((r) => r.source === "entered"));
    } catch (e) {
      toast.error(apiErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }
  // Initial load — inline so no setState fires synchronously in the effect body
  // (loading already starts true). Post-charge reloads go through refresh().
  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/purchase/mine");
        const all = (res.data.data?.items ?? []) as Purchase[];
        setRows(all.filter((r) => r.source === "entered"));
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.customer_name ?? "").toLowerCase().includes(q) ||
      (r.customer_mobile ?? "").includes(q));
  }, [rows, search]);

  useEffect(() => setPage(1), [search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalAmount = rows.reduce((s, r) => s + Number(r.total), 0);

  async function charge() {
    const amt = Number(amount);
    if (!isMobile(mobile)) { toast.error("Enter a valid 10-digit customer mobile"); return; }
    if (!amt || amt <= 0) { toast.error("Enter an amount"); return; }
    if (!saleMode) { toast.error("Select Online or Offline"); return; }
    setBusy(true);
    try {
      await api.post("/purchase/from-customer", {
        customer_mobile: mobile,
        amount: amt,
        sale_mode: saleMode,
        ...(saleMode === "offline" && note.trim() ? { note: note.trim() } : {}),
      });
      toast.success(`₹${amt} recorded for ${mobile}`);
      setMobile("");
      setAmount("");
      setSaleMode("");
      setNote("");
      setOpen(false);
      void refresh();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const amt = Number(amount);

  return (
    <>
      <MobileHeader title="Customer purchase" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 pb-24 md:p-8">
        <PageHeader
          eyebrow="Payments"
          icon={CreditCard}
          title="Customer purchase"
          description="Charge a customer's wallet for an in-store bill. Your sale lands in your main wallet."
          action={
            <GradientButton onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Add
            </GradientButton>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <StatCard label="Purchases"       value={rows.length}  icon={Receipt}    tone="brand"   spark={[2, 3, 3, 4, 4, 4, 5, 5]} />
          <StatCard label="Total collected" value={totalAmount}  icon={CreditCard} tone="emerald" spark={[2, 3, 4, 4, 5, 5, 6, 6]} format={fmtINR} />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer name or mobile…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
          </div>
        </div>

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[72px_1fr_110px_130px_170px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>#</span>
            <span>Customer</span>
            <span>Type</span>
            <span className="text-right">Amount</span>
            <span className="text-right">Date</span>
          </div>
          {loading ? (
            <div className="p-3"><TableSkeleton rows={6} cols={4} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Receipt} title="No customer purchases" description="Tap “Add” to charge a customer." />
          ) : (
            <div className="divide-y divide-border">
              {paged.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[72px_1fr_110px_130px_170px]"
                >
                  <p className="hidden font-mono text-xs text-muted-foreground md:block">#{r.id}</p>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-xs font-semibold text-brand">
                      {(r.customer_name || "?").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{r.customer_name || "Customer"}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.customer_mobile || "—"}</p>
                      <span className="mt-1 inline-flex md:hidden"><SaleBadge mode={r.sale_mode} /></span>
                    </div>
                  </div>
                  <div className="hidden md:block"><SaleBadge mode={r.sale_mode} /></div>
                  <p className="justify-self-end text-sm font-semibold text-brand md:text-right">{fmtINR(Number(r.total))}</p>
                  <p className="hidden text-right text-xs text-muted-foreground md:block">{fmtDateTime(r.created_at)}</p>
                </motion.div>
              ))}
            </div>
          )}
          {!loading && filtered.length > 0 && (
            <div className="border-t border-border bg-surface-2/40 px-4 py-3">
              <Pagination page={safePage} pageCount={pageCount} onPageChange={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
            </div>
          )}
        </div>
      </section>

      {/* Add-purchase popup */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Customer purchase</DialogTitle>
            <DialogDescription>
              Record a customer&apos;s in-store bill. Pick <b>Online</b> to also list it under Orders, or <b>Offline</b> to keep it as a record only.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="m">Customer mobile</Label>
              <Input
                id="m"
                inputMode="numeric"
                value={mobile}
                onChange={(e) => setMobile(cleanMobile(e.target.value))}
                placeholder="9876543210"
                className="h-11 rounded-xl bg-surface-2/60"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a">Amount (₹)</Label>
              <Input
                id="a"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                className="h-11 rounded-xl bg-surface-2/60"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sale type</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["online", "offline"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSaleMode(m)}
                    className={`h-11 rounded-xl border text-sm font-semibold capitalize transition-colors ${
                      saleMode === m
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-input bg-surface-2/60 text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            {saleMode === "online" && (
              <p className="text-xs text-muted-foreground">This sale will also appear in your Orders list.</p>
            )}
            {saleMode === "offline" && (
              <div className="space-y-1.5">
                <Label htmlFor="note">Note (optional)</Label>
                <Input
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Paid by cash in store"
                  className="h-11 rounded-xl bg-surface-2/60"
                />
              </div>
            )}
            <GradientButton size="lg" className="w-full" disabled={busy} onClick={() => void charge()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (amt > 0 ? `Charge ₹${amt}` : "Charge")}
            </GradientButton>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
