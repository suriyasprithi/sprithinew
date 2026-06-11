"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { EmptyState } from "@/components/data-table/empty-state";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

type Note = { id: number; title: string; body: string | null; read_at: string | null; created_at: string | null; route?: string | null };

export default function StaffNotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const r = await api.get("/notifications");
        setItems((r.data.data?.items ?? []) as Note[]);
      } catch (e) { toast.error(apiErrorMessage(e)); } finally { setLoading(false); }
    })();
  }, []);

  async function markRead(id: number) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setItems((cur) => cur.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    } catch { /* ignore */ }
  }

  // Mark read, then navigate to the page the notification points at.
  async function open(n: Note) {
    if (!n.read_at) await markRead(n.id);
    if (n.route) router.push(n.route);
  }

  const unread = items.filter((n) => !n.read_at).length;

  return (
    <>
      <MobileHeader title="Notifications" />
      <section className="mx-auto max-w-3xl space-y-5 p-4 pb-24 md:p-8">
        <PageHeader
          eyebrow={unread > 0 ? `${unread} unread` : "All caught up"}
          icon={Bell}
          title="Notifications"
          description="Updates from the system and from admin broadcasts."
        />

        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications yet" description="You'll see updates here." />
        ) : (
          <div className="space-y-2">
            {items.map((n, i) => (
              <motion.div key={n.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                <button onClick={() => void open(n)} className="block w-full text-left">
                  <LuxuryCard className={cn("p-4 transition-colors", !n.read_at && "border-brand/30")} hoverLift={!n.read_at}>
                    <div className="flex items-start gap-3">
                      <span className={cn(
                        "mt-1 h-2 w-2 shrink-0 rounded-full",
                        n.read_at ? "bg-muted-foreground" : "bg-brand brand-glow",
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{n.title}</p>
                        {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                        {n.created_at && <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">{n.created_at.slice(0, 16)}</p>}
                      </div>
                    </div>
                  </LuxuryCard>
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
