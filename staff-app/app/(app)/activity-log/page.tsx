"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Search, Wallet, UserPlus, Gift, Filter } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { Pagination } from "@/components/data-table/pagination";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";

const PAGE_SIZE = 50;
const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

type Source = "signup" | "referral" | "wallet";
type ActivityItem = {
  source: Source;
  event_id: number;
  actor_id: number;
  actor_name: string;
  actor_mobile: string;
  actor_role: string;
  title: string;
  amount: number | null;
  created_at: string;
};

const SOURCE_META: Record<Source, { label: string; icon: typeof UserPlus; tone: string }> = {
  signup:   { label: "Signup",   icon: UserPlus, tone: "bg-emerald-500/10 text-emerald-400" },
  referral: { label: "Referral", icon: Gift,     tone: "bg-pink-500/10 text-pink-400" },
  wallet:   { label: "Wallet",   icon: Wallet,   tone: "bg-amber-500/10 text-amber-400" },
};

const ROLE_OPTIONS = ["all", "admin", "state", "district", "taluk", "vendor", "driver", "customer"] as const;
type RoleFilter = (typeof ROLE_OPTIONS)[number];

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function ActivityLogPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actor, setActor] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [source, setSource] = useState<"all" | Source>("all");

  const debouncedActor = useDebounced(actor, 350);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { page, per_page: PAGE_SIZE };
        if (from)               params.from   = from;
        if (to)                 params.to     = to;
        if (debouncedActor)     params.actor  = debouncedActor;
        if (role !== "all")     params.role   = role;
        if (source !== "all")   params.source = source;
        const res = await api.get("/admin/activity", { params });
        if (!active) return;
        setItems((res.data.data?.items ?? []) as ActivityItem[]);
        setTotal(Number(res.data.data?.total ?? 0));
      } catch (err) {
        if (!active) return;
        toast.error(apiErrorMessage(err, "Could not load activity"));
        setItems([]);
        setTotal(0);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [page, from, to, debouncedActor, role, source]);

  useEffect(() => { setPage(1); }, [from, to, debouncedActor, role, source]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const counts = useMemo(() => ({
    signup:   items.filter((i) => i.source === "signup").length,
    referral: items.filter((i) => i.source === "referral").length,
    wallet:   items.filter((i) => i.source === "wallet").length,
  }), [items]);

  return (
    <>
      <MobileHeader title="Activity Log" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Audit"
          icon={ClipboardList}
          title="Activity Log"
          description="Chronological feed of signups, referrals and wallet transactions. Aggregated from existing tables."
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total events"    value={total}          icon={ClipboardList} tone="brand"   spark={[2, 3, 4, 5, 6, 7, 8, 9]} />
          <StatCard label="Signups (page)"  value={counts.signup}  icon={UserPlus}      tone="emerald" spark={[1, 1, 2, 2, 3, 3, 4, 4]} />
          <StatCard label="Referrals (page)" value={counts.referral} icon={Gift}        tone="pink"    spark={[1, 2, 2, 3, 3, 4, 4, 5]} />
          <StatCard label="Wallet (page)"   value={counts.wallet}  icon={Wallet}        tone="amber"   spark={[3, 4, 5, 6, 7, 8, 9, 10]} />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_140px_140px_160px_160px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                placeholder="Actor name or mobile…"
                className="h-10 rounded-xl bg-surface-2/60 pl-9"
              />
            </div>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 rounded-xl bg-surface-2/60" />
            <Input type="date" value={to}   onChange={(e) => setTo(e.target.value)}   className="h-10 rounded-xl bg-surface-2/60" />
            <Select value={role} onValueChange={(v) => v && setRole(v as RoleFilter)}>
              <SelectTrigger className="h-10 rounded-xl bg-surface-2/60"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r === "all" ? "Any role" : r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={(v) => v && setSource(v as "all" | Source)}>
              <SelectTrigger className="h-10 rounded-xl bg-surface-2/60"><SelectValue placeholder="Source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any source</SelectItem>
                <SelectItem value="signup">Signup</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="wallet">Wallet</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[140px_1fr_180px_120px_140px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>When</span>
            <span>Event</span>
            <span>Actor</span>
            <span>Role</span>
            <span className="text-right">Amount</span>
          </div>
          {loading ? (
            <div className="p-3"><TableSkeleton rows={8} cols={5} /></div>
          ) : items.length === 0 ? (
            <EmptyState icon={Filter} title="No activity matches your filters" description="Try widening the date range or clearing search." />
          ) : (
            <div className="divide-y divide-border">
              {items.map((it, i) => {
                const M = SOURCE_META[it.source];
                return (
                  <motion.div
                    key={`${it.source}-${it.event_id}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 20) * 0.015 }}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[140px_1fr_180px_120px_140px]"
                  >
                    <p className="hidden font-mono text-xs text-muted-foreground md:block">{it.created_at?.slice(0, 16) ?? "—"}</p>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${M.tone}`}>
                        <M.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{it.title}</p>
                        <p className="truncate text-[11px] text-muted-foreground md:hidden">
                          {it.created_at?.slice(0, 16)} · {M.label}
                        </p>
                      </div>
                    </div>
                    <div className="hidden min-w-0 md:block">
                      <p className="truncate text-sm">{it.actor_name || "—"}</p>
                      <p className="truncate text-[11px] font-mono text-muted-foreground">{it.actor_mobile || ""}</p>
                    </div>
                    <p className="hidden text-xs uppercase tracking-wider text-muted-foreground md:block">{it.actor_role}</p>
                    <p className={`justify-self-end text-sm font-mono ${it.amount == null ? "text-muted-foreground" : it.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {it.amount == null ? "—" : (it.amount >= 0 ? "+" : "") + fmtINR(it.amount)}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          )}
          {!loading && total > 0 && (
            <div className="border-t border-border bg-surface-2/40 px-4 py-3">
              <Pagination page={page} pageCount={pageCount} onPageChange={setPage} total={total} pageSize={PAGE_SIZE} />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
