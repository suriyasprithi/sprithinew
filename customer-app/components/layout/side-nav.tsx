"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Home, Store, QrCode, Wallet, User, LogOut, ShoppingBag, ShoppingCart, Activity, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth";

const ITEMS = [
  { href: "/dashboard", label: "Home",     icon: Home },
  { href: "/shops",     label: "Shops",    icon: ShoppingBag },
  { href: "/shop",      label: "Shop",     icon: Store },
  { href: "/cart",      label: "Cart",     icon: ShoppingCart },
  { href: "/qr",        label: "Scan",     icon: QrCode },
  { href: "/wallet",         label: "Wallet",         icon: Wallet },
  { href: "/digital-point",  label: "Digital Point",  icon: Sparkles },
  { href: "/activity",       label: "Activity",       icon: Activity },
  { href: "/profile",   label: "Profile",  icon: User },
];

export function SideNav() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { user, logout } = useAuth();

  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const initial = (user?.name || "?").trim().charAt(0).toUpperCase();

  return (
    <aside className="hidden h-screen sticky top-0 shrink-0 w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-5">
        <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`} alt="SPRITHI Digital Mart" className="h-10 w-10 shrink-0 object-contain" />
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">SPRITHI</p>
          <p className="truncate text-xs text-muted-foreground">{user?.name ?? "—"}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-all duration-150",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground hover:translate-x-[1px]",
              )}
            >
              {active && (
                <>
                  <motion.span
                    layoutId="customer-nav-stripe"
                    className="absolute left-0 top-1/2 z-10 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-brand"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                  <motion.span
                    layoutId="customer-nav-active"
                    className="absolute inset-0 rounded-xl brand-gradient-soft border border-brand/30 shadow-[0_4px_18px_-6px_rgba(237,28,36,0.30)]"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                </>
              )}
              <Icon className={cn("relative z-10 h-[18px] w-[18px] shrink-0", active && "text-brand")} />
              <span className="relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg brand-gradient text-sm font-semibold text-brand-foreground">
            {initial}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name ?? "—"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.mobile_number ?? ""}</p>
          </div>
          <button
            onClick={onLogout}
            aria-label="Log out"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-brand"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
