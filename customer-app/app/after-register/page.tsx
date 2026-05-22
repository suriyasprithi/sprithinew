"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, User } from "lucide-react";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { useAuth } from "@/stores/auth";

export default function AfterRegisterPage() {
  const { user } = useAuth();
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full brand-gradient opacity-20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-brand-deep opacity-25 blur-3xl" />
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        <LuxuryCard glow hoverLift={false} className="p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl brand-gradient brand-glow">
            <CheckCircle2 className="h-8 w-8 text-brand-foreground" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Welcome{user ? `, ${user.name}` : ""}!</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your SPRITHI Digital Mart account is ready. Add money to your wallet, browse vendors, and start earning.</p>
          <div className="mt-6 space-y-2">
            <Link href="/dashboard"><GradientButton size="lg" className="w-full">Go to dashboard <ArrowRight className="h-4 w-4" /></GradientButton></Link>
            <Link href="/profile" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-2/40 text-sm font-medium hover:border-brand/40 hover:bg-surface-2">
              <User className="h-4 w-4" /> Complete profile
            </Link>
          </div>
        </LuxuryCard>
      </motion.div>
    </main>
  );
}
