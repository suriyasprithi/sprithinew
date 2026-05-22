"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, Loader2, Building2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { useAuth } from "@/stores/auth";
import { api, apiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

type Method = "bank" | "upi";

export default function WithdrawPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [method, setMethod] = useState<Method>("upi");
  const [amount, setAmount] = useState("");
  const [upi, setUpi] = useState("");
  const [accName, setAccName] = useState("");
  const [accNo, setAccNo] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const amt = Number(amount);
    if (!amt) { toast.error("Amount required"); return; }
    if (amt > (user?.wallet_balance ?? 0)) { toast.error("Insufficient balance"); return; }
    if (method === "upi" && !upi) { toast.error("UPI ID required"); return; }
    if (method === "bank" && (!accName || !accNo || !ifsc)) { toast.error("Bank details required"); return; }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { amount: amt, method };
      if (method === "upi") {
        payload.upi_id = upi;
      } else {
        payload.account_holder = accName;
        payload.account_number = accNo;
        payload.ifsc = ifsc;
      }
      await api.post("/withdrawals", payload);
      toast.success("Withdrawal request submitted for admin approval");
      router.push("/wallet");
    } catch (e) { toast.error(apiErrorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <>
      <AppHeader title="Withdraw" />
      <section className="mx-auto max-w-md space-y-4 p-4 pb-24 md:p-8">
        <LuxuryCard hoverLift={false} className="p-5">
          <p className="text-xs text-muted-foreground">Available balance</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-brand">₹{(user?.wallet_balance ?? 0).toFixed(2)}</p>
        </LuxuryCard>

        <LuxuryCard hoverLift={false} className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="a">Amount (₹)</Label>
            <Input id="a" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" className="h-11 rounded-xl bg-surface-2/60" />
          </div>

          <div className="space-y-2">
            <Label>Payout method</Label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "upi" as Method, label: "UPI", icon: Smartphone },
                { key: "bank" as Method, label: "Bank", icon: Building2 },
              ]).map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMethod(m.key)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                      method === m.key ? "border-brand/40 bg-brand/5 brand-glow" : "border-border bg-surface-2/40 hover:border-brand/30",
                    )}
                  >
                    <span className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      method === m.key ? "bg-brand/15 text-brand" : "bg-muted text-muted-foreground",
                    )}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {method === "upi" ? (
            <div className="space-y-1.5">
              <Label htmlFor="u">UPI ID</Label>
              <Input id="u" value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="yourname@bank" className="h-11 rounded-xl bg-surface-2/60" />
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="space-y-1.5"><Label>Account holder</Label><Input value={accName} onChange={(e) => setAccName(e.target.value)} className="h-11 rounded-xl bg-surface-2/60" /></div>
              <div className="space-y-1.5"><Label>Account number</Label><Input value={accNo} onChange={(e) => setAccNo(e.target.value)} className="h-11 rounded-xl bg-surface-2/60" /></div>
              <div className="space-y-1.5"><Label>IFSC</Label><Input value={ifsc} onChange={(e) => setIfsc(e.target.value)} className="h-11 rounded-xl bg-surface-2/60 font-mono" /></div>
            </div>
          )}

          <GradientButton size="lg" className="w-full" disabled={busy} onClick={() => void submit()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowDownLeft className="h-4 w-4" /> Submit request</>}
          </GradientButton>
        </LuxuryCard>
      </section>
    </>
  );
}
