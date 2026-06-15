"use client";

import { useEffect, useMemo, useState } from "react";
import { Coins, Search, Check, X, ChevronUp, Hourglass, ArrowDownToLine, Loader2, MoreHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/data-table/status-badge";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { Pagination } from "@/components/data-table/pagination";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/stores/auth";
import { api, apiErrorMessage } from "@/lib/api";
import { mock, type TokenRequest } from "@/lib/mock";

const PAGE_SIZE = 10;

type Row = TokenRequest & { current_level?: string; attachment_url?: string | null };

export default function TokenRequestPage() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const isAdmin    = role === "admin";
  const isApprover = role === "taluk" || role === "district" || role === "state";
  const isVendor   = role === "vendor";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | TokenRequest["status"]>("all");
  const [page, setPage] = useState(1);
  const [requestOpen, setRequestOpen] = useState(false);
  const [tokens, setTokens] = useState("");
  const [reqFile, setReqFile] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<number | null>(null);
  const [bonusEarned, setBonusEarned] = useState(0);

  async function refresh() {
    setLoading(true);
    try {
      type ApiRow = {
        id: number | string;
        tokens: number | string;
        amount: number | string;
        status: TokenRequest["status"];
        current_level?: string;
        created_at: string;
        notes?: string | null;
        attachment_url?: string | null;
        requester?: { name?: string | null; mobile_number?: string | null } | null;
      };
      const adapt = (r: ApiRow, fallbackName?: string): Row => ({
        id: Number(r.id),
        requester_name: r.requester?.name || r.requester?.mobile_number || fallbackName || `User #${r.id}`,
        tokens: Number(r.tokens) || 0,
        amount: Number(r.amount) || 0,
        status: r.status,
        created_at: r.created_at,
        notes: r.notes ?? undefined,
        current_level: r.current_level,
        attachment_url: r.attachment_url ?? null,
      });

      let items: ApiRow[] = [];
      if (isAdmin) {
        items = ((await api.get("/admin/token-requests")).data.data?.items ?? []) as ApiRow[];
      } else if (isApprover) {
        items = ((await api.get("/tokens/requests/inbox")).data.data?.items ?? []) as ApiRow[];
      } else if (isVendor) {
        items = ((await api.get("/tokens/requests/mine")).data.data?.items ?? []) as ApiRow[];
      }
      setRows(items.map((r) => adapt(r, user?.name)));

      // "Bonus balance" = the user's live bonus pot. A downline siphons a % of
      // it when their request is approved, so it can go DOWN over time. Fetch it
      // fresh (the auth-store user only hydrates on app load, so it wouldn't
      // update right after an approval).
      if (isApprover) {
        try {
          const me = await api.get("/auth/me");
          setBonusEarned(Math.round((Number(me.data.data?.bonus_balance) || 0) * 100) / 100);
        } catch { /* non-fatal — leave the previous value */ }
      }
    } catch (e) {
      toast.error(apiErrorMessage(e));
      setRows(await mock.tokenRequests());
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [role]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (search && !r.requester_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (status !== "all" && r.status !== status) return false;
    return true;
  }), [rows, search, status]);

  useEffect(() => setPage(1), [search, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pending = rows.filter((r) => r.status === "pending");
  const approved = rows.filter((r) => r.status === "approved");
  const totalTokens = approved.reduce((s, r) => s + r.tokens, 0);

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

  async function submit() {
    const t = Number(tokens);
    if (!t) { toast.error("Tokens required"); return; }
    setBusy(true);
    try {
      await api.post("/tokens/requests", { tokens: t, attachment: reqFile || undefined });
      toast.success("Request submitted");
      setTokens(""); setReqFile(null); setRequestOpen(false);
      void refresh();
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setBusy(false); }
  }

  async function approve(id: number) {
    setRowBusy(id);
    try {
      await api.post(`/tokens/requests/${id}/approve`);
      toast.success(`Request #${id} approved`);
      void refresh();
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setRowBusy(null); }
  }

  async function escalate(id: number) {
    setRowBusy(id);
    try {
      await api.post(`/tokens/requests/${id}/escalate`, { notes: "insufficient tokens at my level" });
      toast.success(`Request #${id} escalated`);
      void refresh();
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setRowBusy(null); }
  }

  async function reject(id: number) {
    setRowBusy(id);
    try {
      await api.post(`/tokens/requests/${id}/reject`);
      toast.success(`Request #${id} rejected`);
      void refresh();
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setRowBusy(null); }
  }

  return (
    <>
      <MobileHeader title="Token requests" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Tokens"
          icon={Coins}
          title="Token requests"
          description={isAdmin
            ? "Final-level approver. Review escalated requests, approve, reject, or credit manually."
            : isApprover
              ? "Requests from your downstream waiting on you. Approve if you have tokens; escalate up if not."
              : "Request tokens from your upstream parent."}
          action={(isVendor || role === "taluk" || role === "district" || role === "state") && (
            <GradientButton onClick={() => setRequestOpen(true)}>
              <ArrowDownToLine className="h-4 w-4" /> New request
            </GradientButton>
          )}
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total requests"   value={rows.length}     icon={Coins}     tone="brand"   spark={[1, 2, 2, 2, 2, 2, 2, 2]} />
          <StatCard label="Pending"          value={pending.length}  icon={Hourglass} tone="amber"   spark={[1, 1, 1, 1, 1, 1, 1, 1]} />
          <StatCard label="Approved"         value={approved.length} icon={Check}     tone="emerald" spark={[1, 1, 2, 2, 2, 2, 2, 2]} />
          <StatCard label="Tokens approved"  value={totalTokens}     icon={Coins}     tone="violet"  spark={[2, 3, 3, 4, 4, 5, 5, 6]} />
        </div>

        {isApprover && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <div className="luxe-card flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                  <Coins className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Bonus balance</p>
                  <p className="text-xs text-muted-foreground">Your bonus pot — your downline draws a % of it when you approve their request</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-amber-400">{bonusEarned > 0 ? "+" : ""}{bonusEarned.toLocaleString("en-IN")}</p>
            </div>
          </motion.div>
        )}

        <div className="glass rounded-2xl p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requester…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
            </div>
            <Select value={status} onValueChange={(v) => v && setStatus(v as "all" | TokenRequest["status"])}>
              <SelectTrigger className="h-10 rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[1.4fr_120px_140px_120px_180px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Requester</span>
            <span>Tokens</span>
            <span>Submitted</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          {loading ? (
            <div className="p-3"><TableSkeleton rows={5} cols={5} /></div>
          ) : paged.length === 0 ? (
            <EmptyState icon={Coins} title="No token requests" />
          ) : (
            <div className="divide-y divide-border">
              {paged.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[1.4fr_120px_140px_120px_180px]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-xs font-semibold text-brand">
                      {r.requester_name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{r.requester_name}</p>
                      <p className="truncate text-xs text-muted-foreground md:hidden">{r.tokens} tokens · {r.created_at}</p>
                      {r.attachment_url && (
                        <a href={r.attachment_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex w-fit items-center gap-1 rounded-md bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand hover:bg-brand/20">📎 Attachment</a>
                      )}
                    </div>
                  </div>
                  <p className="hidden text-sm font-medium md:block">{r.tokens}</p>
                  <p className="hidden text-xs text-muted-foreground md:block">{r.created_at}</p>
                  <div className="hidden md:block"><StatusBadge status={r.status} /></div>
                  <div className="flex items-center gap-2 justify-self-end">
                    <span className="md:hidden"><StatusBadge status={r.status} /></span>
                    {r.status === "pending" && (isAdmin || isApprover) && r.current_level === role ? (
                      <>
                        <div className="hidden gap-1 md:flex">
                          <Button size="sm" className="h-8 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" onClick={() => void approve(r.id)} disabled={rowBusy === r.id}>
                            {rowBusy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5" /> Approve</>}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-rose-400 hover:bg-rose-500/10" onClick={() => void reject(r.id)} disabled={rowBusy === r.id}>
                            <X className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button type="button" aria-label="Row actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent md:hidden">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            }
                          />
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => void approve(r.id)}><Check className="h-4 w-4" /> Approve</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void reject(r.id)} className="text-rose-400 focus:text-rose-400"><X className="h-4 w-4" /> Reject</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    ) : (
                      <span className="hidden text-xs text-muted-foreground md:block">
                        {r.current_level && r.status === "pending" ? `→ ${r.current_level}` : "—"}
                      </span>
                    )}
                  </div>
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

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Request tokens</DialogTitle>
            <DialogDescription>Submit a token request to your upstream parent.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Tokens needed</Label>
              <Input type="number" value={tokens} onChange={(e) => setTokens(e.target.value)} placeholder="1000" />
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
            <GradientButton onClick={() => void submit()} disabled={busy || uploading}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ArrowDownToLine className="h-4 w-4" /> Submit</>}
            </GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
