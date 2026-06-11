"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { GuestGuard } from "@/components/auth-guard";
import { useAuth } from "@/stores/auth";
import { apiErrorMessage } from "@/lib/api";
import { cleanMobile, isMobile } from "@/lib/phone";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMobile(mobile)) { toast.error("Enter a valid 10-digit mobile number"); return; }
    if (!password) { toast.error("Enter your password"); return; }
    try {
      await login(mobile.trim(), password);
      toast.success("Welcome back");
      router.replace("/home");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Login failed"));
    }
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
          className="relative w-full max-w-sm"
        >
          <LuxuryCard glow hoverLift={false} className="p-7">
            <div className="text-center">
              <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`} alt="SPRITHI Digital Mart" className="mx-auto mb-4 h-14 w-14 object-contain" />
              <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
              <p className="mt-1 text-sm text-muted-foreground">Sign in to your SPRITHI Digital Mart account</p>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="mobile">Mobile number</Label>
                <Input
                  id="mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="9999999999"
                  value={mobile}
                  onChange={(e) => setMobile(cleanMobile(e.target.value))}
                  disabled={isLoading}
                  className="h-11 rounded-xl bg-surface-2/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="h-11 rounded-xl bg-surface-2/60"
                />
              </div>
              <GradientButton type="submit" size="lg" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4" /> Sign in</>}
              </GradientButton>
            </form>

            <p className="mt-5 text-center text-sm">
              <Link href="/forgot-password" className="text-brand hover:underline">Forgot password?</Link>
            </p>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              No account? <Link href="/register" className="font-medium text-brand hover:underline">Create one</Link>
            </p>
          </LuxuryCard>
        </motion.div>
      </main>
    </GuestGuard>
  );
}
