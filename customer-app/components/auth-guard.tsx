"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/stores/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isHydrated } = useAuth();

  useEffect(() => {
    if (isHydrated && !user) router.replace("/login");
  }, [isHydrated, user, router]);

  if (!isHydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }
  return <>{children}</>;
}

// `redirectTo` is where an already-signed-in visitor is sent (default /home).
// Each page should pass the SAME target its own post-submit redirect uses, so the
// two don't race (the guard's effect fires the moment `user` is set on submit).
export function GuestGuard({ children, redirectTo = "/home" }: { children: React.ReactNode; redirectTo?: string }) {
  const router = useRouter();
  const { user, isHydrated } = useAuth();

  useEffect(() => {
    if (isHydrated && user) router.replace(redirectTo);
  }, [isHydrated, user, router, redirectTo]);

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }
  return <>{children}</>;
}
