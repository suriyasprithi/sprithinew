"use client";

import { useEffect, useState } from "react";
import { Bell, Gift, Wallet, Filter, X } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { api, apiErrorMessage } from "@/lib/api";

const PAGE_SIZE = 50;
const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

type Source = "wallet" | "referral" | "notification";
type Direction = "" | "credit" | "debit";
type ActivityItem = {
  source: Source;
  event_id: number;
  title: string;
  amount: number | null;
  direction: "credit" | "debit" | null;
  created_at: string;
};

const SOURCE_META: Record<Source, { label: string; icon: typeof Wallet; bg: string; fg: string }> = {
  wallet:       { label: "Wallet",       icon: Wallet, bg: "bg-amber-500/10",   fg: "text-amber-500" },
  referral:     { label: "Referral",     icon: Gift,   bg: "bg-pink-500/10",    fg: "text-pink-500" },
  notification: { label: "Notification", icon: Bell,   bg: "bg-sky-500/10",     fg: "text-sky-500" },
};
const ALL_SOURCES: Source[] = ["wallet", "referral", "notification"];

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

  // Multi-select / combinable filters.
  const [sources, setSources] = useState<Source[]>([]); // empty = all
  const [direction, setDirection] = useState<Direction>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const referralInScope = sources.length === 0 || sources.includes("referral");

  // Serialized filter params (also used as effect deps so arrays compare by value).
  const sourceParam = sources.length > 0 && sources.length < ALL_SOURCES.length ? sources.join(",") : "";
  // L2/L3 history is hidden everywhere — only L1 referral bonuses are ever shown.
  const levelParam = referralInScope ? "1" : "";

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const params: Record<string, string | number> = { page, per_page: PAGE_SIZE };
        if (sourceParam) params.source = sourceParam;
        if (levelParam) params.levels = levelParam;
        if (direction) params.direction = direction;
        if (from) params.from = from;
        if (to) params.to = to;
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
  }, [page, sourceParam, levelParam, direction, from, to]);

  // Any filter change also returns to the first page (done in the handlers,
  // not an effect, so we never setState synchronously inside an effect).
  const resetPage = () => setPage(1);
  const toggleSource = (s: Source) => {
    setSources((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
    resetPage();
  };
  const chooseAllSources = () => { setSources([]); resetPage(); };
  const chooseDirection = (d: Direction) => { setDirection(d); resetPage(); };
  const changeFrom = (v: string) => { setFrom(v); resetPage(); };
  const changeTo = (v: string) => { setTo(v); resetPage(); };

  const hasFilters = sources.length > 0 || direction !== "" || from !== "" || to !== "";
  const clearAll = () => { setSources([]); setDirection(""); setFrom(""); setTo(""); resetPage(); };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

        {/* Filters */}
        <div className="space-y-2.5">
          {/* Source — multi-select */}
          <div className="flex flex-wrap gap-2">
            <FilterPill active={sources.length === 0} onClick={chooseAllSources} label={`All (${total})`} />
            {ALL_SOURCES.map((s) => (
              <FilterPill key={s} active={sources.includes(s)} onClick={() => toggleSource(s)} label={SOURCE_META[s].label} />
            ))}
          </div>

          {/* Direction + date range */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Type</span>
            <FilterPill small active={direction === ""}       onClick={() => chooseDirection("")}       label="All" />
            <FilterPill small active={direction === "credit"} onClick={() => chooseDirection("credit")} label="Credit" />
            <FilterPill small active={direction === "debit"}  onClick={() => chooseDirection("debit")}  label="Debit" />
            <span className="mx-0.5 h-4 w-px bg-border" />
            <input
              type="date" value={from} max={to || undefined} onChange={(e) => changeFrom(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-xs"
              aria-label="From date"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date" value={to} min={from || undefined} onChange={(e) => changeTo(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-xs"
              aria-label="To date"
            />
            {hasFilters && (
              <button
                type="button" onClick={clearAll}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-brand/40"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
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
              {hasFilters
                ? "No events match these filters. Try widening or clearing them."
                : "When you transact, refer friends, or receive notifications, they will appear here."}
            </p>
          </LuxuryCard>
        ) : (
          <div className="space-y-2">
            {items.map((it, i) => {
              const M = SOURCE_META[it.source];
              const isDebit = it.direction === "debit";
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
                      <p className={`shrink-0 text-sm font-bold ${isDebit ? "text-rose-500" : "text-emerald-500"}`}>
                        {isDebit ? "−" : "+"}{fmtINR(Math.abs(it.amount))}
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

function FilterPill({ active, onClick, label, small }: { active: boolean; onClick: () => void; label: string; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border font-medium transition-colors " +
        (small ? "px-2.5 py-1 text-[11px] " : "px-3 py-1.5 text-xs ") +
        (active
          ? "border-brand bg-brand/10 text-brand"
          : "border-border bg-surface hover:border-brand/40")
      }
    >
      {label}
    </button>
  );
}
