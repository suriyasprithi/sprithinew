"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Bell, Gift, Wallet, Filter } from "lucide-react";
import { toast } from "sonner";
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

type Source = "wallet" | "referral" | "notification";
type ActivityItem = {
  source: Source;
  event_id: number;
  title: string;
  amount: number | null;
  created_at: string;
};

const SOURCE_META: Record<Source, { label: string; icon: typeof Wallet; tone: string }> = {
  wallet:       { label: "Wallet",       icon: Wallet, tone: "bg-amber-500/10 text-amber-400" },
  referral:     { label: "Referral",     icon: Gift,   tone: "bg-pink-500/10 text-pink-400" },
  notification: { label: "Notification", icon: Bell,   tone: "bg-sky-500/10 text-sky-400" },
};

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [source, setSource] = useState<"all" | Source>("all");

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { page, per_page: PAGE_SIZE };
        if (source !== "all") params.source = source;
        const r = await api.get("/activity/mine", { params });
        if (!active) return;
        setItems((r.data.data?.items ?? []) as ActivityItem[]);
        setTotal(Number(r.data.data?.total ?? 0));
      } catch (e) {
        if (!active) return;
        toast.error(apiErrorMessage(e, "Couldn't load activity"));
        setItems([]); setTotal(0);
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [page, source]);

  useEffect(() => { setPage(1); }, [source]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const counts = useMemo(() => ({
    wallet:       items.filter((i) => i.source === "wallet").length,
    referral:     items.filter((i) => i.source === "referral").length,
    notification: items.filter((i) => i.source === "notification").length,
  }), [items]);

  return (
    <>
      <MobileHeader title="My Activity" />
      <section className="mx-auto max-w-5xl space-y-6 p-4 pb-24 md:p-8">
        <PageHeader
          eyebrow="Audit"
          icon={Activity}
          title="My activity"
          description="Wallet movements, referral bonuses you have earned, and notifications you have received."
        />

        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="Total events"  value={total}                icon={Activity} tone="brand"   spark={[1, 2, 3, 4, 5, 6, 7, 8]} />
          <StatCard label="Wallet (page)" value={counts.wallet}        icon={Wallet}   tone="amber"   spark={[2, 3, 3, 4, 4, 5, 6, 6]} />
          <StatCard label="Referral (page)" value={counts.referral}    icon={Gift}     tone="pink"    spark={[0, 1, 1, 2, 2, 3, 3, 4]} />
          <StatCard label="Notif (page)"  value={counts.notification}  icon={Bell}     tone="cyan"    spark={[1, 1, 2, 2, 3, 4, 4, 5]} />
        </div>

        {/* Source filter pills */}
        <div className="glass rounded-2xl p-3">
          <div className="flex flex-wrap gap-2">
            <FilterPill active={source === "all"}          onClick={() => setSource("all")}          label="All" />
            <FilterPill active={source === "wallet"}       onClick={() => setSource("wallet")}       label="Wallet" />
            <FilterPill active={source === "referral"}     onClick={() => setSource("referral")}     label="Referral" />
            <FilterPill active={source === "notification"} onClick={() => setSource("notification")} label="Notification" />
          </div>
        </div>

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[140px_1fr_140px_140px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>When</span>
            <span>Event</span>
            <span>Type</span>
            <span className="text-right">Amount</span>
          </div>
          {loading ? (
            <div className="p-3"><TableSkeleton rows={8} cols={4} /></div>
          ) : items.length === 0 ? (
            <EmptyState icon={Filter} title="No activity yet" description="When you transact or receive notifications they will show up here." />
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
                    className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[140px_1fr_140px_140px]"
                  >
                    <p className="hidden font-mono text-xs text-muted-foreground md:block">{formatDateTime(it.created_at)}</p>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${M.tone}`}>
                        <M.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-medium">{it.title}</p>
                        <p className="text-[11px] text-muted-foreground md:hidden">{formatDateTime(it.created_at)} · {M.label}</p>
                      </div>
                    </div>
                    <p className="hidden text-xs uppercase tracking-wider text-muted-foreground md:block">{M.label}</p>
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

function FilterPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
        (active
          ? "border-brand bg-brand/10 text-brand"
          : "border-border bg-surface hover:border-brand/40")
      }
    >
      {label}
    </button>
  );
}
