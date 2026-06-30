"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Gift, Loader2, Users, Link2, Share2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { AnimatedCounter } from "@/components/ui/custom/animated-counter";
import { useAuth } from "@/stores/auth";
import { api } from "@/lib/api";
import { mock } from "@/lib/mock";

type ApiReferral = {
  id: number;
  referrer_id: number;
  referred_id: number;
  level?: number | string;
  bonus_amount: number | string;
  created_at?: string | null;
  referred?: { name: string; mobile_number: string } | null;
};

type ReferralRow = {
  id: number;
  name: string;
  mobile_number: string;
  created_at: string; // raw datetime; "" when unknown
  bonus_amount: number;
  level: 1 | 2 | 3;
};

function adapt(raw: ApiReferral): ReferralRow {
  const lvl = Number(raw.level ?? 1);
  return {
    id: raw.id,
    name: raw.referred?.name ?? "—",
    mobile_number: raw.referred?.mobile_number ?? "",
    created_at: raw.created_at ?? "",
    bonus_amount: Number(raw.bonus_amount ?? 0),
    level: (lvl === 2 || lvl === 3 ? lvl : 1) as 1 | 2 | 3,
  };
}

// "12 Jun 2026, 04:35 PM" — full date AND time for each referral credit.
function fmtDateTime(s: string): string {
  if (!s) return "—";
  const d = new Date(s.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

const LEVEL_BADGE: Record<1 | 2 | 3, string> = {
  1: "bg-emerald-500/15 text-emerald-500 ring-emerald-500/30",
  2: "bg-amber-500/15 text-amber-500 ring-amber-500/30",
  3: "bg-sky-500/15 text-sky-500 ring-sky-500/30",
};

type Tab = "all" | 1 | 2 | 3;
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: 1, label: "Level 1" },
  { key: 2, label: "Level 2" },
  { key: 3, label: "Level 3" },
];

export default function ReferPage() {
  const { user } = useAuth();
  const [refs, setRefs] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [showQr, setShowQr] = useState(false);
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/referrals/list");
        const items = (res.data.data?.items ?? []) as ApiReferral[];
        setRefs(items.map(adapt));
      } catch {
        // Backend down — show offline mock so the page is still useful.
        const m = await mock.getReferrals();
        setRefs(m.map((r) => ({
          id: r.id, name: r.name, mobile_number: r.mobile_number,
          created_at: r.joined_at, bonus_amount: r.bonus_amount, level: r.level,
        })));
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
  const lifetimeTotal = refs.reduce((s, r) => s + r.bonus_amount, 0);
  const levelTotals = useMemo(() => {
    const t: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
    for (const r of refs) t[r.level] += r.bonus_amount;
    return t;
  }, [refs]);
  const filtered = useMemo(
    () => (tab === "all" ? refs : refs.filter((r) => r.level === tab)),
    [refs, tab],
  );
  const shareMessage = useMemo(
    () => `Hey! Join me on SPRITHI Digital Mart — use my referral code ${code} and we both get rewards.\n${shareUrl}`,
    [code, shareUrl],
  );
  // Free, no-dependency QR image of the referral link (goQR API).
  const qrSrc = shareUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(shareUrl)}`
    : "";

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
    // APK (Capacitor WebView): the Web Share API isn't reliable there, so use the
    // native @capacitor/share plugin to open the Android/iOS system share sheet.
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      try {
        const { Share } = await import("@capacitor/share");
        // `shareMessage` already ends with the link — do NOT also pass `url`, or
        // Android appends it again and the link shows twice.
        await Share.share({ title: "Join me on SPRITHI Digital Mart", text: shareMessage, dialogTitle: "Share your referral" });
      } catch {
        navigator.clipboard.writeText(shareMessage).then(() => toast.success("Message copied"));
      }
      return;
    }
    // Browser: Web Share API (text only → link appears once), else clipboard copy.
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share?.({
          title: "Join me on SPRITHI Digital Mart",
          text: shareMessage,
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

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                  onClick={() => setShowQr((v) => !v)}
                  disabled={!shareUrl}
                  className="flex items-center justify-center gap-2 rounded-xl bg-white/15 px-3 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/25 disabled:opacity-50"
                >
                  <QrCode className="h-4 w-4" /> {showQr ? "Hide QR" : "QR code"}
                </button>
                <button
                  onClick={() => void share()}
                  disabled={!shareUrl}
                  className="flex items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-brand hover:bg-white/90 disabled:opacity-50"
                >
                  <Share2 className="h-4 w-4" /> Share
                </button>
              </div>

              {/* QR code — scan to open the referral link. */}
              {showQr && qrSrc && (
                <div className="flex flex-col items-center gap-2 rounded-xl bg-white/10 p-4 backdrop-blur">
                  <img
                    src={qrSrc}
                    alt="Referral QR code"
                    width={180}
                    height={180}
                    className="rounded-lg bg-white p-2"
                  />
                  <p className="text-xs opacity-90">Scan to open my referral link</p>
                </div>
              )}

              <p className="text-xs opacity-80">
                Send your friend the link or QR above. They tap it → register page opens with your code pre-filled. When they sign up, you earn ₹15 in your level wallet.
              </p>
            </div>
          </LuxuryCard>
        </motion.div>

        {/* Lifetime Referral Bonus — total earned across all levels. */}
        <LuxuryCard glow hoverLift={false} className="p-5 text-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Lifetime Referral Bonus</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-brand">
            ₹<AnimatedCounter value={Math.round(lifetimeTotal)} />
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Total earned from all your referrals</p>
        </LuxuryCard>

        <LuxuryCard hoverLift={false} className="grid grid-cols-3 gap-2 p-4 text-center">
          {([
            { label: "Level 1", count: user?.level_1_count ?? 0, total: levelTotals[1] },
            { label: "Level 2", count: user?.level_2_count ?? 0, total: levelTotals[2] },
            { label: "Level 3", count: user?.level_3_count ?? 0, total: levelTotals[3] },
          ]).map((lv) => (
            <div key={lv.label}>
              <p className="text-2xl font-bold tracking-tight"><AnimatedCounter value={lv.count} /></p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{lv.label}</p>
              <p className="mt-0.5 text-[11px] font-medium text-brand">₹{Number(lv.total ?? 0).toFixed(2)}</p>
            </div>
          ))}
        </LuxuryCard>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              <Users className="h-3.5 w-3.5" /> Referral history
            </h3>
          </div>

          {/* Level tabs — view referrals categorised by referral level. */}
          <div className="mb-3 flex gap-1.5 overflow-x-auto rounded-xl bg-surface-2/60 p-1">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={String(t.key)}
                  onClick={() => setTab(t.key)}
                  className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    active ? "bg-brand text-brand-foreground shadow" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : filtered.length === 0 ? (
            <LuxuryCard hoverLift={false} className="p-6 text-center text-sm text-muted-foreground">
              {tab === "all" ? "No referrals yet — share your link!" : `No Level ${tab} referrals yet.`}
            </LuxuryCard>
          ) : (
            <div className="space-y-2">
              {filtered.map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <LuxuryCard className="flex items-center justify-between p-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-xs font-semibold text-brand">
                        {r.name.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          {/* Level 1 shows the referred user's name + mobile; L2/L3 are
                              amount-only (the referred member's details aren't required). */}
                          <p className="font-medium">{r.level === 1 ? r.name : `Level ${r.level} referral`}</p>
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${LEVEL_BADGE[r.level]}`}>
                            L{r.level}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {r.level === 1 && r.mobile_number ? `${r.mobile_number} · ` : ""}{fmtDateTime(r.created_at)}
                        </p>
                      </div>
                    </div>
                    <span className="font-semibold text-emerald-400">+₹{Number(r.bonus_amount ?? 0).toFixed(2)}</span>
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
