"use client";

import Link from "next/link";
import { Home, ShoppingBag, Package, Newspaper } from "lucide-react";

const PRIMARY = [
  { label: "Home",     href: "/home",         icon: Home },
  { label: "Shop",     href: "/shop-public",  icon: ShoppingBag },
  { label: "Products", href: "/shop-public",  icon: Package },
  { label: "Blogs",    href: "/blog",         icon: Newspaper },
];

export function CategoryNavBar() {
  return (
    <nav className="border-b border-[var(--mk-border)] bg-[var(--mk-surface)]">
      <div className="flex w-full items-center gap-2 px-4">
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
