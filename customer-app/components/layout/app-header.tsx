"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, ShoppingBag } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";

export function AppHeader({ title }: { title?: string }) {
  const router = useRouter();
  const { user, logout, isHydrated } = useAuth();
  const [unread, setUnread] = useState(0);

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
    await logout();
    router.replace("/login");
  };

  const initial = (user?.name || "?").trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between glass border-b-0 px-4 py-3 md:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl brand-gradient text-brand-foreground text-sm font-bold">
          {initial}
        </span>
        <div className="min-w-0">
          {title ? (
            <h1 className="truncate text-sm font-semibold">{title}</h1>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Welcome</p>
              <h1 className="truncate text-sm font-semibold">{user?.name ?? "—"}</h1>
            </>
          )}
        </div>
        <Link
          href="/shop-public"
          aria-label="Go to shop"
          className="ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2/60 hover:border-brand/40 hover:text-brand"
        >
          <ShoppingBag className="h-4 w-4" />
        </Link>
      </div>
      <div className="flex items-center gap-1.5">
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-2/60 hover:border-brand/40"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full brand-gradient px-1 text-[10px] font-bold text-brand-foreground brand-glow">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
        <button
          aria-label="Log out"
          onClick={onLogout}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-2/60 hover:border-brand/40 hover:text-brand"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
