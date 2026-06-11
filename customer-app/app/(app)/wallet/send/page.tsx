"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { useAuth } from "@/stores/auth";
import { api, apiErrorMessage } from "@/lib/api";
import { cleanMobile, isMobile } from "@/lib/phone";

const fmtINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

export default function WalletSendPage() {
  const router = useRouter();
  const { user, hydrate } = useAuth();
  const [mobile, setMobile] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const amt = Number(amount);
    if (!isMobile(mobile)) { toast.error("Enter a valid 10-digit mobile number"); return; }
    if (!amt) { toast.error("Enter an amount"); return; }
    if (amt > (user?.wallet_balance ?? 0)) { toast.error("Insufficient balance"); return; }
    setBusy(true);
    try {
      await api.post("/wallet/send", { to_mobile: mobile, amount: amt });
      await hydrate();
      toast.success(`₹${amt} sent to ${mobile}`);
      router.push("/wallet");
    } catch (e) { toast.error(apiErrorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <>
      <AppHeader title="Send" />
      <section className="mx-auto max-w-md space-y-4 p-4 pb-24 md:p-8">
        <LuxuryCard hoverLift={false} className="p-5">
          <p className="text-xs text-muted-foreground">Available balance</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-brand">{fmtINR(user?.wallet_balance ?? 0)}</p>
        </LuxuryCard>

        <LuxuryCard hoverLift={false} className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="m">Receiver mobile</Label>
            <Input id="m" inputMode="numeric" value={mobile} onChange={(e) => setMobile(cleanMobile(e.target.value))} placeholder="9876543210" className="h-11 rounded-xl bg-surface-2/60" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a">Amount (₹)</Label>
            <Input id="a" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" className="h-11 rounded-xl bg-surface-2/60" />
          </div>
          <GradientButton size="lg" className="w-full" disabled={busy} onClick={() => void send()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Send</>}
          </GradientButton>
        </LuxuryCard>
      </section>
    </>
  );
}
