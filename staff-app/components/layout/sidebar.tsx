"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronsLeft, ChevronsRight, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth";
import { useSidebar } from "@/stores/sidebar";
import { menuFor, ROLE_LABEL } from "@/lib/role-menu";
import type { StaffRole } from "@/lib/api";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function Sidebar() {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { user, logout } = useAuth();
  const { collapsed, toggle } = useSidebar();
  const items = menuFor(user?.role);
  const roleLabel = user && user.role !== "customer" ? ROLE_LABEL[user.role as StaffRole] : "";

  const onLogout = async () => {
    await logout();
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    if (basePath === "") window.location.assign("/login/");
    else window.location.href = "/admin/login/";
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 76 : 256 }}
      transition={{ type: "spring", stiffness: 220, damping: 28 }}
      className="hidden h-screen sticky top-0 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex"
    >
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
        <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`} alt="SPRITHI Digital Mart" className="h-10 w-10 shrink-0 object-contain" />
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="logo-text"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.2 }}
              className="min-w-0"
            >
              <p className="text-sm font-semibold tracking-tight">SPRITHI Staff</p>
              <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggle}
          className={cn(
            "ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
            collapsed && "ml-0",
          )}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const inner = (
            <Link
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
                    layoutId="sidebar-active-stripe"
                    className="absolute left-0 top-1/2 z-10 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-brand"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl brand-gradient-soft border border-brand/30 shadow-[0_4px_18px_-6px_rgba(237,28,36,0.30)]"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                </>
              )}
              <Icon className={cn("relative z-10 h-[18px] w-[18px] shrink-0", active && "text-brand")} />
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.span
                    key="label"
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -4 }}
                    transition={{ duration: 0.15 }}
                    className="relative z-10 truncate"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
          return collapsed ? (
            <Tooltip key={item.href}>
              <TooltipTrigger render={inner} />
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ) : (
            <div key={item.href}>{inner}</div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className={cn("flex items-center gap-3 rounded-xl bg-surface-2 p-2", collapsed && "justify-center bg-transparent p-0")}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg brand-gradient text-brand-foreground text-sm font-semibold">
            {(user?.name || "?").trim().charAt(0).toUpperCase()}
          </span>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                key="profile"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="min-w-0 flex-1"
              >
                <p className="truncate text-sm font-medium">{user?.name ?? "—"}</p>
                <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  onClick={onLogout}
                  aria-label="Logout"
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-brand"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              }
            />
            <TooltipContent side="right">Logout</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </motion.aside>
  );
}
