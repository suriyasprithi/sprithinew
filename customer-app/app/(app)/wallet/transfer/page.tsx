"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { useAuth } from "@/stores/auth";
import { api, apiErrorMessage } from "@/lib/api";
import type { WalletKey } from "@/lib/api";
import { cn } from "@/lib/utils";

function TransferInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { user, hydrate } = useAuth();

  const balanceFor = (k: WalletKey) => {
    if (k === "level")   return (user?.level_1_wallet ?? 0) + (user?.level_2_wallet ?? 0) + (user?.level_3_wallet ?? 0);
    if (k === "level_1") return user?.level_1_wallet ?? 0;
    if (k === "level_2") return user?.level_2_wallet ?? 0;
    if (k === "level_3") return user?.level_3_wallet ?? 0;
    if (k === "buyback") return user?.buyback_wallet ?? 0;
    if (k === "global")  return user?.global_wallet  ?? 0;
    return 0;
  };

  // Level money is freely transferable to the main wallet (no restriction).
  // "Level (all)" drains L1+L2+L3; the individual levels are listed too.
  const sources: { key: WalletKey; label: string }[] = [
    { key: "level",   label: "Level (all)" },
    { key: "level_1", label: "Level 1 (L1)" },
    { key: "level_2", label: "Level 2 (L2)" },
    { key: "level_3", label: "Level 3 (L3)" },
    { key: "buyback", label: "Buyback wallet" },
    { key: "global",  label: "Global wallet" },
  ];

  const fromParam = (search.get("from") as WalletKey) || "level";
  const [from, setFrom] = useState<WalletKey>(sources.find((t) => t.key === fromParam)?.key ?? "level");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const available = balanceFor(from);

  async function transfer() {
    const amt = Number(amount);
    if (!amt) { toast.error("Amount required"); return; }
    if (amt > available) { toast.error("Insufficient balance in source"); return; }
    setBusy(true);
    try {
      await api.post("/wallet/transfer", { from, to: "wallet", amount: amt });
      // Refresh the auth user so wallet balances reflect the move.
      await hydrate();
      toast.success(`₹${amt} moved to main wallet`);
      router.push("/wallet");
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally { setBusy(false); }
  }

  return (
    <>
      <AppHeader title="Transfer" />
      <section className="mx-auto max-w-md space-y-4 p-4 pb-24 md:p-8">
        <LuxuryCard hoverLift={false} className="space-y-4 p-5">
          <div className="space-y-2">
            <Label>From wallet</Label>
            <div className="grid gap-2">
              {sources.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setFrom(t.key)}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-3 text-left transition-colors",
                    from === t.key ? "border-brand/40 bg-brand/5 brand-glow" : "border-border bg-surface-2/40 hover:border-brand/30",
                  )}
                >
                  <span className="text-sm font-medium">{t.label}</span>
                  <span className="text-sm font-semibold text-brand">₹{balanceFor(t.key).toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ArrowLeftRight className="h-3 w-3 text-brand" /> to <span className="font-medium text-foreground">Main wallet</span>
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="a">Amount (₹)</Label>
            <Input id="a" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" max={available} className="h-11 rounded-xl bg-surface-2/60" />
          </div>

          <GradientButton size="lg" className="w-full" disabled={busy} onClick={() => void transfer()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowLeftRight className="h-4 w-4" /> Transfer</>}
          </GradientButton>
        </LuxuryCard>
      </section>
    </>
  );
}

export default function WalletTransferPage() {
  return <Suspense fallback={null}><TransferInner /></Suspense>;
}
