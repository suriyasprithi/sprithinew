"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/custom/password-input";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { api, apiErrorMessage } from "@/lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp?.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { toast.error("This reset link is missing its token"); return; }
    if (!password || password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    setSaving(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      toast.success("Password updated. Sign in with your new password.");
      setTimeout(() => router.replace("/login"), 1200);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Reset failed — the link may have expired"));
    } finally {
      setSaving(false);
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
            <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {token ? "Choose a new password to sign in with." : "This reset link is missing a token. Request a new one from the login page."}
            </p>
          </div>

          {token && (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  placeholder="6-20 characters"
                  maxLength={20}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={saving}
                  className="h-11 rounded-xl bg-surface-2/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <PasswordInput
                  id="confirm"
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  maxLength={20}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={saving}
                  className="h-11 rounded-xl bg-surface-2/60"
                />
              </div>
              <GradientButton type="submit" size="lg" className="w-full" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldCheck className="h-4 w-4" /> Update password</>}
              </GradientButton>
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
