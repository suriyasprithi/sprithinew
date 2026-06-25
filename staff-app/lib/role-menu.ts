import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Wallet,
  User,
  Coins,
  ArrowDownToLine,
  Building2,
  Store,
  UserPlus,
  Banknote,
  CreditCard,
  Bell,
  Settings,
  Truck,
  Tags,
  Layers,
  Image as ImageIcon,
  Video,
  Film,
  Route,
  ClipboardList,
  Newspaper,
  Activity,
  Gift,
  QrCode,
  ShieldCheck,
  RotateCcw,
  Clock,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { StaffRole } from "@/lib/api";

export type MenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const ROLE_LABEL: Record<StaffRole, string> = {
  vendor:   "Vendor",
  taluk:    "Taluk",
  district: "District",
  state:    "State",
  driver:   "Driver",
  admin:    "Admin",
};

// Per BUILD_SPEC_V2.md §13.
export const ROLE_MENU: Record<StaffRole, MenuItem[]> = {
  vendor: [
    { href: "/dashboard",     label: "Dashboard",   icon: LayoutDashboard },
    { href: "/products",      label: "Products",    icon: Package },
    { href: "/orders",        label: "Orders",      icon: ShoppingCart },
    { href: "/returns",       label: "Returns",     icon: RotateCcw },
    { href: "/my-drivers",    label: "Drivers",     icon: Truck },
    { href: "/qr-scanner",    label: "QR Scanner",  icon: QrCode },
    { href: "/customer-purchase", label: "Customer purchase", icon: CreditCard },
    { href: "/tokens",        label: "Tokens",      icon: Coins },
    { href: "/wallet",        label: "Wallet",      icon: Wallet },
    { href: "/ad-banner-request", label: "Ad banner request", icon: ImageIcon },
    { href: "/ad-video-request",  label: "Ad video request",  icon: Video },
    { href: "/shop-image",        label: "Shop image",        icon: Store },
    { href: "/activity",      label: "Activity",    icon: Activity },
    { href: "/profile",       label: "Profile",     icon: User },
  ],
  taluk: [
    { href: "/dashboard",       label: "Dashboard",        icon: LayoutDashboard },
    { href: "/manage-vendors",  label: "Vendors",          icon: Store },
    { href: "/distribute-token",label: "Distribute Token", icon: Coins },
    { href: "/token-request",   label: "Token Requests",   icon: ArrowDownToLine },
    { href: "/activity",        label: "Activity",         icon: Activity },
    { href: "/profile",         label: "Profile",          icon: User },
  ],
  district: [
    { href: "/dashboard",       label: "Dashboard",        icon: LayoutDashboard },
    { href: "/manage-taluks",   label: "Taluks",           icon: Building2 },
    { href: "/distribute-token",label: "Distribute Token", icon: Coins },
    { href: "/token-request",   label: "Token Requests",   icon: ArrowDownToLine },
    { href: "/activity",        label: "Activity",         icon: Activity },
    { href: "/profile",         label: "Profile",          icon: User },
  ],
  state: [
    { href: "/dashboard",         label: "Dashboard",        icon: LayoutDashboard },
    { href: "/manage-districts",  label: "Districts",        icon: Building2 },
    { href: "/distribute-token",  label: "Distribute Token", icon: Coins },
    { href: "/token-request",     label: "Token Requests",   icon: ArrowDownToLine },
    { href: "/activity",          label: "Activity",         icon: Activity },
    { href: "/profile",           label: "Profile",          icon: User },
  ],
  driver: [
    { href: "/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
    { href: "/driver/orders", label: "My Deliveries", icon: Truck },
    { href: "/profile",       label: "Profile",       icon: User },
  ],
  admin: [
    { href: "/dashboard",         label: "Dashboard",          icon: LayoutDashboard },
    { href: "/customers",         label: "Customers",          icon: UserPlus },
    { href: "/vendor-categories", label: "Vendor Categories",  icon: Layers },
    { href: "/categories",        label: "Product Categories", icon: Tags },
    { href: "/banners",           label: "Home Banners",       icon: ImageIcon },
    { href: "/ad-requests",       label: "Ad requests",        icon: Video },
    { href: "/customer-videos",   label: "Customer Videos",    icon: Film },
    { href: "/shop-images",       label: "Shop image approval",icon: ImageIcon },
    { href: "/manage-states",     label: "States",             icon: Building2 },
    { href: "/manage-districts",  label: "Districts",          icon: Building2 },
    { href: "/manage-taluks",     label: "Taluks",             icon: Building2 },
    { href: "/manage-vendors",    label: "Vendors",            icon: Store },
    { href: "/import-products",   label: "Import Products",    icon: Upload },
    { href: "/wallet",            label: "Wallet",             icon: Wallet },
    { href: "/withdrawals",       label: "Withdrawals",        icon: Banknote },
    { href: "/kyc",               label: "KYC Review",         icon: ShieldCheck },
    { href: "/token-request",     label: "Token Requests",     icon: Coins },
    { href: "/drivers",           label: "Drivers",            icon: Truck },
    { href: "/driver-shift",      label: "Driver Shift",       icon: Clock },
    { href: "/delivery-rates",    label: "Delivery Rates",     icon: Route },
    { href: "/lucky-draw",        label: "Lucky Draw",         icon: Gift },
    { href: "/broadcasts",        label: "Broadcasts",         icon: Bell },
    { href: "/blog",              label: "Blog",               icon: Newspaper },
    { href: "/activity-log",      label: "Activity Log",       icon: ClipboardList },
    { href: "/settings",          label: "Settings",           icon: Settings },
    { href: "/profile",           label: "Profile",            icon: User },
  ],
};

// Routes everyone (regardless of role) is allowed to visit.
export const COMMON_ROUTES = ["/notifications"];

export function menuFor(role: string | undefined): MenuItem[] {
  if (!role || role === "customer") return [];
  return ROLE_MENU[role as StaffRole] ?? [];
}

export function isRouteAllowed(role: string | undefined, pathname: string): boolean {
  if (COMMON_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) return true;
  const items = menuFor(role);
  return items.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );
}
