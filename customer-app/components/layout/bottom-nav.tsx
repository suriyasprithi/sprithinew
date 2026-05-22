"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, QrCode, Wallet, User, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  center?: boolean;
};

const ITEMS: Item[] = [
  { href: "/dashboard", label: "Home",    icon: Home },
  { href: "/cart",      label: "Cart",    icon: ShoppingCart },
  { href: "/qr",        label: "Scan",    icon: QrCode, center: true },
  { href: "/wallet",    label: "Wallet",  icon: Wallet },
  { href: "/profile",   label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname() || "";

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 glass md:hidden">
      <ul className="mx-auto flex max-w-md items-end justify-around px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          if (item.center) {
            return (
              <li key={item.href} className="-mt-6">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  className="flex h-14 w-14 items-center justify-center rounded-full brand-gradient brand-glow text-brand-foreground shadow-lg transition-transform active:scale-95"
                >
                  <Icon className="h-6 w-6" />
                </Link>
              </li>
            );
          }
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center gap-1 py-1 text-xs",
                  active ? "text-brand" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="customer-bottomnav-active"
                    className="absolute -top-2 h-1 w-8 rounded-full bg-brand"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
