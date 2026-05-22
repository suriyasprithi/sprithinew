"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { api, apiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

type Note = { id: number; title: string; body: string | null; read_at: string | null; created_at: string | null };

export default function NotificationsPage() {
  const [items, setItems] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/notifications");
        setItems((res.data.data?.items ?? []) as Note[]);
      } catch (err) {
        toast.error(apiErrorMessage(err));
      } finally { setLoading(false); }
    })();
  }, []);

  const markRead = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setItems((arr) => arr.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    } catch { /* ignore */ }
  };

  return (
    <>
      <AppHeader title="Notifications" />
      <section className="mx-auto max-w-md space-y-3 p-4 pb-24 md:max-w-3xl md:p-8">
        {loading ? (
          <div className="flex items-center gap-2 py-10 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : items.length === 0 ? (
          <LuxuryCard hoverLift={false} className="p-10 text-center">
            <Bell className="mx-auto mb-3 h-10 w-10 text-brand" />
            <p className="text-sm font-medium">No notifications yet</p>
            <p className="mt-1 text-xs text-muted-foreground">You&apos;ll see updates here.</p>
          </LuxuryCard>
        ) : (
          <div className="space-y-2">
            {items.map((n, i) => (
              <motion.div key={n.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                <button
                  onClick={() => !n.read_at && markRead(n.id)}
                  className={cn(
                    "w-full text-left",
                    !n.read_at && "cursor-pointer",
                  )}
                >
                  <LuxuryCard className={cn("p-4 transition-colors", !n.read_at && "border-brand/30")} >
                    <div className="flex items-start gap-3">
                      <span className={cn(
                        "mt-1 h-2 w-2 shrink-0 rounded-full",
                        n.read_at ? "bg-muted-foreground" : "bg-brand brand-glow",
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{n.title}</p>
                        {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                        <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">{n.created_at?.slice(0, 16)}</p>
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
