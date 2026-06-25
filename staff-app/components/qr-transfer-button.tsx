"use client";

import { useState } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/stores/auth";

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/**
 * Moves the vendor's WHOLE QR wallet to the main wallet (POST /purchase/transfer-all).
 * Shared by the dashboard, wallet page and QR Scanner page — replaces the old
 * per-purchase Transfer buttons. Disabled when the QR wallet is empty.
 */
export function QrTransferButton({
  balance,
  onDone,
  className,
}: {
  balance: number;
  onDone?: (moved: number) => void | Promise<void>;
  className?: string;
}) {
  const { hydrate } = useAuth();
  const [busy, setBusy] = useState(false);
  const canTransfer = balance > 0;

  async function transfer() {
    setBusy(true);
    try {
      const res = await api.post("/purchase/transfer-all", {});
      const moved = Number(res.data.data?.transferred ?? 0);
      toast.success(`${fmtINR(moved)} moved to main wallet`);
      await hydrate?.(); // refresh wallet balances from /auth/me
      await onDone?.(moved);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" disabled={busy || !canTransfer} onClick={() => void transfer()} className={className}>
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <ArrowRightLeft className="h-4 w-4" /> Transfer{canTransfer ? ` ${fmtINR(balance)}` : ""} to main
        </>
      )}
    </Button>
  );
}
