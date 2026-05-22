"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Users, Store, ShoppingCart, Banknote, CreditCard, Wallet, Coins, Package, Building2,
  Plus, Send, Bell as BellIcon, Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { Shimmer } from "@/components/ui/custom/shimmer";
import { StatCard, type StatTone } from "@/components/dashboard/stat-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { ActivityTimeline } from "@/components/dashboard/activity-timeline";
import { VendorPerformance } from "@/components/dashboard/vendor-performance";
import { QuickActions, type QuickAction } from "@/components/dashboard/quick-actions";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { LatestVendors } from "@/components/dashboard/latest-vendors";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { useAuth } from "@/stores/auth";
import { ROLE_LABEL } from "@/lib/role-menu";
import { mock, type StaffStats, type ChartPoint, type ActivityRow } from "@/lib/mock";
import { getAdminDashboard, getVendorDashboard, getStaffDashboard, type AdminDashboard, type VendorDashboard } from "@/lib/admin-stats";
import { api } from "@/lib/api";

const fmtINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

const SPARKS = {
  up:     [3, 4, 3, 5, 6, 5, 7, 8],
  upFast: [2, 3, 5, 4, 6, 8, 9, 11],
  flat:   [5, 6, 5, 6, 5, 6, 6, 6],
  wave:   [4, 6, 5, 7, 5, 8, 6, 9],
  down:   [9, 8, 8, 6, 7, 5, 4, 3],
  upSm:   [1, 2, 1, 3, 2, 4, 3, 4],
};

type TileDef = {
  label: string; value: number; icon: LucideIcon; tone: StatTone;
  href?: string; delta?: number; format?: (v: number) => string; spark: number[];
};

function tilesFor(role: string, s: StaffStats): TileDef[] {
  switch (role) {
    case "vendor":
      return [
        { label: "Today's orders",  value: s.todays_orders ?? 0,    href: "/orders",   icon: ShoppingCart, tone: "brand",   delta:  2.1, spark: SPARKS.upFast },
        { label: "Active products", value: s.active_products ?? 0,  href: "/products", icon: Package,      tone: "emerald", delta:  0.4, spark: SPARKS.flat },
        { label: "Token balance",   value: s.tokens_received ?? 0,  href: "/tokens",   icon: Coins,        tone: "amber",   delta: -0.8, spark: SPARKS.down },
        { label: "Wallet",          value: s.wallet ?? 0,           href: "/wallet",   icon: Wallet,       tone: "violet",  delta:  1.6, spark: SPARKS.up, format: fmtINR },
      ];
    case "taluk":
      return [
        { label: "Vendors in my taluk", value: s.vendors ?? 0,         href: "/manage-vendors",   icon: Store,    tone: "brand",   delta: 1.0, spark: SPARKS.up },
        { label: "Tokens issued",       value: s.tokens_issued ?? 0,   href: "/distribute-token", icon: Coins,    tone: "amber",   delta: 4.2, spark: SPARKS.upFast },
        { label: "Tokens received",     value: s.tokens_received ?? 0, icon: Coins,    tone: "emerald", delta: 2.5, spark: SPARKS.up },
        { label: "Wallet",              value: s.wallet ?? 0,          icon: Wallet,   tone: "violet",  delta: 0.8, spark: SPARKS.wave, format: fmtINR },
      ];
    case "district":
      return [
        { label: "Taluks below me",   value: s.team_below ?? 0,      href: "/manage-taluks",    icon: Building2, tone: "brand",   delta: 0.0, spark: SPARKS.flat },
        { label: "Tokens issued",     value: s.tokens_issued ?? 0,   href: "/distribute-token", icon: Coins,     tone: "amber",   delta: 5.1, spark: SPARKS.upFast },
        { label: "Tokens received",   value: s.tokens_received ?? 0, icon: Coins,     tone: "emerald", delta: 3.3, spark: SPARKS.up },
        { label: "Wallet",            value: s.wallet ?? 0,          icon: Wallet,    tone: "violet",  delta: 1.2, spark: SPARKS.up, format: fmtINR },
      ];
    case "state":
      return [
        { label: "Districts in my state", value: s.team_below ?? 0,      href: "/manage-districts",  icon: Building2, tone: "brand",   delta: 0.0, spark: SPARKS.flat },
        { label: "Tokens issued",         value: s.tokens_issued ?? 0,   href: "/distribute-token",  icon: Coins,     tone: "amber",   delta: 6.4, spark: SPARKS.upFast },
        { label: "Tokens received",       value: s.tokens_received ?? 0, icon: Coins,     tone: "emerald", delta: 4.7, spark: SPARKS.up },
        { label: "Wallet",                value: s.wallet ?? 0,          icon: Wallet,    tone: "violet",  delta: 2.0, spark: SPARKS.up, format: fmtINR },
      ];
    case "admin":
      return [
        { label: "Customers",           value: s.customers ?? 0,           href: "/customers",   icon: Users,        tone: "brand",   delta:  2.4, spark: SPARKS.up },
        { label: "Vendors",             value: s.vendors ?? 0,             icon: Store,        tone: "emerald", delta:  1.2, spark: SPARKS.upSm },
        { label: "Today's orders",      value: s.todays_orders ?? 0,       icon: ShoppingCart, tone: "amber",   delta:  3.8, spark: SPARKS.upFast },
        { label: "Today's revenue",     value: s.todays_revenue ?? 0,      icon: Banknote,     tone: "violet",  delta: -0.6, spark: SPARKS.down, format: fmtINR },
        { label: "Pending top-ups",     value: s.pending_payments ?? 0,    href: "/payments",    icon: CreditCard, tone: "pink",  spark: SPARKS.wave },
        { label: "Pending withdrawals", value: s.pending_withdrawals ?? 0, href: "/withdrawals", icon: Wallet,     tone: "cyan",  spark: SPARKS.wave },
      ];
    default:
      return [];
  }
}

const QUICK_BY_ROLE: Record<string, QuickAction[]> = {
  vendor: [
    { label: "Add product",    href: "/products",       icon: Plus, description: "Create a new product listing" },
    { label: "Request tokens", href: "/token-request",  icon: Coins, description: "Ask your taluk for tokens" },
    { label: "View orders",    href: "/orders",         icon: ShoppingCart, description: "See latest orders" },
    { label: "Withdraw",       href: "/wallet",         icon: Banknote, description: "Move money to your bank" },
  ],
  taluk: [
    { label: "Distribute tokens", href: "/distribute-token", icon: Send, description: "Send tokens to vendors" },
    { label: "Add vendor",        href: "/manage-vendors",   icon: Plus, description: "Onboard a new vendor" },
    { label: "Token requests",    href: "/token-request",    icon: Coins, description: "Review pending requests" },
    { label: "Profile",           href: "/profile",          icon: SettingsIcon },
  ],
  district: [
    { label: "Distribute tokens", href: "/distribute-token", icon: Send },
    { label: "Manage taluks",     href: "/manage-taluks",    icon: Building2 },
    { label: "Token requests",    href: "/token-request",    icon: Coins },
    { label: "Profile",           href: "/profile",          icon: SettingsIcon },
  ],
  state: [
    { label: "Distribute tokens", href: "/distribute-token",  icon: Send },
    { label: "Manage districts",  href: "/manage-districts",  icon: Building2 },
    { label: "Token requests",    href: "/token-request",     icon: Coins },
    { label: "Profile",           href: "/profile",           icon: SettingsIcon },
  ],
  admin: [
    { label: "Broadcast",       href: "/broadcasts",   icon: BellIcon, description: "Send a push to users" },
    { label: "Approve top-ups", href: "/payments",     icon: CreditCard, description: "Pending payments" },
    { label: "Approve payouts", href: "/withdrawals",  icon: Banknote, description: "Pending withdrawals" },
    { label: "Settings",        href: "/settings",     icon: SettingsIcon },
  ],
};

function LoadingTiles() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-[20px] border border-black/5 bg-white p-5 shadow-[0_6px_18px_-10px_rgba(15,23,42,0.10)]">
          <Shimmer className="h-11 w-11 rounded-2xl" />
          <div className="mt-5 space-y-2">
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-8 w-28" />
            <Shimmer className="h-3 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function StaffDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StaffStats>({});
  const [adminData, setAdminData] = useState<AdminDashboard | null>(null);
  const [vendorData, setVendorData] = useState<VendorDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  // Infinite-scroll pagination for the Recent Orders widget (vendor + admin)
  const [extraOrderRows, setExtraOrderRows] = useState<ActivityRow[]>([]);
  const [extraAdminOrders, setExtraAdminOrders] = useState<AdminDashboard["recent_orders"]>([]);
  const [ordersPage, setOrdersPage]   = useState(1);
  const [hasMoreOrders, setHasMoreOrders] = useState(true);
  const [loadingMoreOrders, setLoadingMoreOrders] = useState(false);
  const seenOrderIds = useRef<Set<number>>(new Set());

  const fmt = useMemo(() => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }), []);

  async function loadMoreOrders() {
    if (loadingMoreOrders || !hasMoreOrders || !user) return;
    if (user.role !== "vendor" && user.role !== "admin") return;
    setLoadingMoreOrders(true);
    try {
      const next = ordersPage + 1;
      const res  = await api.get("/orders/list", { params: { page: next, per_page: 10 } });
      type ApiOrder = {
        id: number | string;
        customer_name?: string | null;
        shop_name?: string | null;
        vendor_name?: string | null;
        total: number | string;
        status: string;
        item_count?: number | string;
        created_at?: string | null;
      };
      const items = (res.data.data?.items ?? []) as ApiOrder[];
      const fresh = items.filter((r) => !seenOrderIds.current.has(Number(r.id)));
      fresh.forEach((r) => seenOrderIds.current.add(Number(r.id)));

      if (user.role === "vendor") {
        setExtraOrderRows((prev) => [
          ...prev,
          ...fresh.map((r): ActivityRow => ({
            name:   r.customer_name ?? "—",
            sub:    `${Number(r.item_count ?? 0)} item${Number(r.item_count ?? 0) === 1 ? "" : "s"} · ${r.status}`,
            amount: fmt.format(Number(r.total ?? 0)),
          })),
        ]);
      } else {
        // admin: append to the recent-orders TABLE rows
        setExtraAdminOrders((prev) => [
          ...prev,
          ...fresh.map((r) => ({
            id:         Number(r.id),
            customer:   r.customer_name ?? "—",
            vendor:     r.shop_name || r.vendor_name || "—",
            total:      Number(r.total ?? 0),
            status:     String(r.status ?? ""),
            created_at: String(r.created_at ?? ""),
          })),
        ]);
      }

      setOrdersPage(next);
      if (items.length < 10) setHasMoreOrders(false);
    } catch {
      setHasMoreOrders(false);
    } finally {
      setLoadingMoreOrders(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      setAdminData(null);
      setVendorData(null);
      // Reset pagination state on every role/user switch
      setExtraOrderRows([]);
      setExtraAdminOrders([]);
      setOrdersPage(1);
      setHasMoreOrders(true);
      setLoadingMoreOrders(false);
      seenOrderIds.current = new Set();
      if (user.role === "admin") {
        try {
          const d = await getAdminDashboard();
          setAdminData(d);
          d.recent_orders.forEach((o) => seenOrderIds.current.add(o.id));
          const chartSeries: ChartPoint[] = d.orders_series.map((p) => ({ label: p.date.slice(5), value: p.orders }));
          const activityRows: ActivityRow[] = d.top_categories.map((c) => ({
            name: c.name, sub: `${fmt.format(c.revenue)} revenue`,
          }));
          setStats({
            customers:           d.totals.customers,
            vendors:             d.totals.vendors,
            todays_orders:       d.totals.todays_orders,
            todays_revenue:      d.totals.todays_revenue,
            pending_payments:    d.totals.pending_payments,
            pending_withdrawals: d.totals.pending_withdrawals,
            chart_title: "Orders — last 14 days",
            chart_unit: "orders",
            chart_series: chartSeries,
            activity_title: "Top categories",
            activity_rows: activityRows,
          });
        } catch {
          setStats(await mock.stats(user.role));
        }
      } else if (user.role === "taluk" || user.role === "district" || user.role === "state") {
        try {
          const d = await getStaffDashboard();
          const chartSeries: ChartPoint[] = d.series.map((p) => ({ label: p.date.slice(5), value: p.count }));
          // For taluk: peer list is vendors; district: taluks; state: districts.
          const peerLabel = user.role === "taluk" ? "vendor" : user.role === "district" ? "taluk" : "district";
          const activityRows: ActivityRow[] = d.top.map((p) => ({
            name: p.name,
            sub: p.mobile ? `${peerLabel} · ${p.mobile}` : peerLabel,
          }));
          setStats({
            tokens_issued:   d.totals.tokens_issued,
            tokens_received: d.totals.tokens_received,
            wallet:          d.totals.wallet,
            vendors:         user.role === "taluk" ? d.totals.team_below : undefined,
            team_below:      user.role === "taluk" ? undefined : d.totals.team_below,
            chart_title: "Transactions — last 14 days",
            chart_unit: "txns",
            chart_series: chartSeries,
            activity_title: user.role === "taluk" ? "Vendors under me" : user.role === "district" ? "Taluks under me" : "Districts under me",
            activity_rows: activityRows,
          });
        } catch {
          setStats(await mock.stats(user.role));
        }
      } else if (user.role === "vendor") {
        try {
          const d = await getVendorDashboard();
          setVendorData(d);
          d.recent_orders.forEach((o) => seenOrderIds.current.add(o.id));
          const chartSeries: ChartPoint[] = d.orders_series.map((p) => ({ label: p.date.slice(5), value: p.orders }));
          const activityRows: ActivityRow[] = d.recent_orders.map((o) => ({
            name: o.customer,
            sub: `${o.items} item${o.items === 1 ? "" : "s"} · ${o.status}`,
            amount: fmt.format(o.total),
          }));
          setStats({
            todays_orders:   d.totals.todays_orders,
            active_products: d.totals.active_products,
            tokens_received: d.totals.token_balance,
            wallet:          d.totals.wallet,
            chart_title: "Orders — last 14 days",
            chart_unit: "orders",
            chart_series: chartSeries,
            activity_title: "Recent orders",
            activity_rows: activityRows,
          });
        } catch {
          setStats(await mock.stats(user.role));
        }
      } else {
        setStats(await mock.stats(user.role));
      }
      setLoading(false);
    })();
  }, [user]);

  const tiles = useMemo(() => (user ? tilesFor(user.role, stats) : []), [user, stats]);
  const quick = user ? QUICK_BY_ROLE[user.role] ?? [] : [];
  const series = stats.chart_series ?? [];
  const total = series.reduce((sum, p) => sum + p.value, 0);
  const isMoney = stats.chart_unit === "tokens" ? undefined : undefined;
  const vendorPerf = (stats.activity_rows ?? []).slice(0, 5).map((r) => {
    const num = parseInt((r.amount ?? "0").replace(/[^0-9]/g, ""), 10) || 0;
    return { name: r.name, value: num };
  });

  return (
    <>
      <MobileHeader title="Dashboard" />
      <section className="mx-auto max-w-7xl space-y-7 p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
              {user ? ROLE_LABEL[user.role as keyof typeof ROLE_LABEL] : ""}
            </p>
            <h2 className="mt-2 text-[34px] font-bold leading-tight tracking-tight text-[#111827]">
              Welcome back, <span className="bg-gradient-to-r from-foreground to-brand bg-clip-text text-transparent">{user?.name?.split(" ")[0] ?? "—"}</span>
            </h2>
            <p className="mt-2 text-base text-[#6b7280]">Here is your performance snapshot for today.</p>
          </div>
        </div>

        {loading ? (
          <LoadingTiles />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {tiles.map((t) => (
                <StatCard
                  key={t.label}
                  label={t.label}
                  value={t.value}
                  icon={t.icon}
                  tone={t.tone}
                  delta={t.delta}
                  href={t.href}
                  spark={t.spark}
                  format={t.format}
                />
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <RevenueChart
                  title={stats.chart_title ?? "Trend"}
                  total={total}
                  unit={stats.chart_unit ?? ""}
                  data={series}
                  format={isMoney}
                />
              </div>
              {adminData ? (
                <LatestVendors rows={adminData.latest_vendors} />
              ) : (
                <ActivityTimeline
                  title={stats.activity_title ?? "Recent activity"}
                  rows={[...(stats.activity_rows ?? []), ...extraOrderRows]}
                  onLoadMore={user?.role === "vendor" ? loadMoreOrders : undefined}
                  hasMore={user?.role === "vendor" ? hasMoreOrders : false}
                  loadingMore={loadingMoreOrders}
                />
              )}
            </div>

            {adminData && (
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <RecentOrders
                    rows={[...adminData.recent_orders, ...extraAdminOrders]}
                    onLoadMore={loadMoreOrders}
                    hasMore={hasMoreOrders}
                    loadingMore={loadingMoreOrders}
                  />
                </div>
                <ActivityTimeline title={stats.activity_title ?? "Top categories"} rows={stats.activity_rows ?? []} />
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              {!adminData && vendorPerf.length > 0 && (
                <div className="lg:col-span-2">
                  <VendorPerformance title={stats.activity_title ?? "Top performers"} data={vendorPerf} />
                </div>
              )}
              <div className={!adminData && vendorPerf.length > 0 ? "" : "lg:col-span-3"}>
                <QuickActions actions={quick} />
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
