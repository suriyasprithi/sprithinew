"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Home, ShoppingBag, Package, Newspaper, LayoutGrid, ChevronDown, X } from "lucide-react";
import { api } from "@/lib/api";

const PRIMARY = [
  { label: "Home",     href: "/home",         icon: Home },
  { label: "Shop",     href: "/shop-public",  icon: ShoppingBag },
  { label: "Products", href: "/shop-public",  icon: Package },
  { label: "Blogs",    href: "/blog",         icon: Newspaper },
];

type VendorCategory = {
  id: number;
  name: string;
  image?: string | null;
  product_count?: number | string;
  status?: string;
};

// Pick a sensible emoji from the category name. Mirrors featured-categories.tsx.
function emojiFor(name: string): string {
  const n = name.toLowerCase();
  if (/(pastry|pastries|croissant)/.test(n))    return "🥐";
  if (/(bakery|bread|cake)/.test(n))            return "🍞";
  if (/(drink|juice|beverage|smoothie)/.test(n)) return "🥤";
  if (/(vegetable|veg|veggi)/.test(n))          return "🥦";
  if (/(strawberry|berry|fruit)/.test(n))       return "🍓";
  if (/(meat|steak|chicken|mutton)/.test(n))    return "🥩";
  if (/grocery/.test(n))                        return "🛒";
  if (/electronic|gadget|mobile/.test(n))       return "🔌";
  if (/pharmac|medic|drug/.test(n))             return "💊";
  if (/salon|beauty|parlour|parlor/.test(n))    return "💇";
  if (/restaurant|food/.test(n))                return "🍽️";
  if (/pet/.test(n))                            return "🐶";
  if (/toy/.test(n))                            return "🧸";
  if (/travel/.test(n))                         return "✈️";
  return "🏪";
}

export function CategoryNavBar() {
  const [cats, setCats] = useState<VendorCategory[]>([]);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/vendor-categories");
        const items = (res.data.data?.items ?? []) as VendorCategory[];
        setCats(items);
      } catch {
        setCats([]);
      }
    })();
  }, []);

  // Close menu on browser navigation (popstate fires on back/forward; pushState
  // doesn't fire it, so we patch it for our own Link clicks too — static-export
  // safe, no useSearchParams suspense requirement).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const close = () => setOpen(false);
    window.addEventListener("popstate", close);
    const origPush = window.history.pushState;
    window.history.pushState = function (...args) {
      const r = origPush.apply(window.history, args);
      close();
      return r;
    };
    return () => {
      window.removeEventListener("popstate", close);
      window.history.pushState = origPush;
    };
  }, []);

  // Close on click outside (mobile)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <nav
      ref={wrapperRef}
      className="relative border-b border-[var(--mk-border)] bg-[var(--mk-surface)]"
      onMouseLeave={scheduleClose}
    >
      <div
        className="flex w-full items-center gap-2 px-4"
      >
        {/* Shop by Category trigger */}
        <div
          className="relative"
          onMouseEnter={() => { cancelClose(); setOpen(true); }}
        >
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="true"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--mk-brand)] px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--mk-brand-deep)]"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Shop by Category</span>
            <span className="sm:hidden">Categories</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Primary nav */}
        <ul className="hidden flex-1 items-center gap-1 md:flex">
          {PRIMARY.map((p) => {
            const Icon = p.icon;
            return (
              <li key={p.label}>
                <Link
                  href={p.href}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--mk-text)] transition-colors hover:bg-[var(--mk-brand-soft)] hover:text-[var(--mk-brand-deep)]"
                >
                  <Icon className="h-4 w-4" />
                  {p.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <Link
          href="/vendors-public"
          className="ml-auto hidden items-center gap-1.5 rounded-lg border border-[var(--mk-brand)] px-3 py-2 text-xs font-semibold text-[var(--mk-brand-deep)] hover:bg-[var(--mk-brand-soft)] md:inline-flex"
        >
          Become a vendor
        </Link>
      </div>

      {/* Mega menu panel */}
      {open && (
        <div
          className="absolute inset-x-0 top-full z-40 border-t border-[var(--mk-border)] bg-white shadow-[var(--mk-shadow-md)]"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="mx-auto max-w-7xl px-4 py-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--mk-text)]">All categories</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close categories"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--mk-text-muted)] hover:bg-[var(--mk-brand-soft)] hover:text-[var(--mk-brand-deep)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {cats.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--mk-text-muted)]">No categories yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {cats.map((c) => {
                  const count = Number(c.product_count ?? 0);
                  const hasImage = typeof c.image === "string" && c.image.length > 0;
                  return (
                    <Link
                      key={c.id}
                      href={`/shop-public?vendor_category_id=${c.id}`}
                      className="group flex items-center gap-3 rounded-xl border border-[var(--mk-border)] bg-white p-2.5 transition-colors hover:border-[var(--mk-brand)]/40 hover:bg-[var(--mk-brand-soft)]/40"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--mk-brand-soft)]">
                        {hasImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.image as string} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-2xl leading-none">{emojiFor(c.name)}</span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--mk-text)] group-hover:text-[var(--mk-brand-deep)]">{c.name}</p>
                        <p className="truncate text-[11px] text-[var(--mk-text-muted)]">
                          {count} {count === 1 ? "Product" : "Products"}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
