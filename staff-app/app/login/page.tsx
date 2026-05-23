"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GuestGuard } from "@/components/auth-guard";
import { useAuth } from "@/stores/auth";
import { apiErrorMessage, STAFF_ROLES, StaffRole } from "@/lib/api";

// Each build is deployed at a per-role basePath (/admin, /state, /district,
// /taluk, /vendor). When that basePath matches a known role, lock the role
// dropdown so the URL alone determines who can sign in here. Capacitor builds
// have an empty basePath and fall back to the manual dropdown.
const ROLE_FROM_BASE_PATH: Record<string, StaffRole> = {
  "/admin":    "admin",
  "/state":    "state",
  "/district": "district",
  "/taluk":    "taluk",
  "/vendor":   "vendor",
  "/driver":   "driver",
};

const ROLE_LABEL: Record<StaffRole, string> = {
  admin:    "Admin",
  state:    "State",
  district: "District",
  taluk:    "Taluk",
  vendor:   "Vendor",
  driver:   "Driver",
};

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();

  // Role inferred from the deployed basePath (e.g. /vendor → vendor).
  // Inlined by Next at build time via process.env.NEXT_PUBLIC_BASE_PATH.
  const lockedRole = ROLE_FROM_BASE_PATH[process.env.NEXT_PUBLIC_BASE_PATH ?? ""] ?? null;

  const [role, setRole] = useState<StaffRole | "">(lockedRole ?? "");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const effectiveRole = lockedRole ?? role;
    if (!effectiveRole) return toast.error("Select your role");
    if (!mobile || !password) return toast.error("Enter mobile and password");
    try {
      await login(mobile.trim(), password, effectiveRole);
      toast.success("Welcome");
      router.replace("/dashboard");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Login failed"));
    }
  };

  const headerTitle    = lockedRole ? `${ROLE_LABEL[lockedRole]} sign in` : "Staff sign in";
  const headerSubtitle = lockedRole
    ? `Use the credentials for your ${ROLE_LABEL[lockedRole].toLowerCase()} account.`
    : "Select your role and sign in";

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
            <CardTitle className="text-2xl">{headerTitle}</CardTitle>
            <p className="text-sm text-muted-foreground">{headerSubtitle}</p>
            {lockedRole && (
              <p className="pt-1">
                <span className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-brand">
                  {ROLE_LABEL[lockedRole]}
                </span>
              </p>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              {!lockedRole && (
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as StaffRole)} disabled={isLoading}>
                    <SelectTrigger id="role" className="w-full">
                      <SelectValue placeholder="Choose role" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile number</Label>
                <Input
                  id="mobile"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="9999999999"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
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
                {isLoading ? "Signing in..." : `Sign in${lockedRole ? ` as ${ROLE_LABEL[lockedRole]}` : ""}`}
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
