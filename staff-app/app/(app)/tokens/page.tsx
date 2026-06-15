"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDownToLine, ArrowUpRight, ArrowDownRight, Check, ChevronUp, Coins, Inbox, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { AnimatedCounter } from "@/components/ui/custom/animated-counter";
import { UpstreamBankCard } from "@/components/upstream-bank-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { EmptyState } from "@/components/data-table/empty-state";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/stores/auth";
import { api, apiErrorMessage } from "@/lib/api";

type Row = {
  id: number;
  amount: number;
  tokens: number;
  bonus?: number;
  notes: string | null;
  created_at: string;
  peer: { name: string; mobile_number: string } | null;
};

type InboxRow = {
  id: number;
  tokens: number;
  amount: number;
  notes: string | null;
  current_level: string;
  created_at: string;
  attachment_url?: string | null;
  requester: { name: string; mobile_number: string; role: string } | null;
};

// Roles that can distribute (have someone downstream)
const CAN_DISTRIBUTE = new Set(["admin", "state", "district", "taluk"]);
// Roles that can request from upstream (everyone except admin)
const CAN_REQUEST = new Set(["vendor", "taluk", "district", "state"]);
// Roles that can receive request inboxes
const HAS_INBOX = new Set(["taluk", "district", "state", "admin"]);

export default function TokensPage() {
  const { user } = useAuth();
  const [issued, setIssued] = useState<Row[]>([]);
  const [received, setReceived] = useState<Row[]>([]);
  const [inbox, setInbox] = useState<InboxRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Request dialog state (inline — no navigation, sidesteps cross-role basePath issue)
  const [requestOpen, setRequestOpen] = useState(false);
  const [reqTokens, setReqTokens] = useState("");
  const [reqNotes, setReqNotes] = useState("");
  const [reqFile, setReqFile] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<number | null>(null);

  const hasInbox = user?.role ? HAS_INBOX.has(user.role) : false;
  const canEscalate = user?.role === "taluk" || user?.role === "district" || user?.role === "state";
  const isAdmin = user?.role === "admin";

  async function refresh() {
    setLoading(true);
    try {
      const res = await api.get("/tokens/distribute/history");
      setIssued((res.data.data?.issued ?? []) as Row[]);
      setReceived((res.data.data?.received ?? []) as Row[]);
      if (hasInbox) {
        const ib = await api.get("/tokens/requests/inbox");
        setInbox((ib.data.data?.items ?? []) as InboxRow[]);
      } else {
        setInbox([]);
      }
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [hasInbox]);

  async function approveRequest(id: number) {
    setRowBusy(id);
    try {
      await api.post(`/tokens/requests/${id}/approve`);
      toast.success(`Request #${id} approved`);
      void refresh();
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setRowBusy(null); }
  }

  async function escalateRequest(id: number) {
    setRowBusy(id);
    try {
      await api.post(`/tokens/requests/${id}/escalate`, { notes: "insufficient tokens" });
      toast.success(`Request #${id} escalated`);
      void refresh();
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setRowBusy(null); }
  }

  async function rejectRequest(id: number) {
    setRowBusy(id);
    try {
      await api.post(`/tokens/requests/${id}/reject`);
      toast.success(`Request #${id} rejected`);
      void refresh();
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setRowBusy(null); }
  }

  async function uploadAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await api.post("/tokens/requests/upload", fd);
      setReqFile(res.data.data?.path ?? null);
      toast.success("Attached");
    } catch (err) { toast.error(apiErrorMessage(err)); }
    finally { setUploading(false); }
  }

  async function submitRequest() {
    const t = Number(reqTokens);
    if (!t) { toast.error("Tokens required"); return; }
    setBusy(true);
    try {
      await api.post("/tokens/requests", { tokens: t, notes: reqNotes || undefined, attachment: reqFile || undefined });
      toast.success("Request submitted");
      setReqTokens(""); setReqNotes(""); setReqFile(null); setRequestOpen(false);
      void refresh();
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setBusy(false); }
  }

  const totalReceived = received.reduce((s, r) => s + r.tokens, 0);
  const totalIssued = issued.reduce((s, r) => s + r.tokens, 0);
  // Bonus tokens minted into approved requests (state 3.5% / district 3% / taluk 2%).
  const totalBonus = Math.round(received.reduce((s, r) => s + (Number(r.bonus) || 0), 0) * 100) / 100;

  const canRequest    = user?.role ? CAN_REQUEST.has(user.role)    : false;
  const canDistribute = user?.role ? CAN_DISTRIBUTE.has(user.role) : false;

  const description = user?.role === "vendor"
    ? "Receive tokens from your taluk. Each customer purchase consumes tokens from this balance automatically. Request more when low."
    : "Receive tokens from upstream, distribute to downstream, request more when low.";

  return (
    <>
      <MobileHeader title="Tokens" />
      <section className="mx-auto max-w-4xl space-y-5 p-4 pb-24 md:p-8">
        <PageHeader
          eyebrow="Tokens"
          icon={Coins}
          title="Token balance"
          description={description}
        />

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <LuxuryCard glow hoverLift={false} className="relative overflow-hidden brand-gradient p-6 text-brand-foreground">
            <div className="absolute inset-0 brand-gradient-soft opacity-40" />
            <div className="relative space-y-3">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider opacity-80">
                  <Coins className="h-4 w-4" /> Token balance
                </p>
              </div>
              <p className="text-4xl font-bold tracking-tight md:text-5xl">
                <AnimatedCounter value={user?.token_balance ?? 0} />
              </p>
              <p className="text-xs opacity-80">+{totalReceived.toLocaleString("en-IN")} received · −{totalIssued.toLocaleString("en-IN")} issued</p>
            </div>
          </LuxuryCard>
        </motion.div>

        <UpstreamBankCard />

        {totalBonus > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <LuxuryCard hoverLift={false} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                  <Coins className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Bonus earned</p>
                  <p className="text-[11px] text-muted-foreground">Extra tokens from approved requests</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-amber-400">+{totalBonus.toLocaleString("en-IN")}</p>
            </LuxuryCard>
          </motion.div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {canRequest && (
            <button type="button" onClick={() => setRequestOpen(true)} className="block text-left">
              <LuxuryCard className="flex flex-col items-center gap-2 p-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                  <ArrowDownToLine className="h-5 w-5" />
                </span>
                <p className="text-sm font-semibold">Request</p>
                <p className="text-[11px] text-muted-foreground">Ask upstream for more</p>
              </LuxuryCard>
            </button>
          )}
          {canDistribute && (
            <Link href="/distribute-token" className="block">
              <LuxuryCard className="flex flex-col items-center gap-2 p-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <Send className="h-5 w-5" />
                </span>
                <p className="text-sm font-semibold">Distribute</p>
                <p className="text-[11px] text-muted-foreground">Send to downstream</p>
              </LuxuryCard>
            </Link>
          )}
        </div>

        {hasInbox && inbox.length > 0 && (
          <div>
            <h3 className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              <Inbox className="h-3.5 w-3.5 text-amber-400" /> Pending your approval ({inbox.length})
            </h3>
            <div className="space-y-2">
              {inbox.map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <LuxuryCard className="space-y-3 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                          <Coins className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{r.requester?.name ?? "—"}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {r.requester?.role ?? ""} · {r.created_at} {r.notes ? `· ${r.notes}` : ""}
                          </p>
                          {r.attachment_url && (
                            <a href={r.attachment_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex w-fit items-center gap-1 rounded-md bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand hover:bg-brand/20">
                              📎 Attachment
                            </a>
                          )}
                        </div>
                      </div>
                      <p className="shrink-0 text-base font-bold text-brand">{r.tokens} tokens</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" className="h-8 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" onClick={() => void approveRequest(r.id)} disabled={rowBusy === r.id}>
                        {rowBusy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5" /> Approve</>}
                      </Button>
                      {isAdmin && (
                        <Button size="sm" variant="ghost" className="h-8 text-rose-400 hover:bg-rose-500/10" onClick={() => void rejectRequest(r.id)} disabled={rowBusy === r.id}>
                          Reject
                        </Button>
                      )}
                    </div>
                  </LuxuryCard>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            <ArrowDownRight className="h-3.5 w-3.5 text-emerald-400" /> Received
          </h3>
          {loading ? (
            <LuxuryCard hoverLift={false} className="p-6 text-center text-sm text-muted-foreground">Loading…</LuxuryCard>
          ) : received.length === 0 ? (
            <EmptyState icon={ArrowDownRight} title="No tokens received yet" />
          ) : (
            <div className="space-y-2">
              {received.map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <LuxuryCard className="flex items-center justify-between p-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                        <ArrowDownRight className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="font-semibold">From {r.peer?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{r.created_at}</p>
                      </div>
                    </div>
                    <span className="font-bold text-emerald-400">+{r.tokens}</span>
                  </LuxuryCard>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            <ArrowUpRight className="h-3.5 w-3.5 text-rose-400" /> Issued
          </h3>
          {loading ? (
            <LuxuryCard hoverLift={false} className="p-6 text-center text-sm text-muted-foreground">Loading…</LuxuryCard>
          ) : issued.length === 0 ? (
            <EmptyState icon={ArrowUpRight} title="No tokens issued yet" />
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
                        <p className="font-semibold">To {r.peer?.name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{r.created_at}</p>
                      </div>
                    </div>
                    <span className="font-bold text-rose-400">−{r.tokens}</span>
                  </LuxuryCard>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Request tokens</DialogTitle>
            <DialogDescription>Submit a token request to your upstream parent. Admin will review and approve.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reqTokens">Tokens needed</Label>
              <Input id="reqTokens" type="number" min={1} value={reqTokens} onChange={(e) => setReqTokens(e.target.value)} placeholder="1000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reqNotes">Notes (optional)</Label>
              <Input id="reqNotes" value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} placeholder="Stock replenishment" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reqFile">Attachment (optional)</Label>
              <input
                id="reqFile"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => void uploadAttachment(e)}
                disabled={uploading}
                className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand hover:file:bg-brand/20"
              />
              {uploading && <p className="text-[11px] text-muted-foreground">Uploading…</p>}
              {reqFile && !uploading && (
                <p className="flex items-center gap-1.5 text-[11px] text-emerald-500">
                  Attached ✓ <button type="button" className="underline" onClick={() => setReqFile(null)}>remove</button>
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRequestOpen(false)}>Cancel</Button>
            <GradientButton onClick={() => void submitRequest()} disabled={busy || uploading}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowDownToLine className="h-4 w-4" /> Submit</>}
            </GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
