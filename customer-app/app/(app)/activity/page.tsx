"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Bell, Gift, Wallet, Filter } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
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

const SOURCE_META: Record<Source, { label: string; icon: typeof Wallet; bg: string; fg: string }> = {
  wallet:       { label: "Wallet",       icon: Wallet, bg: "bg-amber-500/10",   fg: "text-amber-500" },
  referral:     { label: "Referral",     icon: Gift,   bg: "bg-pink-500/10",    fg: "text-pink-500" },
  notification: { label: "Notification", icon: Bell,   bg: "bg-sky-500/10",     fg: "text-sky-500" },
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
      <AppHeader title="Activity" />
      <section className="mx-auto max-w-3xl space-y-4 p-4 pb-24 md:max-w-4xl md:p-8">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Audit trail</p>
          <h1 className="text-2xl font-bold tracking-tight">My activity</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Wallet movements, referral bonuses, and notifications you have received.
          </p>
        </div>

        {/* Source filter */}
        <div className="flex flex-wrap gap-2">
          <FilterPill active={source === "all"}          onClick={() => setSource("all")}          label={`All (${total})`} />
          <FilterPill active={source === "wallet"}       onClick={() => setSource("wallet")}       label={`Wallet${source === "wallet" ? ` (${counts.wallet})` : ""}`} />
          <FilterPill active={source === "referral"}     onClick={() => setSource("referral")}     label={`Referral${source === "referral" ? ` (${counts.referral})` : ""}`} />
          <FilterPill active={source === "notification"} onClick={() => setSource("notification")} label={`Notification${source === "notification" ? ` (${counts.notification})` : ""}`} />
        </div>

        {/* Feed */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-surface-2/60 shimmer" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <LuxuryCard hoverLift={false} className="border-dashed p-12 text-center">
            <Filter className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No activity yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {source === "all"
                ? "When you transact, refer friends, or receive notifications, they will appear here."
                : "Try a different filter or check back later."}
            </p>
          </LuxuryCard>
        ) : (
          <div className="space-y-2">
            {items.map((it, i) => {
              const M = SOURCE_META[it.source];
              return (
                <motion.div
                  key={`${it.source}-${it.event_id}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.02 }}
                >
                  <LuxuryCard hoverLift={false} className="flex items-center gap-3 p-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${M.bg} ${M.fg}`}>
                      <M.icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium">{it.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {M.label} · {formatDateTime(it.created_at)}
                      </p>
                    </div>
                    {it.amount != null && (
                      <p className={`shrink-0 text-sm font-bold ${it.amount >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                        {it.amount >= 0 ? "+" : ""}{fmtINR(it.amount)}
                      </p>
                    )}
                  </LuxuryCard>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2 text-xs">
            <p className="text-muted-foreground">
              Page {page} of {pageCount} · {total} event{total === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((n) => Math.max(1, n - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-border bg-surface-2/40 px-3 py-1 font-medium hover:border-brand/40 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((n) => Math.min(pageCount, n + 1))}
                disabled={page >= pageCount}
                className="rounded-lg border border-border bg-surface-2/40 px-3 py-1 font-medium hover:border-brand/40 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
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
