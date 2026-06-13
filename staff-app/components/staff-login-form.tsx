"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GuestGuard } from "@/components/auth-guard";
import { useAuth } from "@/stores/auth";
import { apiErrorMessage, StaffRole, STAFF_ROLES } from "@/lib/api";
import { cleanMobile, isMobile } from "@/lib/phone";

// After /staff login, redirect to the role-specific deployment so the existing
// per-role build serves the dashboard. Same-origin localStorage carries tokens.
const ROLE_HOME: Record<StaffRole, string> = {
  admin:    "/admin/dashboard/",
  state:    "/state/dashboard/",
  district: "/district/dashboard/",
  taluk:    "/taluk/dashboard/",
  vendor:   "/vendor/dashboard/",
  driver:   "/driver/dashboard/",
};

// This deployment is built per-role (BASE_PATH = /admin, /state, …). When the
// role is known we log in role-specifically (/auth/login) — that matches by the
// unique (mobile, role) key, so it works even when several staff in different
// roles share a placeholder mobile like 0000000000. Only the unified build with
// no base path falls back to the mobile-only staff login.
const BASE_ROLE: StaffRole | null = (() => {
  const bp = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/^\/+|\/+$/g, "");
  if (STAFF_ROLES.some((r) => r.value === bp)) return bp as StaffRole;
  // Admin APK: basePath is empty, but it should sign in role-specifically as
  // admin (mobile + password), just like the web /admin/control/ build.
  if ((process.env.NEXT_PUBLIC_ADMIN_BUILD ?? "") === "1") return "admin" as StaffRole;
  return null;
})();

// Title reflects the build's role (admin build → "Admin sign in"); the unified
// build with no role falls back to the generic "Staff sign in".
const SIGN_IN_TITLE = BASE_ROLE
  ? `${BASE_ROLE.charAt(0).toUpperCase()}${BASE_ROLE.slice(1)} sign in`
  : "Staff sign in";

export function StaffLoginForm() {
  const { login, staffLogin, isLoading } = useAuth();

  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isMobile(mobile)) return toast.error("Enter a valid 10-digit mobile number");
    if (!password) return toast.error("Enter your password");
    try {
      const user = BASE_ROLE
        ? await login(mobile.trim(), password, BASE_ROLE)
        : await staffLogin(mobile.trim(), password);
      toast.success("Welcome");
      // Capacitor APK (no base path) serves every screen at the root, so go to
      // the in-app dashboard. Web per-role builds use the role-prefixed home.
      const isApk = (process.env.NEXT_PUBLIC_BASE_PATH ?? "") === "";
      const dest = isApk ? "/dashboard/" : (ROLE_HOME[user.role as StaffRole] ?? "/login/");
      window.location.href = dest;
    } catch (err) {
      toast.error(apiErrorMessage(err, "Login failed"));
    }
  };

  return (
    <GuestGuard>
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 to-white px-4 py-10">
        <Card className="w-full max-w-sm shadow-lg">
          <CardHeader className="space-y-1 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`}
              alt="SPRITHI Digital Mart"
              className="mx-auto mb-2 h-14 w-14 object-contain"
            />
            <CardTitle className="text-2xl">{SIGN_IN_TITLE}</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter your mobile and password
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              <a href="/forgot-password" className="text-brand hover:underline">Forgot password?</a>
            </p>
          </CardContent>
        </Card>
      </main>
    </GuestGuard>
  );
}
