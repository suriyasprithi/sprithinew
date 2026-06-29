"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, MapPin, ShoppingCart, Heart, Bell, User, ChevronDown, Loader2 } from "lucide-react";
import { LocationPicker, readSavedLocation } from "./location-picker";
import { useAuth } from "@/stores/auth";
import { api, fileUrl } from "@/lib/api";
import { wishlist } from "@/lib/wishlist";
import { cartBadge } from "@/lib/cart";

type Suggestion = { id: number; name: string; price: number; image: string | null };
const fmtINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

// Search-suggestion thumbnail: shows the product image, but falls back to the
// search icon if it's missing OR fails to load (broken URL / 404), so the
// dropdown never shows the browser's broken-image glyph.
function SuggestionThumb({ image }: { image: string | null }) {
  const [failed, setFailed] = useState(false);
  const url = fileUrl(image);
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--mk-surface-2)]">
      {url && !failed
        ? <img src={url} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />
        : <Search className="h-4 w-4 text-[var(--mk-text-muted)]" />}
    </span>
  );
}

export function MarketplaceHeader({ cartCount = 0, wishlistCount = 0, unreadCount = 0 }: {
  cartCount?: number;
  wishlistCount?: number;
  unreadCount?: number;
}) {
  const router = useRouter();
  const { user, isHydrated } = useAuth();
  const [q, setQ] = useState("");
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [sugOpen, setSugOpen] = useState(false);
  const [sugLoading, setSugLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [locOpen, setLocOpen] = useState(false);
  const [locLabel, setLocLabel] = useState<string>("Coimbatore South, Coimbatore");
  // Wishlist count is client-side (localStorage) — derive it here and keep it
  // live via the wishlist lib, so the badge updates the moment a heart is toggled
  // on any page. Falls back to the passed-in prop until hydrated.
  const [liveWishlist, setLiveWishlist] = useState(wishlistCount);
  useEffect(() => {
    const read = () => setLiveWishlist(wishlist.ids().length);
    read();
    return wishlist.subscribe(read);
  }, []);
  // Cart count is server-side but cached client-side (lib/cart) so the badge
  // updates the moment an item is added on any page. Reconcile with the server
  // once hydrated AND signed in (GET /cart 401s for guests → /login bounce).
  const [liveCart, setLiveCart] = useState(cartCount);
  useEffect(() => {
    const read = () => setLiveCart(cartBadge.get());
    read();
    return cartBadge.subscribe(read);
  }, []);
  useEffect(() => {
    if (isHydrated && user) void cartBadge.refresh();
  }, [isHydrated, user]);
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

  // Debounced auto-suggest: fetch matching products from the public catalog as
  // the customer types, scoped to their saved delivery location. Guests can use
  // it too (public endpoint, no auth).
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setSugs([]); setSugOpen(false); setSugLoading(false); return; }
    let cancelled = false;
    setSugLoading(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const loc = readSavedLocation();
          const params: Record<string, string> = { q: term };
          if (loc?.taluk_id)         params.taluk_id    = String(loc.taluk_id);
          else if (loc?.district_id) params.district_id = String(loc.district_id);
          else if (loc?.state_id)    params.state_id    = String(loc.state_id);
          const r = await api.get("/public/products", { params });
          if (cancelled) return;
          const items = ((r.data.data?.items ?? []) as Array<{ id: number; name: string; price: number | string; image: string | null }>)
            .slice(0, 6)
            .map((p) => ({ id: Number(p.id), name: p.name, price: Number(p.price), image: p.image }));
          setSugs(items);
          setSugOpen(true);
        } catch { if (!cancelled) setSugs([]); }
        finally { if (!cancelled) setSugLoading(false); }
      })();
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  // Close the suggestions dropdown when clicking/tapping outside the search box.
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSugOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  const runSearch = (term: string) => {
    setSugOpen(false);
    router.push(`/shop-public${term ? `?q=${encodeURIComponent(term)}` : ""}`);
  };
  const openProduct = (id: number) => {
    setSugOpen(false);
    router.push(`/product-public?id=${id}`);
  };

  return (
    <header className="sticky top-0 z-30 bg-[var(--mk-surface)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--mk-surface)]/85 border-b border-[var(--mk-border)]">
      <div className="flex w-full items-center gap-3 px-4 py-3 md:gap-5">
        {/* Logo */}
        <Link href="/home" className="flex shrink-0 items-center gap-2">
          <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`} alt="SPRITHI Digital Mart" width={40} height={40} fetchPriority="high" className="h-10 w-10 shrink-0 object-contain" />
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
        <div ref={searchRef} className="relative flex-1">
          <form
            onSubmit={(e) => { e.preventDefault(); runSearch(q.trim()); }}
            className="flex w-full items-center rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface-2)] px-3 py-2 transition-colors focus-within:border-[var(--mk-brand)]"
          >
            <Search className="mr-2 h-4 w-4 shrink-0 text-[var(--mk-text-muted)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => { if (sugs.length) setSugOpen(true); }}
              placeholder='Search "rice", "milk", "salon near me"…'
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--mk-text-muted)]"
            />
            {sugLoading && <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin text-[var(--mk-text-muted)]" />}
            <button type="submit" className="ml-2 hidden rounded-lg bg-[var(--mk-brand)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--mk-brand-deep)] md:inline">
              Search
            </button>
          </form>

          {/* Auto-suggestions */}
          {sugOpen && q.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-[var(--mk-border)] bg-[var(--mk-surface)] shadow-lg">
              {sugs.length > 0 ? (
                <ul className="max-h-[60vh] overflow-auto py-1">
                  {sugs.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => openProduct(s.id)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--mk-surface-2)]"
                      >
                        <SuggestionThumb image={s.image} />
                        <span className="min-w-0 flex-1 truncate text-sm text-[var(--mk-text)]">{s.name}</span>
                        <span className="shrink-0 text-xs font-semibold text-[var(--mk-text)]">{fmtINR(s.price)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                !sugLoading && <p className="px-3 py-3 text-sm text-[var(--mk-text-muted)]">No products found</p>
              )}
              <button
                type="button"
                onClick={() => runSearch(q.trim())}
                className="flex w-full items-center gap-2 border-t border-[var(--mk-border)] px-3 py-2.5 text-left text-sm font-medium text-[var(--mk-brand-deep)] hover:bg-[var(--mk-surface-2)]"
              >
                <Search className="h-4 w-4" /> Search for &ldquo;{q.trim()}&rdquo;
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1 md:gap-2">
          <IconButton href="/wishlist" aria-label="Wishlist" badge={liveWishlist}>
            <Heart className="h-5 w-5" />
          </IconButton>
          <IconButton href="/notifications" aria-label="Notifications" badge={unreadCount}>
            <Bell className="h-5 w-5" />
          </IconButton>
          <IconButton href="/cart" aria-label="Cart" badge={liveCart} highlighted>
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

      {/* Mobile location strip — the desktop "Deliver to" button is hidden
          below lg, so give phones a full-width tap target to open the same
          picker. */}
      <button
        type="button"
        onClick={() => setLocOpen(true)}
        className="flex w-full items-center gap-2 border-t border-[var(--mk-border)] bg-[var(--mk-surface)] px-4 py-2 text-left lg:hidden"
      >
        <MapPin className="h-4 w-4 shrink-0 text-[var(--mk-brand)]" />
        <span className="flex min-w-0 items-baseline gap-1.5 text-xs">
          <span className="shrink-0 uppercase tracking-wider text-[var(--mk-text-muted)]">Deliver to</span>
          <span className="truncate font-semibold text-[var(--mk-text)]">{locLabel}</span>
        </span>
        <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-[var(--mk-text-muted)]" />
      </button>
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
