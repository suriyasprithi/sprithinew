"use client";

import { useEffect, useMemo, useState } from "react";
import { Gift, Search, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { Pagination } from "@/components/data-table/pagination";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { cn } from "@/lib/utils";

type PoolRow = {
  id: number;
  period: string;
  collected: number;
  distributed: number;
  winner_user_id: number | null;
  winner_name: string | null;
  winner_mobile: string | null;
  winner_amount: number;
  distributed_at: string | null;
  notes: string | null;
};

type Customer = {
  id: number;
  name: string;
  mobile_number?: string;
  mobile?: string;
};

type EntryRow = {
  id: number;
  refer_code: string | null;
  mobile_number: string | null;
  vendor_name: string | null;
  taluk_name: string | null;
  status: number;
  created_at: string | null;
};

const ENTRIES_PAGE_SIZE = 20;

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

const fmtMonth = (p: string) => {
  if (!/^\d{4}-\d{2}$/.test(p)) return p;
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
};

export default function LuckyDrawPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<PoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<PoolRow | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<Customer | null>(null);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  // Imported legacy raffle entries (separate from the V2 monthly pools).
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [entriesTotal, setEntriesTotal] = useState(0);
  const [entriesPage, setEntriesPage] = useState(1);
  const [entriesLoading, setEntriesLoading] = useState(true);

  useEffect(() => {
    setEntriesLoading(true);
    void (async () => {
      try {
        const res = await api.get("/admin/lucky-draw/entries", { params: { page: entriesPage, per_page: ENTRIES_PAGE_SIZE } });
        setEntries((res.data?.data?.items ?? []) as EntryRow[]);
        setEntriesTotal(Number(res.data?.data?.total ?? 0));
      } catch (e) {
        toast.error(apiErrorMessage(e, "Failed to load lucky-draw entries"));
      } finally {
        setEntriesLoading(false);
      }
    })();
  }, [entriesPage]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/admin/lucky-draw/pools");
      setItems((res.data?.data?.items ?? []) as PoolRow[]);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Failed to load lucky draw pools"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  // Debounced customer search
  useEffect(() => {
    if (!picking) return;
    const q = search.trim();
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.get("/admin/customers", { params: { q } });
        const raws = (res.data?.data?.items ?? []) as Customer[];
        setResults(raws.slice(0, 10));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [search, picking]);

  const totals = useMemo(() => {
    const cur = new Date();
    const thisPeriod = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
    const all = items.reduce((s, r) => s + (r.collected || 0), 0);
    const distributed = items.reduce((s, r) => s + (r.distributed || 0), 0);
    const thisMonth = items.find((r) => r.period === thisPeriod);
    return {
      thisMonth: thisMonth?.collected ?? 0,
      all,
      distributed,
      pending: all - distributed,
    };
  }, [items]);

  function openPick(row: PoolRow) {
    setPicking(row);
    setChosen(null);
    setSearch("");
    setResults([]);
    setAmount(String(row.collected.toFixed(2)));
  }
  function closePick() {
    setPicking(null);
    setChosen(null);
    setSearch("");
    setResults([]);
    setAmount("");
  }

  async function submit() {
    if (!picking) return;
    if (!chosen) { toast.error("Pick a customer"); return; }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (amt > picking.collected) { toast.error("Amount exceeds collected"); return; }
    setSaving(true);
    try {
      await api.post(`/admin/lucky-draw/pools/${picking.id}/pick-winner`, {
        user_id: chosen.id,
        amount: amt,
      });
      toast.success(`Winner picked — ${chosen.name} gets ${fmtINR(amt)}`);
      closePick();
      await load();
    } catch (e) {
      toast.error(apiErrorMessage(e, "Pick failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <MobileHeader title="Lucky Draw" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Finance"
          icon={Gift}
          title="Lucky Draw"
          description="3% of every order's pool accrues here. Pick a winner each month — they get their share credited to global wallet."
        />

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Gift className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[15px] font-bold">Lucky wallet</p>
              <p className="text-xs text-muted-foreground">Your accumulated lucky-draw balance (carried over from the old site).</p>
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight">{fmtINR(user?.lucky_wallet ?? 0)}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="This month"      value={totals.thisMonth} icon={Gift}    tone="brand"   format={fmtINR} spark={[1,1,1,2,2,3,3,3]} />
          <StatCard label="Pending payout"  value={totals.pending}   icon={Gift}    tone="amber"   format={fmtINR} spark={[2,2,3,3,3,3,3,3]} />
          <StatCard label="Total distributed" value={totals.distributed} icon={Trophy} tone="emerald" format={fmtINR} spark={[1,1,2,2,2,3,3,3]} />
          <StatCard label="All-time collected" value={totals.all} icon={Gift} tone="violet" format={fmtINR} spark={[1,2,3,3,3,3,3,3]} />
        </div>

        {/* V2 monthly pools — only shown once there's an actual pool (fills from new orders). */}
        {(loading || items.length > 0) && (
        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[120px_140px_140px_1fr_140px_140px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Period</span>
            <span>Collected</span>
            <span>Distributed</span>
            <span>Winner</span>
            <span>Status</span>
            <span className="text-right">Action</span>
          </div>
          {loading ? (
            <div className="p-3"><TableSkeleton rows={4} cols={6} /></div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Gift}
              title="No lucky-draw pools yet"
              description="As orders come in, 3% of every pool will accrue here, grouped by month."
            />
          ) : (
            <div className="divide-y divide-border">
              {items.map((r, i) => {
                const decided = !!r.distributed_at;
                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[120px_140px_140px_1fr_140px_140px]"
                  >
                    <p className="text-sm font-semibold">{fmtMonth(r.period)}</p>
                    <p className="hidden text-sm font-medium md:block">{fmtINR(r.collected)}</p>
                    <p className="hidden text-sm font-medium md:block">{r.distributed > 0 ? fmtINR(r.distributed) : "—"}</p>
                    <div className="hidden md:block">
                      {r.winner_user_id ? (
                        <div>
                          <p className="text-sm font-semibold">{r.winner_name ?? `User #${r.winner_user_id}`}</p>
                          <p className="text-[11px] text-muted-foreground">{r.winner_mobile ?? "—"}</p>
                        </div>
                      ) : <p className="text-sm text-muted-foreground">—</p>}
                    </div>
                    <div className="hidden md:block">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                        decided
                          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border border-amber-500/30 bg-amber-500/10 text-amber-400",
                      )}>
                        {decided ? "Distributed" : "Pending"}
                      </span>
                    </div>
                    <div className="justify-self-end">
                      {decided ? (
                        <span className="text-[10px] text-muted-foreground">{r.distributed_at?.slice(0, 10)}</span>
                      ) : (
                        <Button size="sm" onClick={() => openPick(r)} className="rounded-lg">
                          <Trophy className="mr-1 h-3.5 w-3.5" /> Pick winner
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
        )}

        {/* Imported legacy raffle entries */}
        <div className="luxe-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-surface-2/40 px-4 py-3">
            <p className="text-sm font-semibold">Lucky draw entries <span className="font-normal text-muted-foreground">(imported)</span></p>
            <span className="text-xs text-muted-foreground">{entriesTotal} total</span>
          </div>
          <div className="hidden grid-cols-[1fr_140px_1fr_110px_90px] gap-3 border-b border-border bg-surface-2/20 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Refer code</span>
            <span>Mobile</span>
            <span>Vendor / Taluk</span>
            <span>Date</span>
            <span>Status</span>
          </div>
          {entriesLoading ? (
            <div className="p-3"><TableSkeleton rows={5} cols={5} /></div>
          ) : entries.length === 0 ? (
            <EmptyState icon={Gift} title="No imported entries" description="No lucky-draw entries were imported from the old site." />
          ) : (
            <div className="divide-y divide-border">
              {entries.map((e, i) => (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.015 }}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[1fr_140px_1fr_110px_90px]"
                >
                  <p className="min-w-0 truncate text-sm font-medium">{e.refer_code || "—"}</p>
                  <p className="hidden text-sm text-muted-foreground md:block">{e.mobile_number || "—"}</p>
                  <p className="hidden min-w-0 truncate text-sm text-muted-foreground md:block">{[e.vendor_name, e.taluk_name].filter(Boolean).join(" · ") || "—"}</p>
                  <p className="hidden text-xs text-muted-foreground md:block">{e.created_at?.slice(0, 10) || "—"}</p>
                  <div className="justify-self-end md:justify-self-start">
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                      e.status === 1
                        ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                        : "border border-muted-foreground/30 bg-muted-foreground/10 text-muted-foreground",
                    )}>
                      {e.status === 1 ? "Active" : "Inactive"}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          {!entriesLoading && entriesTotal > ENTRIES_PAGE_SIZE && (
            <div className="border-t border-border bg-surface-2/40 px-4 py-3">
              <Pagination
                page={entriesPage}
                pageCount={Math.max(1, Math.ceil(entriesTotal / ENTRIES_PAGE_SIZE))}
                onPageChange={setEntriesPage}
                total={entriesTotal}
                pageSize={ENTRIES_PAGE_SIZE}
              />
            </div>
          )}
        </div>
      </section>

      <Dialog open={!!picking} onOpenChange={(o) => !o && closePick()}>
        <DialogContent className="rounded-2xl border-border bg-popover sm:!max-w-md">
          <DialogHeader>
            <DialogTitle>Pick winner — {picking ? fmtMonth(picking.period) : ""}</DialogTitle>
            <DialogDescription>
              {picking ? `Pool collected: ${fmtINR(picking.collected)}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Search customer (name or mobile)</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setChosen(null); }}
                  placeholder="Asha or 9876543210"
                  className="h-10 rounded-xl bg-surface-2/60 pl-9"
                />
              </div>
              {search.length >= 2 && !chosen && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-surface-2/40">
                  {searching ? (
                    <p className="p-3 text-xs text-muted-foreground">Searching…</p>
                  ) : results.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">No matching customers</p>
                  ) : results.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setChosen(c); setSearch(""); setResults([]); }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-brand/10"
                    >
                      <span className="font-semibold">{c.name}</span>
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        #{c.id} · {c.mobile_number ?? c.mobile ?? "—"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {chosen && (
              <div className="flex items-center justify-between rounded-lg border border-brand/30 bg-brand/5 p-3">
                <div>
                  <p className="text-sm font-semibold">{chosen.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    #{chosen.id} · {chosen.mobile_number ?? chosen.mobile ?? "—"}
                  </p>
                </div>
                <button type="button" onClick={() => setChosen(null)} className="text-xs font-semibold text-brand hover:underline">Change</button>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Amount to credit (₹)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={picking?.collected ?? 0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-10 rounded-xl bg-surface-2/60"
              />
              <p className="text-[11px] text-muted-foreground">
                Max {picking ? fmtINR(picking.collected) : "₹0"}. Defaults to the whole pool. Credited to winner&apos;s global wallet.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closePick} disabled={saving}>Cancel</Button>
            <GradientButton onClick={submit} disabled={saving || !chosen}>
              {saving ? "Saving…" : "Pick & credit"}
            </GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
