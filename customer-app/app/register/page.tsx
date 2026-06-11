"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { GuestGuard } from "@/components/auth-guard";
import { useAuth } from "@/stores/auth";
import { api, apiErrorMessage } from "@/lib/api";
import { cleanMobile, isMobile } from "@/lib/phone";

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
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pincode, setPincode] = useState("");
  const [referrerCode, setReferrerCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ref = sp?.get("ref");
    if (ref) setReferrerCode(cleanMobile(ref));
  }, [sp]);

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return toast.error("Name is required");
    if (!isMobile(mobile)) return toast.error("Enter a valid 10-digit mobile number");
    if (!password) return toast.error("Password is required");
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (referrerCode && !isMobile(referrerCode)) return toast.error("Referrer mobile must be 10 digits");
    setBusy(true);
    try {
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
      router.replace("/home");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Registration failed"));
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
              <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
              <p className="mt-1 text-sm text-muted-foreground">Join SPRITHI Digital Mart today</p>
            </div>

            <form onSubmit={register} className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" autoComplete="name" placeholder="Ramesh Kumar" value={name} onChange={(e) => setName(e.target.value)} disabled={busy || isLoading} className="h-11 rounded-xl bg-surface-2/60" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mobile">Mobile</Label>
                <Input id="mobile" type="tel" inputMode="numeric" autoComplete="tel" placeholder="9999999999" value={mobile} onChange={(e) => setMobile(cleanMobile(e.target.value))} disabled={busy || isLoading} className="h-11 rounded-xl bg-surface-2/60" />
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
                <Input id="ref" inputMode="numeric" placeholder="Referrer's mobile" value={referrerCode} onChange={(e) => setReferrerCode(cleanMobile(e.target.value))} disabled={busy || isLoading} className="h-11 rounded-xl bg-surface-2/60" />
              </div>
              <GradientButton type="submit" size="lg" className="w-full sm:col-span-2" disabled={busy || isLoading}>
                {busy || isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4" /> Create account</>}
              </GradientButton>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              Already have an account? <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link>
            </p>
          </LuxuryCard>
        </motion.div>
      </main>
    </GuestGuard>
  );
}
