import Link from "next/link";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";

export default function ComingSoonPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <LuxuryCard hoverLift={false} className="w-full max-w-sm p-8 text-center">
        <p className="text-5xl">🚧</p>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Coming soon</h1>
        <p className="mt-1 text-sm text-muted-foreground">We&apos;re polishing this feature. Check back later.</p>
        <Link href="/dashboard" className="mt-5 inline-block w-full">
          <GradientButton size="lg" className="w-full">Back to dashboard</GradientButton>
        </Link>
      </LuxuryCard>
    </main>
  );
}
