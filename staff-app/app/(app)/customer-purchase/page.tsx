"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, CreditCard, Plus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { cleanMobile, isMobile } from "@/lib/phone";

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

type Purchase = {
  id: number;
  total: number | string;
  created_at: string | null;
  customer_name: string | null;
  customer_mobile: string | null;
  source: "qr" | "entered";
};

/**
 * Vendor-initiated in-store purchase: the vendor opens a popup, types the
 * customer's mobile and the bill amount. The backend debits the customer's
 * wallet, credits the vendor's QR wallet 90%, and runs the commission cascade.
 * Below, a table lists the purchases this vendor entered here (source=entered).
 */
export default function CustomerPurchasePage() {
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const [rows, setRows] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

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

  async function charge() {
    const amt = Number(amount);
    if (!isMobile(mobile)) { toast.error("Enter a valid 10-digit customer mobile"); return; }
    if (!amt || amt <= 0) { toast.error("Enter an amount"); return; }
    setBusy(true);
    try {
      await api.post("/purchase/from-customer", { customer_mobile: mobile, amount: amt });
      toast.success(`₹${amt} charged to ${mobile}`);
      setMobile("");
      setAmount("");
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
      <section className="mx-auto max-w-2xl space-y-5 p-4 pb-24 md:p-8">
        <div className="flex items-start justify-between gap-3">
          <PageHeader
            eyebrow="Payments"
            icon={CreditCard}
            title="Customer purchase"
            description="Charge a customer's wallet for an in-store bill. Your sale lands in your QR wallet."
          />
          <GradientButton className="shrink-0" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add
          </GradientButton>
        </div>

        {/* History table — only purchases entered from this page */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <LuxuryCard hoverLift={false} className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-brand" />
              <p className="text-sm font-semibold">Customer purchases</p>
              {rows.length > 0 && (
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">{rows.length}</span>
              )}
            </div>

            {loading ? (
              <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </div>
            ) : rows.length === 0 ? (
              <p className="py-3 text-xs text-muted-foreground">No customer purchases yet. Tap “Add” to charge a customer.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <p className="font-medium">{r.customer_name || "Customer"}</p>
                        {r.customer_mobile && <p className="text-[11px] text-muted-foreground">{r.customer_mobile}</p>}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-brand">{fmtINR(Number(r.total))}</TableCell>
                      <TableCell className="text-right text-[11px] text-muted-foreground">
                        {(r.created_at ?? "").replace("T", " ").slice(0, 16)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </LuxuryCard>
        </motion.div>
      </section>

      {/* Add-purchase popup */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Customer purchase</DialogTitle>
            <DialogDescription>
              Enter the customer&apos;s mobile and the bill amount. Their wallet is charged and your sale lands in your QR wallet.
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
            <GradientButton size="lg" className="w-full" disabled={busy} onClick={() => void charge()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (amt > 0 ? `Charge ₹${amt}` : "Charge")}
            </GradientButton>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
