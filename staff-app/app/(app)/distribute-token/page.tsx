"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Coins, Loader2, Send, ArrowUpRight, ArrowDownLeft, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { EmptyState } from "@/components/data-table/empty-state";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { cleanMobile, isMobile } from "@/lib/phone";
import { useAuth } from "@/stores/auth";

type Row = {
  id: number;
  amount: number;
  tokens: number;
  notes: string | null;
  created_at: string;
  peer: { name: string; mobile_number: string } | null;
};

const ROLE_BELOW: Record<string, string> = {
  admin: "state",
  state: "district",
  district: "taluk",
  taluk: "vendor",
};

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

export default function DistributeTokenPage() {
  const { user } = useAuth();
  const [issued, setIssued] = useState<Row[]>([]);
  const [received, setReceived] = useState<Row[]>([]);
  const [mobile, setMobile] = useState("");
  const [tokens, setTokens] = useState("");
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<{ tokens: number; bonus: number; bonus_pct: number; recipient_gets: number; total_cost: number; recipient_role: string | null } | null>(null);

  const target = user?.role ? ROLE_BELOW[user.role] ?? null : null;

  async function refresh() {
    try {
      const res = await api.get("/tokens/distribute/history");
      setIssued((res.data.data?.issued ?? []) as Row[]);
      setReceived((res.data.data?.received ?? []) as Row[]);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }
  useEffect(() => { void refresh(); }, []);

  // Live quote as user types token count.
  useEffect(() => {
    const t = Number(tokens);
    if (!t || t <= 0) { setQuote(null); return; }
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get("/tokens/distribute/quote", { params: { tokens: t } });
        if (!cancelled) setQuote(res.data.data);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [tokens]);

  async function distribute() {
    const t = Number(tokens);
    if (!isMobile(mobile)) { toast.error("Enter a valid 10-digit mobile number"); return; }
    if (!t) { toast.error("Enter tokens"); return; }
    setBusy(true);
    try {
      await api.post("/tokens/distribute", { to_mobile: mobile, tokens: t });
      toast.success(`${t} tokens sent to ${mobile}`);
      setMobile(""); setTokens("");
      void refresh();
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setBusy(false); }
  }

  return (
    <>
      <MobileHeader title="Distribute tokens" />
      <section className="mx-auto max-w-3xl space-y-5 p-4 pb-24 md:p-8">
        <PageHeader
          eyebrow="Tokens"
          icon={Coins}
          title="Distribute tokens"
          description={target
            ? `Send tokens down to your ${target}s — they get the amount + commission, paid from your wallet.`
            : "Your role can't distribute tokens."}
        />

        {target && (
          <LuxuryCard hoverLift={false} className="space-y-4 p-5">
            <div className="space-y-1.5">
              <Label htmlFor="mobile">Receiver mobile ({target})</Label>
              <Input id="mobile" inputMode="numeric" maxLength={10} value={mobile} onChange={(e) => setMobile(cleanMobile(e.target.value))} placeholder="9999000010" className="h-11 rounded-xl bg-surface-2/60" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tokens">Tokens</Label>
              <Input id="tokens" type="number" min={1} value={tokens} onChange={(e) => setTokens(e.target.value)} placeholder="1000" className="h-11 rounded-xl bg-surface-2/60" />
            </div>

            {quote && quote.recipient_role && (
              <div className="rounded-xl border border-border bg-surface-2/40 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Recipient gets ({quote.recipient_role})</span>
                  <span className="font-semibold text-brand">{quote.recipient_gets} tokens</span>
                </div>
                {quote.bonus > 0 && (
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-muted-foreground">incl. commission @ {quote.bonus_pct}%</span>
                    <span className="font-medium">+{quote.bonus}</span>
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-muted-foreground">You pay (from wallet)</span>
                  <span className="font-semibold">{fmtINR(quote.total_cost)}</span>
                </div>
                {user?.role !== "admin" && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Paid from your wallet. You keep the margin between your rate and theirs.
                  </p>
                )}
              </div>
            )}

            <GradientButton size="lg" className="w-full" disabled={busy} onClick={() => void distribute()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Distribute</>}
            </GradientButton>
          </LuxuryCard>
        )}

        <div>
          <h3 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Recently issued</h3>
          {issued.length === 0 ? (
            <EmptyState icon={ArrowUpRight} title="No distributions yet" />
          ) : (
            <div className="space-y-2">
              {issued.map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <LuxuryCard className="flex items-center justify-between p-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
                        <ArrowUpRight className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-semibold">{r.peer?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{r.created_at} {r.notes ? `· ${r.notes}` : ""}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-rose-400">−{r.tokens} tokens</p>
                      <p className="text-[11px] text-emerald-500">+{fmtINR(r.amount)} earned</p>
                    </div>
                  </LuxuryCard>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {received.length > 0 && (
          <div>
            <h3 className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Recently received</h3>
            <div className="space-y-2">
              {received.map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <LuxuryCard className="flex items-center justify-between p-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                        <ArrowDownLeft className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-semibold">{r.peer?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{r.created_at} {r.notes ? `· ${r.notes}` : ""}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-500">+{r.tokens} tokens</p>
                      {r.amount > 0 && (
                        <p className="inline-flex items-center gap-1 text-[11px] text-rose-400">
                          <Wallet className="h-3 w-3" /> -{fmtINR(r.amount)}
                        </p>
                      )}
                    </div>
                  </LuxuryCard>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
