"use client";

import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { api } from "@/lib/api";

type Upstream = {
  role: string;
  name: string | null;
  mobile_number: string | null;
  account_holder: string | null;
  bank_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  upi: string | null;
};

const ROLE_LABEL: Record<string, string> = { taluk: "Taluk", district: "District", state: "State", admin: "Admin" };

/** Shows the caller's upstream tier's bank details (where to pay for token top-ups). */
export function UpstreamBankCard() {
  const [up, setUp] = useState<Upstream | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const r = await api.get("/tokens/upstream-bank");
        setUp((r.data.data?.upstream ?? null) as Upstream | null);
      } catch {
        /* non-fatal */
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  if (!loaded || !up) return null;
  const label = ROLE_LABEL[up.role] ?? up.role;
  const hasBank = !!(up.account_holder || up.bank_name || up.account_number || up.ifsc_code || up.upi);

  return (
    <LuxuryCard className="p-5">
      <div className="mb-1 flex items-center gap-2">
        <Landmark className="h-4 w-4 text-brand" />
        <p className="text-sm font-semibold">{label} bank details</p>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Pay your {label.toLowerCase()}{up.name ? ` (${up.name})` : ""} here when topping up tokens.
      </p>
      {hasBank ? (
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          {up.account_holder && <Row label="Account holder" value={up.account_holder} />}
          {up.bank_name && <Row label="Bank" value={up.bank_name} />}
          {up.account_number && <Row label="A/C number" value={up.account_number} mono />}
          {up.ifsc_code && <Row label="IFSC" value={up.ifsc_code} mono />}
          {up.upi && <Row label="UPI" value={up.upi} />}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No bank details on file for your {label.toLowerCase()} yet.</p>
      )}
    </LuxuryCard>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
