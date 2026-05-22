"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, ExternalLink } from "lucide-react";
import { useAuth } from "@/stores/auth";
import { api } from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NotifItem = { id: number | string; title?: string; body?: string; created_at?: string; read?: boolean };

export function NotificationsBell() {
  const { user, isHydrated } = useAuth();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotifItem[]>([]);

  useEffect(() => {
    if (!isHydrated || !user) return;
    let active = true;
    const tick = async () => {
      try {
        const res = await api.get("/notifications");
        if (!active) return;
        setUnread(Number(res.data.data?.unread_count ?? 0));
        const list = (res.data.data?.items ?? res.data.data?.notifications ?? []) as NotifItem[];
        setItems(list.slice(0, 5));
      } catch { /* ignore */ }
    };
    void tick();
    const id = setInterval(tick, 60000);
    return () => { active = false; clearInterval(id); };
  }, [isHydrated, user]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            aria-label="Notifications"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-2/60 hover:border-brand/40 hover:bg-surface-2"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full brand-gradient px-1 text-[10px] font-bold text-brand-foreground brand-glow">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-1.5 py-1 text-xs font-medium text-muted-foreground">
          <span>Notifications</span>
          {unread > 0 && <span>{unread} unread</span>}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">No notifications yet.</div>
        ) : (
          items.map((n) => (
            <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 py-2">
              <div className="flex w-full items-center gap-2">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", n.read ? "bg-muted-foreground" : "bg-brand")} />
                <span className="truncate text-sm font-medium">{n.title ?? "Notification"}</span>
              </div>
              {n.body && <p className="line-clamp-2 pl-3.5 text-xs text-muted-foreground">{n.body}</p>}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <Link href="/notifications" className="flex items-center justify-between text-sm">
              <span>View all</span> <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
