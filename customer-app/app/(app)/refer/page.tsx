"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Gift, Loader2, Users, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { AnimatedCounter } from "@/components/ui/custom/animated-counter";
import { useAuth } from "@/stores/auth";
import { api } from "@/lib/api";
import { mock, type MockReferral } from "@/lib/mock";

type ApiReferral = {
  id: number;
  referrer_id: number;
  referred_id: number;
  level?: number | string;
  bonus_amount: number | string;
  created_at?: string | null;
  referred?: { name: string; mobile_number: string } | null;
};

function adapt(raw: ApiReferral): MockReferral {
  const lvl = Number(raw.level ?? 1);
  return {
    id: raw.id,
    name: raw.referred?.name ?? "—",
    mobile_number: raw.referred?.mobile_number ?? "",
    joined_at: (raw.created_at ?? "").slice(0, 10),
    bonus_amount: Number(raw.bonus_amount ?? 0),
    level: (lvl === 2 || lvl === 3 ? lvl : 1) as 1 | 2 | 3,
  };
}

const LEVEL_BADGE: Record<1 | 2 | 3, string> = {
  1: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/30",
  2: "bg-amber-500/15 text-amber-500 ring-amber-500/30",
  3: "bg-sky-500/15 text-sky-500 ring-sky-500/30",
};

export default function ReferPage() {
  const { user } = useAuth();
  const [refs, setRefs] = useState<MockReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState<string>("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/referrals/list");
        const items = (res.data.data?.items ?? []) as ApiReferral[];
        setRefs(items.map(adapt));
      } catch {
        // Backend down — show offline mock so the page is still useful.
        setRefs(await mock.getReferrals());
        toast.message("Showing offline sample referrals (backend unreachable)");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Build the shareable referral link against the production App Links domain
  // (NEXT_PUBLIC_REFERRAL_DOMAIN). It must be the verified domain so that
  // https://<domain>/ref/{code} opens the installed app, or falls back to the
  // Play Store / web register. The APK runs on a localhost origin, so we can't
  // derive the domain from window.location here.
  useEffect(() => {
    if (!user?.mobile_number) return;
    const domain = (process.env.NEXT_PUBLIC_REFERRAL_DOMAIN ?? "https://app.sprithi.com").replace(/\/+$/, "");
    setShareUrl(`${domain}/ref/${encodeURIComponent(user.mobile_number)}`);
  }, [user?.mobile_number]);

  const code = user?.mobile_number ?? "";
  const total = refs.reduce((s, r) => s + r.bonus_amount, 0);
  const shareMessage = useMemo(
    () => `Hey! Join me on SPRITHI Digital Mart — use my referral code ${code} and we both get rewards.\n${shareUrl}`,
    [code, shareUrl],
  );

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => toast.success("Code copied"));
  }
  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => toast.success("Link copied"));
  }
  async function share() {
    if (!shareUrl) return;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share?.({
          title: "Join me on SPRITHI Digital Mart",
          text: shareMessage,
          url: shareUrl,
        });
        return;
      } catch {
        // user dismissed the share sheet — fall through to copy
      }
    }
    navigator.clipboard.writeText(shareMessage).then(() => toast.success("Message copied"));
  }

  return (
    <>
      <AppHeader title="Refer" />
      <section className="mx-auto max-w-md space-y-4 p-4 pb-24 md:max-w-3xl md:p-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <LuxuryCard glow hoverLift={false} className="relative overflow-hidden brand-gradient p-6 text-brand-foreground">
            <div className="absolute inset-0 brand-gradient-soft opacity-30" />
            <div className="relative space-y-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                <Gift className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-wider opacity-80">Your referral code</p>
                <p className="mt-1 text-3xl font-bold tracking-wide">{code || "—"}</p>
              </div>

              {/* Shareable URL — friends who open it land on register with the code pre-filled, no typing needed. */}
              {shareUrl && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider opacity-80">Your referral link</p>
                  <p
                    className="mt-1 truncate rounded-lg bg-white/10 px-3 py-2 font-mono text-xs backdrop-blur"
                    title={shareUrl}
                  >
                    {shareUrl}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  onClick={copyCode}
                  className="flex items-center justify-center gap-2 rounded-xl bg-white/15 px-3 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/25"
                >
                  <Copy className="h-4 w-4" /> Copy code
                </button>
                <button
                  onClick={copyLink}
                  disabled={!shareUrl}
                  className="flex items-center justify-center gap-2 rounded-xl bg-white/15 px-3 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/25 disabled:opacity-50"
                >
                  <Link2 className="h-4 w-4" /> Copy link
                </button>
                <button
                  onClick={() => void share()}
                  disabled={!shareUrl}
                  className="flex items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-brand hover:bg-white/90 disabled:opacity-50"
                >
                  <Share2 className="h-4 w-4" /> Share
                </button>
              </div>

              <p className="text-xs opacity-80">
                Send your friend the link above. They tap it → register page opens with your code pre-filled. When they sign up, you earn ₹15 in your level wallet.
              </p>
            </div>
          </LuxuryCard>
        </motion.div>

        <LuxuryCard hoverLift={false} className="grid grid-cols-3 gap-2 p-4 text-center">
          {([
            { label: "Level 1", count: user?.level_1_count ?? 0 },
            { label: "Level 2", count: user?.level_2_count ?? 0 },
            { label: "Level 3", count: user?.level_3_count ?? 0 },
          ]).map((lv) => (
            <div key={lv.label}>
              <p className="text-2xl font-bold tracking-tight"><AnimatedCounter value={lv.count} /></p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{lv.label}</p>
            </div>
          ))}
        </LuxuryCard>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> My referrals
            </h3>
            <span className="text-xs"><span className="text-muted-foreground">Total earned:</span> <span className="font-semibold text-brand">₹{total}</span></span>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : refs.length === 0 ? (
            <LuxuryCard hoverLift={false} className="p-6 text-center text-sm text-muted-foreground">No referrals yet — share your link!</LuxuryCard>
          ) : (
            <div className="space-y-2">
              {refs.map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <LuxuryCard className="flex items-center justify-between p-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-xs font-semibold text-brand">
                        {r.name.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{r.name}</p>
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${LEVEL_BADGE[r.level]}`}>
                            L{r.level}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{r.mobile_number} · {r.joined_at}</p>
                      </div>
                    </div>
                    <span className="font-semibold text-emerald-400">+₹{r.bonus_amount}</span>
                  </LuxuryCard>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
