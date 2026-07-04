"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const LABEL: Record<string, string> = {
  dashboard: "Dashboard",
  stats: "Stats",
  customers: "Customers",
  products: "Products",
  orders: "Orders",
  tokens: "Tokens",
  wallet: "Wallet",
  profile: "Profile",
  "manage-vendors": "Vendors",
  "manage-taluks": "Taluks",
  "manage-districts": "Districts",
  "distribute-token": "Distribute Token",
  "token-request": "Token Requests",
  "vendor-categories": "Vendor Categories",
  categories: "Product Categories",
  "sub-categories": "Sub Categories",
  file: "File",
  banners: "Home Banners",
  pincodes: "Pincodes",
  payments: "Manual Top-ups",
  withdrawals: "Withdrawals",
  drivers: "Drivers",
  "system-pools": "System Pools",
  broadcasts: "Broadcasts",
  settings: "Settings",
  notifications: "Notifications",
  driver: "Driver",
};

export function Breadcrumbs() {
  const pathname = usePathname() || "/dashboard";
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink render={<Link href="/dashboard">Home</Link>} />
        </BreadcrumbItem>
        {segs.map((seg, i) => {
          const href = "/" + segs.slice(0, i + 1).join("/");
          const isLast = i === segs.length - 1;
          const label = LABEL[seg] ?? seg.replace(/-/g, " ");
          return (
            <span key={href} className="flex items-center gap-1.5">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="capitalize">{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={href} className="capitalize">{label}</Link>} />
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
