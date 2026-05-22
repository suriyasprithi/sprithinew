"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut, Mail, MapPin, Phone, Shield, User as UserIcon, Pencil, Settings as SettingsIcon, type LucideIcon } from "lucide-react";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { StatusBadge } from "@/components/data-table/status-badge";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/stores/auth";
import { ROLE_LABEL } from "@/lib/role-menu";

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
  const { user, logout } = useAuth();
  const router = useRouter();

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  const roleLabel = user ? (ROLE_LABEL[user.role as keyof typeof ROLE_LABEL] ?? user.role) : "";
  const initial = (user?.name || "?").trim().charAt(0).toUpperCase();

  return (
    <>
      <MobileHeader title="Profile" />
      <section className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Account"
          icon={UserIcon}
          title="Profile"
          description="Your account information and quick controls."
        />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <LuxuryCard glow className="relative p-6">
            <div className="absolute inset-x-0 top-0 h-24 brand-gradient-soft" aria-hidden />
            <div className="relative flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl brand-gradient text-2xl font-bold text-brand-foreground brand-glow">
                  {initial}
                </span>
                <div>
                  <p className="text-2xl font-semibold tracking-tight">{user?.name ?? "—"}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
                      {roleLabel}
                    </span>
                    {user?.status && <StatusBadge status={user.status} />}
                  </div>
                </div>
              </div>
            </div>
          </LuxuryCard>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="lg:col-span-2"
          >
            <LuxuryCard className="p-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">Contact details</p>
                <p className="text-[11px] text-muted-foreground">Read-only</p>
              </div>
              <div className="divide-y divide-border">
                <InfoRow icon={Phone}  label="Mobile"  value={user?.mobile_number} mono />
                <InfoRow icon={Mail}   label="Email"   value={user?.email} />
                <InfoRow icon={MapPin} label="Pincode" value={user?.pincode} mono />
                <InfoRow icon={Shield} label="Status"  value={user?.status} />
              </div>
            </LuxuryCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <LuxuryCard className="p-5">
              <p className="mb-3 text-sm font-semibold">Quick actions</p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => router.push("/settings")}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-2/40 p-3 text-left transition-colors hover:border-brand/40 hover:bg-surface-2"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <SettingsIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">Settings</p>
                    <p className="truncate text-[11px] text-muted-foreground">System preferences</p>
                  </div>
                </button>

                <button
                  type="button"
                  disabled
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-2/40 p-3 text-left opacity-60"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Pencil className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">Edit profile</p>
                    <p className="truncate text-[11px] text-muted-foreground">Coming soon</p>
                  </div>
                </button>
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <GradientButton
                  size="md"
                  className="w-full"
                  onClick={() => void onLogout()}
                  style={{
                    backgroundImage: "linear-gradient(135deg, var(--brand-deep) 0%, #4a0606 100%)",
                  }}
                >
                  <LogOut className="h-4 w-4" /> Log out
                </GradientButton>
              </div>
            </LuxuryCard>
          </motion.div>
        </div>
      </section>
    </>
  );
}
