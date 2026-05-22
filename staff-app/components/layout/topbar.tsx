"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Breadcrumbs } from "./breadcrumbs";
import { CommandPalette } from "./command-palette";
import { NotificationsBell } from "./notifications-bell";
import { UserMenu } from "./user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { GradientButton } from "@/components/ui/custom/gradient-button";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 hidden border-b border-border bg-background md:block isolate">
      <div className="relative flex h-16 items-center gap-3 px-6">
        <div className="hidden flex-1 md:block">
          <Breadcrumbs />
        </div>

        <div className="flex flex-1 justify-end md:flex-[2] md:justify-center">
          <CommandPalette />
        </div>

        <div className="flex items-center gap-2">
          <Link href="/distribute-token" className="hidden xl:block">
            <GradientButton size="sm">
              <Plus className="h-3.5 w-3.5" /> Quick action
            </GradientButton>
          </Link>
          <ThemeToggle className="h-10 w-10 rounded-xl border border-border bg-surface-2/60 hover:border-brand/40 hover:bg-surface-2" />
          <NotificationsBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
