"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

type NotifItem = { id: number | string; title?: string; body?: string; created_at?: string; read_at?: string | null; route?: string | null };

export function NotificationsBell() {
  const router = useRouter();
  const { user, isHydrated } = useAuth();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotifItem[]>([]);

  // Mark the notification read, then jump to the page it points at.
  async function open(n: NotifItem) {
    if (!n.read_at) {
      try { await api.patch(`/notifications/${n.id}/read`); setUnread((u) => Math.max(0, u - 1)); } catch { /* ignore */ }
    }
    if (n.route) router.push(n.route);
  }

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
            <DropdownMenuItem
              key={n.id}
              onClick={() => void open(n)}
              className={cn("flex flex-col items-start gap-0.5 py-2", n.route && "cursor-pointer")}
            >
              <div className="flex w-full items-center gap-2">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", n.read_at ? "bg-muted-foreground" : "bg-brand")} />
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
