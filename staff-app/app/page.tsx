"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/stores/auth";
import { StaffLoginForm } from "@/components/staff-login-form";
import { goToLogin } from "@/lib/login-redirect";

// Unified staff login builds (basePath /staff or /staff-roll) render the
// login form at the root URL instead of redirecting to /login.
const UNIFIED_STAFF_BUILDS = ["/staff", "/staff-roll"];
const IS_STAFF_BUILD = UNIFIED_STAFF_BUILDS.includes(process.env.NEXT_PUBLIC_BASE_PATH ?? "");
// The admin APK opens to the login form at the root too — redirecting to /control
// inside the Capacitor webview is unreliable, so render the form inline instead.
const IS_ADMIN_APK = (process.env.NEXT_PUBLIC_ADMIN_BUILD ?? "") === "1";
const SHOW_FORM_AT_ROOT = IS_STAFF_BUILD || IS_ADMIN_APK;

export default function Home() {
  const router = useRouter();
  const { user, isHydrated } = useAuth();

  useEffect(() => {
    if (SHOW_FORM_AT_ROOT) return;
    if (!isHydrated) return;
    if (user) router.replace("/dashboard");
    else goToLogin(router);
  }, [user, isHydrated, router]);

  if (SHOW_FORM_AT_ROOT) return <StaffLoginForm />;

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Loading...
    </div>
  );
}
