"use client";

import { useEffect, useState } from "react";
import { Users, Search, MoreHorizontal, Ban, CheckCircle2, Wallet as WalletIcon } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/data-table/status-badge";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { Pagination } from "@/components/data-table/pagination";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { mock, type ManagedCustomer } from "@/lib/mock";

const PAGE_SIZE = 20;
const fmtINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

type CustomerStats = { total: number; active: number; blocked: number; wallet_sum: number };

// Normalize backend payload to ManagedCustomer — the backend may use mobile_number / wallet
function normalizeCustomer(raw: unknown): ManagedCustomer {
  const r = raw as Record<string, unknown>;
  const mobile = (r.mobile ?? r.mobile_number ?? "") as string;
  const wallet = Number(r.wallet_balance ?? r.wallet ?? 0);
  return {
    id: Number(r.id ?? 0),
    name: (r.name ?? "") as string,
    mobile,
    pincode: (r.pincode ?? "") as string,
    wallet_balance: Number.isFinite(wallet) ? wallet : 0,
    status: ((r.status === "blocked" ? "blocked" : "active") as "active" | "blocked"),
  };
}

export default function AdminCustomersPage() {
  const [items, setItems] = useState<ManagedCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "blocked">("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<CustomerStats>({ total: 0, active: 0, blocked: 0, wallet_sum: 0 });

  // Debounce the search box — it drives a server-side query, not local filtering.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // A new query or status filter always restarts at page 1.
  useEffect(() => { setPage(1); }, [debouncedSearch, status]);

  // Fetch one server page at a time; the backend owns filtering, paging and the
  // aggregate stat counts (there are far more customers than fit on one page).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await api.get("/admin/customers", {
          params: {
            q: debouncedSearch || undefined,
            status: status !== "all" ? status : undefined,
            page,
            per_page: PAGE_SIZE,
          },
        });
        if (cancelled) return;
        const payload = res.data.data;
        const raw = (Array.isArray(payload?.items) ? payload.items
                   : Array.isArray(payload) ? payload
                   : []) as unknown[];
        setItems(raw.map(normalizeCustomer));
        setTotal(Number(payload?.total ?? raw.length));
        const s = payload?.stats;
        if (s) {
          setStats({
            total: Number(s.total ?? 0),
            active: Number(s.active ?? 0),
            blocked: Number(s.blocked ?? 0),
            wallet_sum: Number(s.wallet_sum ?? 0),
          });
        }
      } catch (err) {
        if (cancelled) return;
        // Network or backend not reachable — fall back to mock so the page stays usable
        toast.error(apiErrorMessage(err, "Could not load customers, showing offline sample"));
        const m = await mock.customers();
        setItems(m);
        setTotal(m.length);
        setStats({
          total: m.length,
          active: m.filter((c) => c.status === "active").length,
          blocked: m.filter((c) => c.status === "blocked").length,
          wallet_sum: m.reduce((sum, c) => sum + c.wallet_balance, 0),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedSearch, status, page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);

  async function toggle(c: ManagedCustomer) {
    const next = c.status === "active" ? "blocked" : "active";
    const action = next === "active" ? "unblock" : "block";
    try {
      await api.post(`/admin/customers/${c.id}/${action}`);
      setItems((cur) => cur.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
      setStats((s) => ({
        ...s,
        active: s.active + (next === "active" ? 1 : -1),
        blocked: s.blocked + (next === "blocked" ? 1 : -1),
      }));
      toast.success(`${c.name} ${next}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, `Could not ${action} ${c.name}`));
    }
  }

  return (
    <>
      <MobileHeader title="Customers" />
      <section className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <PageHeader eyebrow="Users" icon={Users} title="Customers" description="Manage customer accounts, wallet balances and access." />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total customers" value={stats.total}      icon={Users}        tone="brand"   spark={[4, 5, 5, 6, 6, 7, 7, 8]} />
          <StatCard label="Active"          value={stats.active}     icon={CheckCircle2} tone="emerald" spark={[4, 5, 5, 6, 6, 7, 7, 8]} />
          <StatCard label="Blocked"         value={stats.blocked}    icon={Ban}          tone="amber"   spark={[1, 1, 1, 1, 1, 1, 1, 1]} />
          <StatCard label="Wallet held"     value={stats.wallet_sum} icon={WalletIcon}   tone="violet"  spark={[3, 4, 5, 5, 6, 6, 7, 7]} format={fmtINR} />
        </div>

        <div className="glass rounded-2xl p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search id, name, mobile, pincode…" className="h-10 rounded-xl bg-surface-2/60 pl-9" />
            </div>
            <Select value={status} onValueChange={(v) => v && setStatus(v as "all" | "active" | "blocked")}>
              <SelectTrigger className="h-10 rounded-xl bg-surface-2/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="luxe-card overflow-hidden">
          <div className="hidden grid-cols-[70px_1fr_140px_140px_120px_56px] gap-3 border-b border-border bg-surface-2/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>ID</span>
            <span>Customer</span>
            <span>Mobile</span>
            <span>Wallet</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          {loading ? (
            <div className="p-3"><TableSkeleton rows={6} cols={5} /></div>
          ) : items.length === 0 ? (
            <EmptyState icon={Users} title="No customers match your filters" description="Try a different search or status filter." />
          ) : (
            <div className="divide-y divide-border">
              {items.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40 md:grid-cols-[70px_1fr_140px_140px_120px_56px]"
                >
                  <p className="hidden font-mono text-xs text-muted-foreground md:block">#{c.id}</p>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-xs font-semibold text-brand">
                      {(c.name || "?").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{c.name || "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        <span className="md:hidden">#{c.id} · </span>
                        {c.mobile || c.pincode || "—"}
                      </p>
                    </div>
                  </div>
                  <p className="hidden text-sm font-mono text-muted-foreground md:block">{c.mobile || "—"}</p>
                  <p className="hidden text-sm font-medium text-emerald-400 md:block">{fmtINR(c.wallet_balance)}</p>
                  <div className="hidden md:block"><StatusBadge status={c.status} /></div>
                  <div className="flex items-center gap-2 justify-self-end">
                    <span className="md:hidden"><StatusBadge status={c.status} /></span>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button type="button" aria-label="Row actions" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => toggle(c)}>
                          {c.status === "active" ? <><Ban className="h-4 w-4" /> Block customer</> : <><CheckCircle2 className="h-4 w-4" /> Unblock customer</>}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          {!loading && total > 0 && (
            <div className="border-t border-border bg-surface-2/40 px-4 py-3">
              <Pagination page={safePage} pageCount={pageCount} onPageChange={setPage} total={total} pageSize={PAGE_SIZE} />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
