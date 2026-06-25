"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Phone, ArrowLeft, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/custom/password-input";
import { Label } from "@/components/ui/label";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { api, apiErrorMessage } from "@/lib/api";

const cleanMobile = (v: string) => v.replace(/\D/g, "").slice(0, 10);

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[0-9]{10}$/.test(mobile)) { toast.error("Enter a valid 10-digit mobile number"); return; }
    setBusy(true);
    try {
      await api.post("/auth/forgot-password-otp", { mobile_number: mobile });
      toast.success("If an account exists, an OTP has been sent");
      setStep(2);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not send OTP"));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[0-9]{6}$/.test(otp)) { toast.error("Enter the 6-digit OTP"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    setBusy(true);
    try {
      await api.post("/auth/reset-password-otp", { mobile_number: mobile, otp, password });
      toast.success("Password reset successful. Please sign in.");
      router.push("/login");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not reset password"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full brand-gradient opacity-20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-brand-deep opacity-25 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-sm"
      >
        <LuxuryCard glow hoverLift={false} className="p-7">
          <div className="text-center">
            <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`} alt="SPRITHI Digital Mart" className="mx-auto mb-4 h-14 w-14 object-contain" />
            <h1 className="text-2xl font-semibold tracking-tight">Forgot password?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === 1
                ? "Enter your registered mobile number and we'll text you an OTP."
                : `Enter the OTP sent to ${mobile} and choose a new password.`}
            </p>
          </div>

          {step === 1 ? (
            <form onSubmit={sendOtp} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="mobile">Mobile number</Label>
                <Input
                  id="mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={mobile}
                  onChange={(e) => setMobile(cleanMobile(e.target.value))}
                  disabled={busy}
                  className="h-11 rounded-xl bg-surface-2/60"
                />
              </div>
              <GradientButton type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Phone className="h-4 w-4" /> Send OTP</>}
              </GradientButton>
            </form>
          ) : (
            <form onSubmit={resetPassword} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="otp">OTP</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={busy}
                  className="h-11 rounded-xl bg-surface-2/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
                <PasswordInput
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  maxLength={64}
                  placeholder="6-20 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  className="h-11 rounded-xl bg-surface-2/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <PasswordInput
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  maxLength={64}
                  placeholder="Re-enter password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={busy}
                  className="h-11 rounded-xl bg-surface-2/60"
                />
              </div>
              <GradientButton type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><KeyRound className="h-4 w-4" /> Reset password</>}
              </GradientButton>
              <button
                type="button"
                onClick={() => { setStep(1); setOtp(""); setPassword(""); setConfirm(""); }}
                disabled={busy}
                className="w-full text-center text-xs text-muted-foreground hover:text-brand"
              >
                Change number / resend OTP
              </button>
            </form>
          )}

          <p className="mt-5 text-center text-sm">
            <Link href="/login" className="inline-flex items-center gap-1 text-brand hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </Link>
          </p>
        </LuxuryCard>
      </motion.div>
    </main>
  );
}
