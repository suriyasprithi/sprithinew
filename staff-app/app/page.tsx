"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/stores/auth";
import { StaffLoginForm } from "@/components/staff-login-form";

// Unified staff login builds (basePath /staff or /staff-roll) render the
// login form at the root URL instead of redirecting to /login.
const UNIFIED_STAFF_BUILDS = ["/staff", "/staff-roll"];
const IS_STAFF_BUILD = UNIFIED_STAFF_BUILDS.includes(process.env.NEXT_PUBLIC_BASE_PATH ?? "");

export default function Home() {
  const router = useRouter();
  const { user, isHydrated } = useAuth();

  useEffect(() => {
    if (IS_STAFF_BUILD) return;
    if (!isHydrated) return;
    if (user) router.replace("/dashboard");
    else window.location.href = "/admin/login/";
  }, [user, isHydrated, router]);

  if (IS_STAFF_BUILD) return <StaffLoginForm />;

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Loading...
    </div>
  );
}
