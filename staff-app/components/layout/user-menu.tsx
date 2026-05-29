"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon, Settings, ChevronDown } from "lucide-react";
import { useAuth } from "@/stores/auth";
import { ROLE_LABEL } from "@/lib/role-menu";
import type { StaffRole } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const roleLabel = user && user.role !== "customer" ? ROLE_LABEL[user.role as StaffRole] : "";
  const initial = (user?.name || "?").trim().charAt(0).toUpperCase();

  const onLogout = async () => {
    await logout();
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    if (basePath === "") window.location.assign("/login/");
    else window.location.href = "/admin/login/";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/60 py-1 pl-1 pr-2 hover:border-brand/40 hover:bg-surface-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg brand-gradient text-sm font-semibold text-brand-foreground">
              {initial}
            </span>
            <span className="hidden text-left lg:block">
              <span className="block text-xs font-medium leading-tight">{user?.name ?? "—"}</span>
              <span className="block text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">{roleLabel}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-1.5 py-1.5">
          <p className="text-sm font-medium">{user?.name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{roleLabel}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <Link href="/profile" className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" /> <span>Profile</span>
            </Link>
          }
        />
        <DropdownMenuItem
          render={
            <Link href="/settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" /> <span>Settings</span>
            </Link>
          }
        />
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout} className="text-brand focus:text-brand">
          <LogOut className="h-4 w-4" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
