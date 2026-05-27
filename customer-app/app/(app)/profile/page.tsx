"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, LogOut, Mail, MapPin, Phone, Shield, Wallet, Coins, User as UserIcon, Home, Pencil, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { AnimatedCounter } from "@/components/ui/custom/animated-counter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/stores/auth";
import { api, apiErrorMessage, AuthUser } from "@/lib/api";

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

type AddressForm = { address_line: string; landmark: string; city: string; pincode: string };

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, setUser } = useAuth();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AddressForm>({ address_line: "", landmark: "", city: "", pincode: "" });

  const onLogout = async () => {
    await logout();
    router.replace("/login");
  };

  function openEdit() {
    setForm({
      address_line: user?.address_line ?? "",
      landmark:     user?.landmark ?? "",
      city:         user?.city ?? "",
      pincode:      user?.pincode ?? "",
    });
    setEditing(true);
  }

  async function saveAddress() {
    setSaving(true);
    try {
      const res = await api.patch("/auth/me/address", form);
      setUser(res.data.data as AuthUser);
      toast.success("Address updated");
      setEditing(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  }

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
            <InfoRow icon={Shield} label="Status"  value={user?.status} />
          </div>
        </LuxuryCard>

        <LuxuryCard hoverLift={false} className="p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-brand" />
              <p className="text-sm font-semibold">Address</p>
            </div>
            {!editing && (
              <Button size="sm" variant="ghost" onClick={openEdit} className="-mr-2 h-7 gap-1.5 text-xs">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </div>

          {editing ? (
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="address_line">Full address</Label>
                <Textarea
                  id="address_line"
                  rows={2}
                  value={form.address_line}
                  onChange={(e) => setForm({ ...form, address_line: e.target.value })}
                  placeholder="House no, street, area"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="landmark">Landmark</Label>
                <Input
                  id="landmark"
                  value={form.landmark}
                  onChange={(e) => setForm({ ...form, landmark: e.target.value })}
                  placeholder="Near…"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    inputMode="numeric"
                    value={form.pincode}
                    onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" className="flex-1" disabled={saving} onClick={() => setEditing(false)}>Cancel</Button>
                <GradientButton className="flex-1" disabled={saving} onClick={() => void saveAddress()}>
                  {saving ? "Saving…" : "Save address"}
                </GradientButton>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              <InfoRow icon={Home}   label="Full address" value={user?.address_line} />
              <InfoRow icon={MapPin} label="Landmark"     value={user?.landmark} />
              <InfoRow icon={MapPin} label="City"         value={user?.city} />
              <InfoRow icon={MapPin} label="Pincode"      value={user?.pincode} mono />
            </div>
          )}
        </LuxuryCard>

        <Link
          href="/home"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-2/40 px-4 py-3 text-sm font-medium text-muted-foreground hover:border-brand/40 hover:text-brand"
        >
          <ArrowLeft className="h-4 w-4" /> Continue shopping
        </Link>

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
