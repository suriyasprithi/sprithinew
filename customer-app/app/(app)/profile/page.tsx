"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut, Mail, MapPin, Phone, Shield, Wallet, Coins, User as UserIcon, type LucideIcon } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { AnimatedCounter } from "@/components/ui/custom/animated-counter";
import { useAuth } from "@/stores/auth";

const fmtINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

function InfoRow({ icon: Icon, label, value, mono }: { icon: LucideIcon; label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`mt-0.5 truncate text-sm font-medium ${mono ? "font-mono" : ""}`}>{value || "Not set"}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const initial = (user?.name || "?").trim().charAt(0).toUpperCase();

  return (
    <>
      <AppHeader title="Profile" />
      <section className="mx-auto max-w-md space-y-4 p-4 pb-24 md:max-w-3xl md:p-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <LuxuryCard glow hoverLift={false} className="relative p-6">
            <div className="absolute inset-x-0 top-0 h-24 brand-gradient-soft" aria-hidden />
            <div className="relative flex items-center gap-4">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl brand-gradient text-2xl font-bold text-brand-foreground brand-glow">
                {initial}
              </span>
              <div>
                <p className="text-xl font-semibold tracking-tight">{user?.name ?? "—"}</p>
                <span className="mt-1 inline-flex items-center rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
                  {user?.role ?? "customer"}
                </span>
              </div>
            </div>
          </LuxuryCard>
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          <LuxuryCard className="p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Wallet className="h-4 w-4" />
            </span>
            <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">Wallet</p>
            <p className="mt-0.5 text-xl font-bold tracking-tight">
              <AnimatedCounter value={user?.wallet_balance ?? 0} format={fmtINR} />
            </p>
          </LuxuryCard>
          <LuxuryCard className="p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <Coins className="h-4 w-4" />
            </span>
            <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">Tokens</p>
            <p className="mt-0.5 text-xl font-bold tracking-tight">
              <AnimatedCounter value={user?.token_balance ?? 0} />
            </p>
          </LuxuryCard>
        </div>

        <LuxuryCard hoverLift={false} className="p-5">
          <div className="mb-2 flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-brand" />
            <p className="text-sm font-semibold">Contact details</p>
          </div>
          <div className="divide-y divide-border">
            <InfoRow icon={Phone}  label="Mobile"  value={user?.mobile_number} mono />
            <InfoRow icon={Mail}   label="Email"   value={user?.email} />
            <InfoRow icon={MapPin} label="Pincode" value={user?.pincode} mono />
            <InfoRow icon={Shield} label="Status"  value={user?.status} />
          </div>
        </LuxuryCard>

        <GradientButton
          size="lg"
          className="w-full"
          onClick={() => void onLogout()}
          style={{ backgroundImage: "linear-gradient(135deg, var(--brand-deep) 0%, #4a0606 100%)" }}
        >
          <LogOut className="h-4 w-4" /> Log out
        </GradientButton>
      </section>
    </>
  );
}
