"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, LogOut, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import { menuFor, ROLE_LABEL } from "@/lib/role-menu";
import type { StaffRole } from "@/lib/api";

export function MobileHeader({ title }: { title?: string }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const { user, logout, isHydrated } = useAuth();
  const items = menuFor(user?.role);
  const roleLabel =
    user && user.role !== "customer" ? ROLE_LABEL[user.role as StaffRole] : "";

  useEffect(() => {
    if (!isHydrated || !user) return;
    let active = true;
    const tick = async () => {
      try {
        const res = await api.get("/notifications");
        if (active) setUnread(Number(res.data.data?.unread_count ?? 0));
      } catch { /* ignore */ }
    };
    void tick();
    const id = setInterval(tick, 60000);
    return () => { active = false; clearInterval(id); };
  }, [isHydrated, user]);

  const onLogout = async () => {
    setOpen(false);
    await logout();
    window.location.href = "/admin/login/";
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-3 py-3 backdrop-blur-xl md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Open menu" className="h-9 w-9">
              <Menu className="h-5 w-5" />
            </Button>
          }
        />
        <SheetContent side="left" className="w-72 border-r border-border bg-sidebar p-0">
          <SheetHeader className="border-b border-border px-4 py-4 text-left">
            <div className="flex items-center gap-3">
              <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`} alt="SPRITHI Digital Mart" className="h-10 w-10 shrink-0 object-contain" />
              <div className="min-w-0">
                <SheetTitle className="text-sm">SPRITHI Staff</SheetTitle>
                <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
              </div>
            </div>
          </SheetHeader>
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
            <AnimatePresence>
              {items.map((item, i) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                        active
                          ? "text-foreground brand-gradient-soft border border-brand/30 brand-glow"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("h-4 w-4", active && "text-brand")} />
                      {item.label}
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </nav>
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg brand-gradient text-sm font-semibold text-brand-foreground">
                {(user?.name || "?").trim().charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user?.name ?? "—"}</p>
                <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
              </div>
              <button
                onClick={onLogout}
                aria-label="Logout"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-brand"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <h1 className="truncate text-base font-semibold">{title ?? "SPRITHI Staff"}</h1>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full brand-gradient px-1 text-[10px] font-bold text-brand-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
