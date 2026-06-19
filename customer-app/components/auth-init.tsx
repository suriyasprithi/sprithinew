"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/stores/auth";
import { hydrateStorage } from "@/lib/storage";
import { initReferralCapture } from "@/lib/referral";

export function AuthInit() {
  const hydrate = useAuth((s) => s.hydrate);
  const router = useRouter();
  useEffect(() => {
    (async () => {
      await hydrateStorage();
      // Capture any pending referral (URL / Install Referrer / App Link) before
      // hydrate. Best-effort — never blocks app start. An App Link tapped while
      // the app is running routes a guest to the registration screen.
      void initReferralCapture((code) => router.push(`/register?ref=${code}`));
      await hydrate();
    })();
  }, [hydrate, router]);
  return null;
}
