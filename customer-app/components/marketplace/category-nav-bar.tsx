"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LayoutGrid, ChevronDown, Home, ShoppingBag, Package, Newspaper } from "lucide-react";
import { api } from "@/lib/api";

type Category = { id: number; name: string };

const PRIMARY = [
  { label: "Home",     href: "/home",         icon: Home },
  { label: "Shop",     href: "/shop-public",  icon: ShoppingBag },
  { label: "Products", href: "/shop-public",  icon: Package },
  { label: "Blogs",    href: "/blog",         icon: Newspaper },
];

export function CategoryNavBar() {
  const [open, setOpen] = useState(false);
  const [cats, setCats] = useState<Category[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const r = await api.get("/public/products");
        const raw = (r.data?.data?.categories ?? []) as Array<{ id: number | string; name: string }>;
        setCats(raw.map((c) => ({ id: Number(c.id), name: c.name })).filter((c) => c.id > 0 && c.name));
      } catch {
        setCats([]);
      }
    })();
  }, []);

  return (
    <nav className="border-b border-[var(--mk-border)] bg-[var(--mk-surface)]">
      <div className="flex w-full items-center gap-2 px-4">
        {/* Mega menu trigger */}
        <div
          className="relative"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-[var(--mk-brand)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--mk-brand-deep)]"
          >
            <LayoutGrid className="h-4 w-4" />
            Shop by Categories
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <div className="absolute left-0 top-full z-20 mt-0 w-[480px] rounded-b-xl border border-t-0 border-[var(--mk-border)] bg-[var(--mk-surface)] p-3 shadow-[var(--mk-shadow-md)]">
              {cats.length === 0 ? (
                <p className="px-3 py-2 text-xs text-[var(--mk-text-muted)]">No categories yet</p>
              ) : (
                <div className="grid grid-cols-2 gap-1">
                  {cats.map((c) => (
                    <Link
                      key={c.id}
                      href={`/shop-public?category_id=${c.id}`}
                      className="rounded-md px-3 py-2 text-sm text-[var(--mk-text)] transition-colors hover:bg-[var(--mk-brand-soft)] hover:text-[var(--mk-brand-deep)]"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
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
    </nav>
  );
}
