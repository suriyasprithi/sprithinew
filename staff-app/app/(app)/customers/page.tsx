"use client";

import { useEffect, useMemo, useState } from "react";
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

const PAGE_SIZE = 10;
const fmtINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

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
  const [status, setStatus] = useState<"all" | "active" | "blocked">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/admin/customers");
        const payload = res.data.data;
        const raw = (Array.isArray(payload?.items) ? payload.items
                   : Array.isArray(payload) ? payload
                   : []) as unknown[];
        setItems(raw.map(normalizeCustomer));
      } catch (err) {
        // Network or backend not reachable — fall back to mock so the page stays usable
        toast.error(apiErrorMessage(err, "Could not load customers, showing offline sample"));
        setItems(await mock.customers());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => items.filter((c) => {
    if (search) {
      const q = search.toLowerCase();
      const name = (c.name ?? "").toLowerCase();
      const mobile = c.mobile ?? "";
      const pincode = c.pincode ?? "";
      const idStr = String(c.id ?? "");
      if (!name.includes(q) && !mobile.includes(q) && !pincode.includes(q) && !idStr.includes(q)) return false;
    }
    if (status !== "all" && c.status !== status) return false;
    return true;
  }), [items, search, status]);

  useEffect(() => setPage(1), [search, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalActive = items.filter((c) => c.status === "active").length;
  const totalBlocked = items.filter((c) => c.status === "blocked").length;
  const totalWallet = items.reduce((s, c) => s + c.wallet_balance, 0);

  async function toggle(c: ManagedCustomer) {
    const next = c.status === "active" ? "blocked" : "active";
    const action = next === "active" ? "unblock" : "block";
    try {
      await api.post(`/admin/customers/${c.id}/${action}`);
      setItems((cur) => cur.map((x) => (x.id === c.id ? { ...x, status: next } : x)));
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
          <StatCard label="Total customers" value={items.length}  icon={Users}        tone="brand"   spark={[4, 5, 5, 6, 6, 7, 7, 8]} />
          <StatCard label="Active"          value={totalActive}   icon={CheckCircle2} tone="emerald" spark={[4, 5, 5, 6, 6, 7, 7, 8]} />
          <StatCard label="Blocked"         value={totalBlocked}  icon={Ban}          tone="amber"   spark={[1, 1, 1, 1, 1, 1, 1, 1]} />
          <StatCard label="Wallet held"     value={totalWallet}   icon={WalletIcon}   tone="violet"  spark={[3, 4, 5, 5, 6, 6, 7, 7]} format={fmtINR} />
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
          ) : paged.length === 0 ? (
            <EmptyState icon={Users} title="No customers match your filters" description="Try a different search or status filter." />
          ) : (
            <div className="divide-y divide-border">
              {paged.map((c, i) => (
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
          {!loading && filtered.length > 0 && (
            <div className="border-t border-border bg-surface-2/40 px-4 py-3">
              <Pagination page={safePage} pageCount={pageCount} onPageChange={setPage} total={filtered.length} pageSize={PAGE_SIZE} />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
