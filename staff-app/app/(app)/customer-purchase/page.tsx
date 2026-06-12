"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { cleanMobile, isMobile } from "@/lib/phone";

/**
 * Vendor-initiated in-store purchase: the vendor types the customer's mobile and
 * the bill amount. The backend debits the customer's wallet, credits the vendor's
 * QR wallet 90%, and runs the commission cascade — same as the QR scan flow.
 */
export default function CustomerPurchasePage() {
  const [mobile, setMobile] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

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
      <section className="mx-auto max-w-md space-y-5 p-4 pb-24 md:p-8">
        <PageHeader
          eyebrow="Payments"
          icon={CreditCard}
          title="Customer purchase"
          description="Enter the customer's mobile and the bill amount. Their wallet is charged and your sale lands in your QR wallet."
        />

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <LuxuryCard hoverLift={false} className="space-y-4 p-5">
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
          </LuxuryCard>
        </motion.div>
      </section>
    </>
  );
}
