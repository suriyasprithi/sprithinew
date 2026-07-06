"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, LogOut, User, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import { useLogoutConfirm } from "@/components/use-logout-confirm";
import { useAuth } from "@/stores/auth";

export function AppHeader({ title }: { title?: string }) {
  const { user, isHydrated } = useAuth();
  const { requestLogout, logoutDialog } = useLogoutConfirm();
  const [unread, setUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Close the profile dropdown on outside click / tap.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [menuOpen]);

  const initial = (user?.name || "?").trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between glass border-b-0 px-4 py-3 md:hidden">
      {/* Left: website logo → home (plus the page title, when a page sets one) */}
      <div className="flex min-w-0 items-center gap-2.5">
        <Link href="/home" aria-label="Home" className="shrink-0">
          <img
            src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`}
            alt="SPRITHI Digital Mart"
            className="h-9 w-9 shrink-0 object-contain"
          />
        </Link>
        {title
          ? <h1 className="truncate text-sm font-semibold">{title}</h1>
          : <span className="text-base font-bold tracking-tight">SPRITHI</span>}
      </div>

      {/* Right: notifications + profile dropdown */}
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

        {/* Profile: avatar + name → toggles a Profile / Logout dropdown */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-2/60 py-1 pl-1 pr-1.5 hover:border-brand/40"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg brand-gradient text-brand-foreground text-xs font-bold">
              {initial}
            </span>
            <span className="max-w-[84px] truncate text-sm font-medium">{user?.name ?? "—"}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${menuOpen ? "rotate-180" : ""}`} />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-40 mt-1.5 w-44 overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
            >
              <Link
                href="/profile"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-accent"
              >
                <User className="h-4 w-4 text-muted-foreground" /> Profile
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMenuOpen(false); requestLogout(); }}
                className="flex w-full items-center gap-2.5 border-t border-border px-3 py-2.5 text-left text-sm text-destructive hover:bg-accent"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
      {logoutDialog}
    </header>
  );
}
