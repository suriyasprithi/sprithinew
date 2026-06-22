"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { api, apiErrorMessage } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/.+@.+\..+/.test(email)) { toast.error("Enter a valid email"); return; }
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setSent(true);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not send reset link"));
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
              Enter the email on your account and we&apos;ll send a reset link.
            </p>
          </div>

          {sent ? (
            <div className="mt-6 space-y-4 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <p className="text-sm text-muted-foreground">
                If an account with that email exists, a reset link has been sent. Check your inbox (and spam folder) — the link expires in 1 hour.
              </p>
              <Link href="/login" className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-brand hover:underline">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                    className="h-11 rounded-xl bg-surface-2/60"
                  />
                </div>
                <GradientButton type="submit" size="lg" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="h-4 w-4" /> Send reset link</>}
                </GradientButton>
              </form>

              <p className="mt-5 text-center text-sm">
                <Link href="/login" className="inline-flex items-center gap-1 text-brand hover:underline">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
                </Link>
              </p>
            </>
          )}
        </LuxuryCard>
      </motion.div>
    </main>
  );
}
