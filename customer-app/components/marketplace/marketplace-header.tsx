"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, MapPin, ShoppingCart, Heart, Bell, User, ChevronDown } from "lucide-react";
import { LocationPicker, readSavedLocation } from "./location-picker";
import { useAuth } from "@/stores/auth";

export function MarketplaceHeader({ cartCount = 0, wishlistCount = 0, unreadCount = 0 }: {
  cartCount?: number;
  wishlistCount?: number;
  unreadCount?: number;
}) {
  const router = useRouter();
  const { user, isHydrated } = useAuth();
  const [q, setQ] = useState("");
  const [locOpen, setLocOpen] = useState(false);
  const [locLabel, setLocLabel] = useState<string>("Coimbatore South, Coimbatore");
  useEffect(() => {
    const apply = () => {
      const v = readSavedLocation();
      if (v?.label) setLocLabel(v.label);
    };
    apply();
    window.addEventListener("epey-location-changed", apply);
    window.addEventListener("storage", apply);
    return () => {
      window.removeEventListener("epey-location-changed", apply);
      window.removeEventListener("storage", apply);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-[var(--mk-surface)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--mk-surface)]/85 border-b border-[var(--mk-border)]">
      <div className="flex w-full items-center gap-3 px-4 py-3 md:gap-5">
        {/* Logo */}
        <Link href="/home" className="flex shrink-0 items-center gap-2">
          <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`} alt="SPRITHI Digital Mart" className="h-10 w-10 shrink-0 object-contain" />
          <span className="hidden text-lg font-bold tracking-tight md:inline">SPRITHI</span>
        </Link>

        {/* Location selector */}
        <button
          type="button"
          onClick={() => setLocOpen(true)}
          className="hidden shrink-0 items-center gap-2 rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface)] px-3 py-2 text-left text-xs hover:border-[var(--mk-brand)]/40 lg:flex"
        >
          <MapPin className="h-4 w-4 text-[var(--mk-brand)]" />
          <span className="max-w-[180px]">
            <span className="block text-[10px] uppercase tracking-wider text-[var(--mk-text-muted)]">Deliver to</span>
            <span className="block truncate font-semibold text-[var(--mk-text)]">{locLabel}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-[var(--mk-text-muted)]" />
        </button>
        <LocationPicker open={locOpen} onClose={() => setLocOpen(false)} />

        {/* Search */}
        <form
          onSubmit={(e) => { e.preventDefault(); router.push(`/shop-public${q ? `?q=${encodeURIComponent(q)}` : ""}`); }}
          className="flex flex-1 items-center rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface-2)] px-3 py-2 transition-colors focus-within:border-[var(--mk-brand)]"
        >
          <Search className="mr-2 h-4 w-4 shrink-0 text-[var(--mk-text-muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Search "rice", "milk", "salon near me"…'
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--mk-text-muted)]"
          />
          <button type="submit" className="ml-2 hidden rounded-lg bg-[var(--mk-brand)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--mk-brand-deep)] md:inline">
            Search
          </button>
        </form>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1 md:gap-2">
          <IconButton href="/wishlist" aria-label="Wishlist" badge={wishlistCount}>
            <Heart className="h-5 w-5" />
          </IconButton>
          <IconButton href="/notifications" aria-label="Notifications" badge={unreadCount}>
            <Bell className="h-5 w-5" />
          </IconButton>
          <IconButton href="/cart" aria-label="Cart" badge={cartCount} highlighted>
            <ShoppingCart className="h-5 w-5" />
          </IconButton>
          <Link
            href="/blog"
            className="hidden items-center rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface)] px-3 py-2 text-xs font-medium hover:border-[var(--mk-brand)]/40 md:inline-flex"
          >
            Blog
          </Link>
          {isHydrated && user ? (
            <Link
              href="/profile"
              className="hidden items-center gap-1.5 rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface)] px-3 py-2 text-xs font-medium hover:border-[var(--mk-brand)]/40 md:inline-flex"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--mk-brand)] text-[10px] font-bold text-white">
                {user.name?.charAt(0).toUpperCase() ?? "U"}
              </span>
              <span className="max-w-[120px] truncate">{user.name?.split(" ")[0] ?? "Account"}</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="hidden items-center gap-1.5 rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface)] px-3 py-2 text-xs font-medium hover:border-[var(--mk-brand)]/40 md:inline-flex"
            >
              <User className="h-4 w-4" /> Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function IconButton({
  href, children, badge, highlighted, ...rest
}: { href: string; children: React.ReactNode; badge?: number; highlighted?: boolean } & React.HTMLAttributes<HTMLAnchorElement>) {
  return (
    <Link
      href={href}
      {...rest}
      className={
        "relative inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors " +
        (highlighted
          ? "border-[var(--mk-brand)]/30 bg-[var(--mk-brand-soft)] text-[var(--mk-brand-deep)] hover:bg-[var(--mk-brand)] hover:text-white"
          : "border-[var(--mk-border)] bg-[var(--mk-surface)] text-[var(--mk-text)] hover:border-[var(--mk-brand)]/40")
      }
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--mk-brand)] px-1 text-[10px] font-bold text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}
