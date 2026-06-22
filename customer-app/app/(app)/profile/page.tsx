"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Home, LogOut, Mail, Phone, Shield, ShieldCheck, Wallet, User as UserIcon, type LucideIcon } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { AnimatedCounter } from "@/components/ui/custom/animated-counter";
import { formatAddress } from "@/components/address/address-fields";
import { useLogoutConfirm } from "@/components/use-logout-confirm";
import { useAuth } from "@/stores/auth";
import { api, type CustomerAddress } from "@/lib/api";

const fmtINR = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);

const KYC_LABEL: Record<string, string> = {
  none:     "Not submitted — tap to complete",
  pending:  "Submitted — pending verification",
  verified: "Verified ✓",
  rejected: "Rejected — tap to re-submit",
};

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
  const { user } = useAuth();
  const { requestLogout, logoutDialog } = useLogoutConfirm();
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/customer/addresses");
        const items = (res.data.data?.items ?? []) as CustomerAddress[];
        setAddresses(items.map((a) => ({ ...a, is_default: Number(a.is_default) })));
      } catch { /* non-blocking */ }
    })();
  }, []);

  const defaultAddr = addresses.find((a) => Number(a.is_default) === 1) ?? addresses[0] ?? null;
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

        <div className="grid grid-cols-1 gap-3">
          <LuxuryCard className="p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Wallet className="h-4 w-4" />
            </span>
            <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">Wallet</p>
            <p className="mt-0.5 text-xl font-bold tracking-tight">
              <AnimatedCounter value={user?.wallet_balance ?? 0} format={fmtINR} />
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
            <InfoRow icon={Shield} label="Status"  value={user?.status} />
          </div>
        </LuxuryCard>

        {/* KYC / Bank details — required before withdrawing */}
        <Link href="/profile/kyc" className="block">
          <LuxuryCard hoverLift={false} className="p-5 transition-colors hover:border-brand/40">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">KYC / Bank details</p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {KYC_LABEL[user?.kyc_status ?? "none"]}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </LuxuryCard>
        </Link>

        {/* Delivery addresses — managed on a dedicated page */}
        <Link href="/profile/addresses" className="block">
          <LuxuryCard hoverLift={false} className="p-5 transition-colors hover:border-brand/40">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Home className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">Delivery addresses</p>
                  {addresses.length > 0 && (
                    <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {addresses.length}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {defaultAddr ? formatAddress(defaultAddr) : "No address saved — tap to add"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          </LuxuryCard>
        </Link>

        <Link
          href="/home"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-2/40 px-4 py-3 text-sm font-medium text-muted-foreground hover:border-brand/40 hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" /> Continue shopping
        </Link>

        <GradientButton
          size="lg"
          className="w-full"
          onClick={requestLogout}
          style={{ backgroundImage: "linear-gradient(135deg, var(--brand-deep) 0%, #4a0606 100%)" }}
        >
          <LogOut className="h-4 w-4" /> Log out
        </GradientButton>
      </section>
      {logoutDialog}
    </>
  );
}
