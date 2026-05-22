"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { GuestGuard } from "@/components/auth-guard";
import { useAuth } from "@/stores/auth";
import { api, apiErrorMessage } from "@/lib/api";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>}>
      <RegisterInner />
    </Suspense>
  );
}

function RegisterInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { hydrate, isLoading } = useAuth();
  const [step, setStep] = useState<"form" | "otp">("form");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pincode, setPincode] = useState("");
  const [referrerCode, setReferrerCode] = useState("");
  const [otp, setOtp] = useState("");
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ref = sp?.get("ref");
    if (ref) setReferrerCode(ref);
  }, [sp]);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !mobile || !password) return toast.error("Name, mobile, password are required");
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setBusy(true);
    try {
      const res = await api.post("/auth/otp/send", { mobile_number: mobile.trim(), purpose: "register" });
      const dbg = res.data.data?.debug_code as string | undefined;
      setDebugCode(dbg ?? null);
      setStep("otp");
      toast.success(dbg ? `OTP (dev): ${dbg}` : "OTP sent");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not send OTP"));
    } finally { setBusy(false); }
  };

  const verifyAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return toast.error("Enter OTP");
    setBusy(true);
    try {
      await api.post("/auth/otp/verify", { mobile_number: mobile.trim(), code: otp.trim(), purpose: "register" });
      const res = await api.post("/auth/register", {
        name: name.trim(),
        mobile_number: mobile.trim(),
        password,
        email: email.trim() || undefined,
        pincode: pincode.trim() || undefined,
        referrer_code: referrerCode.trim() || undefined,
      });
      const tokens = res.data.data;
      if (typeof window !== "undefined" && tokens?.access_token) {
        window.localStorage.setItem("epey.access_token", tokens.access_token);
        window.localStorage.setItem("epey.refresh_token", tokens.refresh_token);
      }
      await hydrate();
      toast.success("Account created");
      router.replace("/after-register");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Verification or registration failed"));
    } finally { setBusy(false); }
  };

  return (
    <GuestGuard>
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full brand-gradient opacity-20 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-brand-deep opacity-25 blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative w-full max-w-md"
        >
          <LuxuryCard glow hoverLift={false} className="p-7">
            <div className="text-center">
              <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`} alt="SPRITHI Digital Mart" className="mx-auto mb-4 h-14 w-14 object-contain" />
              <h1 className="text-2xl font-semibold tracking-tight">{step === "form" ? "Create account" : "Verify mobile"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{step === "form" ? "Join SPRITHI Digital Mart today" : `OTP sent to ${mobile}`}</p>
            </div>

            {step === "form" ? (
              <form onSubmit={sendOtp} className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" autoComplete="name" placeholder="Ramesh Kumar" value={name} onChange={(e) => setName(e.target.value)} disabled={busy || isLoading} className="h-11 rounded-xl bg-surface-2/60" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input id="mobile" type="tel" inputMode="numeric" autoComplete="tel" placeholder="9999999999" value={mobile} onChange={(e) => setMobile(e.target.value)} disabled={busy || isLoading} className="h-11 rounded-xl bg-surface-2/60" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input id="pincode" inputMode="numeric" placeholder="600001" value={pincode} onChange={(e) => setPincode(e.target.value)} disabled={busy || isLoading} className="h-11 rounded-xl bg-surface-2/60" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="email">Email <span className="text-muted-foreground">(optional)</span></Label>
                  <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy || isLoading} className="h-11 rounded-xl bg-surface-2/60" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" autoComplete="new-password" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy || isLoading} className="h-11 rounded-xl bg-surface-2/60" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ref">Referral code <span className="text-muted-foreground">(optional)</span></Label>
                  <Input id="ref" placeholder="Referrer's mobile" value={referrerCode} onChange={(e) => setReferrerCode(e.target.value)} disabled={busy || isLoading} className="h-11 rounded-xl bg-surface-2/60" />
                </div>
                <GradientButton type="submit" size="lg" className="w-full sm:col-span-2" disabled={busy || isLoading}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4" /> Send OTP</>}
                </GradientButton>
              </form>
            ) : (
              <form onSubmit={verifyAndCreate} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="otp">6-digit code</Label>
                  <Input id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value)} disabled={busy || isLoading} className="h-12 rounded-xl bg-surface-2/60 text-center text-lg tracking-[0.4em]" />
                  {debugCode && <p className="text-xs text-amber-400">Dev mode — code is <span className="font-mono">{debugCode}</span></p>}
                </div>
                <GradientButton type="submit" size="lg" className="w-full" disabled={busy || isLoading}>
                  {busy || isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldCheck className="h-4 w-4" /> Verify & create</>}
                </GradientButton>
                <button type="button" onClick={() => setStep("form")} className="block w-full text-center text-xs text-muted-foreground hover:text-foreground">← Back to form</button>
              </form>
            )}
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Already have an account? <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link>
            </p>
          </LuxuryCard>
        </motion.div>
      </main>
    </GuestGuard>
  );
}
