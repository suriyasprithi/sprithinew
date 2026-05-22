"use client";

import { useState } from "react";
import { Bell, Send, Loader2, Users, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const ROLES = ["customer", "vendor", "taluk", "district", "state", "driver", "admin"] as const;

export default function BroadcastsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<"role" | "user">("role");
  const [role, setRole] = useState<typeof ROLES[number]>("customer");
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!title) { toast.error("Title required"); return; }
    if (target === "user" && !userId) { toast.error("User id required"); return; }
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { title, body: body || null };
      if (target === "role") payload.role = role; else payload.user_id = Number(userId);
      await api.post("/notifications/send", payload);
      toast.success("Broadcast sent");
      setTitle(""); setBody(""); setUserId("");
    } catch (e) { toast.error(apiErrorMessage(e)); }
    finally { setBusy(false); }
  }

  return (
    <>
      <MobileHeader title="Broadcasts" />
      <section className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Notifications"
          icon={Bell}
          title="Broadcasts"
          description="Send a push notification to a role group or a single user."
        />

        <LuxuryCard className="p-5">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New token rules announced" />
            </div>

            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Tap to read the full announcement…" />
            </div>

            <div className="space-y-2">
              <Label>Target audience</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["role", "user"] as const).map((t) => (
                  <motion.button
                    key={t}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setTarget(t)}
                    className={cn(
                      "group relative flex items-center gap-3 overflow-hidden rounded-xl border p-3 text-left transition-all",
                      target === t ? "border-brand/40 bg-brand/5 brand-glow" : "border-border bg-surface hover:border-brand/30",
                    )}
                  >
                    <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg", target === t ? "bg-brand/15 text-brand" : "bg-muted text-muted-foreground")}>
                      {t === "role" ? <Users className="h-4 w-4" /> : <UserIcon className="h-4 w-4" />}
                    </span>
                    <div>
                      <p className="text-sm font-medium">By {t}</p>
                      <p className="text-[11px] text-muted-foreground">{t === "role" ? "Everyone in a role group" : "A specific user id"}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {target === "role" ? (
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => v && setRole(v as typeof ROLES[number])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>User ID</Label>
                <Input inputMode="numeric" value={userId} onChange={(e) => setUserId(e.target.value.replace(/\D/g, ""))} placeholder="123" />
              </div>
            )}

            <GradientButton size="lg" className="w-full" onClick={() => void send()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" /> Send push</>}
            </GradientButton>
          </div>
        </LuxuryCard>
      </section>
    </>
  );
}
