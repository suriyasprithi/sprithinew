"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, ShoppingCart, Heart, User } from "lucide-react";

const ITEMS = [
  { href: "/home",       label: "Home",    icon: Home },
  { href: "/shop-public",label: "Shop",    icon: Search },
  { href: "/cart",       label: "Cart",    icon: ShoppingCart, badge: true },
  { href: "/wishlist",   label: "Wishlist",icon: Heart },
  { href: "/login",      label: "Account", icon: User },
];

export function MarketplaceBottomNav({ cartCount = 0 }: { cartCount?: number }) {
  const pathname = usePathname() || "";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--mk-border)] bg-[var(--mk-surface)]/95 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-md items-center justify-around px-2 py-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`relative flex flex-col items-center gap-0.5 py-1 ${active ? "text-[var(--mk-brand)]" : "text-[var(--mk-text-muted)]"}`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
                {item.badge && cartCount > 0 && (
                  <span className="absolute right-1/4 top-0 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--mk-brand)] px-1 text-[10px] font-bold text-white">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
                {active && <span className="absolute -top-1.5 h-1 w-8 rounded-full bg-[var(--mk-brand)]" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
