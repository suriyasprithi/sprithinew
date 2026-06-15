"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut, Mail, MapPin, Phone, Shield, User as UserIcon, Pencil, Settings as SettingsIcon, Home, Landmark, CreditCard, FileText, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/data-table/status-badge";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/stores/auth";
import { loginUrl } from "@/lib/login-redirect";
import { ROLE_LABEL } from "@/lib/role-menu";
import { api, apiErrorMessage, AuthUser } from "@/lib/api";

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
type BankForm = { account_holder: string; bank_name: string; account_number: string; ifsc_code: string; upi: string; gst: string };

export default function ProfilePage() {
  const { user, logout, setUser } = useAuth();
  const router = useRouter();

  const [editingAddr, setEditingAddr] = useState(false);
  const [savingAddr, setSavingAddr] = useState(false);
  const [addrForm, setAddrForm] = useState<AddressForm>({ address_line: "", landmark: "", city: "", pincode: "" });

  const [editingBank, setEditingBank] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [bankForm, setBankForm] = useState<BankForm>({ account_holder: "", bank_name: "", account_number: "", ifsc_code: "", upi: "", gst: "" });
  const isVendor = user?.role === "vendor";

  async function onLogout() {
    await logout();
    window.location.href = loginUrl();
  }

  function openAddrEdit() {
    setAddrForm({
      address_line: user?.address_line ?? "",
      landmark:     user?.landmark ?? "",
      city:         user?.city ?? "",
      pincode:      user?.pincode ?? "",
    });
    setEditingAddr(true);
  }

  async function saveAddr() {
    setSavingAddr(true);
    try {
      const res = await api.patch("/auth/me/address", addrForm);
      setUser(res.data.data as AuthUser);
      toast.success("Address updated");
      setEditingAddr(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Save failed"));
    } finally {
      setSavingAddr(false);
    }
  }

  function openBankEdit() {
    setBankForm({
      account_holder: user?.account_holder ?? "",
      bank_name:      user?.bank_name ?? "",
      account_number: user?.account_number ?? "",
      ifsc_code:      user?.ifsc_code ?? "",
      upi:            user?.upi ?? "",
      gst:            user?.gst ?? "",
    });
    setEditingBank(true);
  }

  async function saveBank() {
    setSavingBank(true);
    try {
      const res = await api.patch("/auth/me/bank", bankForm);
      setUser(res.data.data as AuthUser);
      toast.success("Bank details updated");
      setEditingBank(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Save failed"));
    } finally {
      setSavingBank(false);
    }
  }

  const hasBank = !!(user?.account_holder || user?.bank_name || user?.account_number || user?.ifsc_code || user?.upi || user?.gst);

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
                <InfoRow icon={Shield} label="Status"  value={user?.status} />
              </div>
            </LuxuryCard>

            <LuxuryCard className="mt-4 p-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-brand" />
                  <p className="text-sm font-semibold">Bank details</p>
                </div>
                {!editingBank && (
                  <Button size="sm" variant="ghost" onClick={openBankEdit} className="-mr-2 h-7 gap-1.5 text-xs">
                    <Pencil className="h-3.5 w-3.5" /> {hasBank ? "Edit" : "Add"}
                  </Button>
                )}
              </div>

              {editingBank ? (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="bank_holder">Account holder name</Label>
                    <Input id="bank_holder" value={bankForm.account_holder} onChange={(e) => setBankForm({ ...bankForm, account_holder: e.target.value })} placeholder="As per bank records" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bank_name">Bank name</Label>
                    <Input id="bank_name" value={bankForm.bank_name} onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })} placeholder="e.g. State Bank of India" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="bank_acc">Account number</Label>
                      <Input id="bank_acc" inputMode="numeric" value={bankForm.account_number} onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value.replace(/\s/g, "") })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="bank_ifsc">IFSC code</Label>
                      <Input id="bank_ifsc" value={bankForm.ifsc_code} onChange={(e) => setBankForm({ ...bankForm, ifsc_code: e.target.value.toUpperCase().replace(/\s/g, "") })} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bank_upi">UPI ID</Label>
                    <Input id="bank_upi" value={bankForm.upi} onChange={(e) => setBankForm({ ...bankForm, upi: e.target.value })} placeholder="name@bank" />
                  </div>
                  {isVendor && (
                    <div className="space-y-1.5">
                      <Label htmlFor="bank_gst">GST number</Label>
                      <Input id="bank_gst" value={bankForm.gst} onChange={(e) => setBankForm({ ...bankForm, gst: e.target.value.toUpperCase().replace(/\s/g, "") })} placeholder="e.g. 33ABCDE1234F1Z5" />
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button variant="ghost" className="flex-1" disabled={savingBank} onClick={() => setEditingBank(false)}>Cancel</Button>
                    <GradientButton className="flex-1" disabled={savingBank} onClick={() => void saveBank()}>
                      {savingBank ? "Saving…" : "Save bank details"}
                    </GradientButton>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  <InfoRow icon={UserIcon}   label="Account holder" value={user?.account_holder} />
                  <InfoRow icon={Landmark}   label="Bank name"      value={user?.bank_name} />
                  <InfoRow icon={CreditCard} label="Account number" value={user?.account_number} mono />
                  <InfoRow icon={CreditCard} label="IFSC code"      value={user?.ifsc_code} mono />
                  <InfoRow icon={Landmark}   label="UPI ID"         value={user?.upi} />
                  {isVendor && <InfoRow icon={FileText} label="GST number" value={user?.gst} mono />}
                </div>
              )}
            </LuxuryCard>

            <LuxuryCard className="mt-4 p-5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-brand" />
                  <p className="text-sm font-semibold">Address</p>
                </div>
                {!editingAddr && (
                  <Button size="sm" variant="ghost" onClick={openAddrEdit} className="-mr-2 h-7 gap-1.5 text-xs">
                    <Pencil className="h-3.5 w-3.5" /> {user?.address_line || user?.city || user?.pincode ? "Edit" : "Add"}
                  </Button>
                )}
              </div>

              {editingAddr ? (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="addr_line">Full address</Label>
                    <Textarea
                      id="addr_line"
                      rows={2}
                      value={addrForm.address_line}
                      onChange={(e) => setAddrForm({ ...addrForm, address_line: e.target.value })}
                      placeholder="House no, street, area"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="addr_landmark">Landmark</Label>
                    <Input
                      id="addr_landmark"
                      value={addrForm.landmark}
                      onChange={(e) => setAddrForm({ ...addrForm, landmark: e.target.value })}
                      placeholder="Near…"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="addr_city">City</Label>
                      <Input
                        id="addr_city"
                        value={addrForm.city}
                        onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="addr_pin">Pincode</Label>
                      <Input
                        id="addr_pin"
                        inputMode="numeric"
                        value={addrForm.pincode}
                        onChange={(e) => setAddrForm({ ...addrForm, pincode: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="ghost" className="flex-1" disabled={savingAddr} onClick={() => setEditingAddr(false)}>Cancel</Button>
                    <GradientButton className="flex-1" disabled={savingAddr} onClick={() => void saveAddr()}>
                      {savingAddr ? "Saving…" : "Save address"}
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
