"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/custom/password-input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { GuestGuard } from "@/components/auth-guard";
import { useAuth } from "@/stores/auth";
import { api, apiErrorMessage, StaffRole, STAFF_ROLES } from "@/lib/api";
import { cleanMobile, isMobile } from "@/lib/phone";

// After login, redirect to the role-specific deployment so the existing
// per-role build serves the dashboard. Same-origin localStorage carries tokens.
const ROLE_HOME: Record<StaffRole, string> = {
  admin:    "/admin/dashboard/",
  state:    "/state/dashboard/",
  district: "/district/dashboard/",
  taluk:    "/taluk/dashboard/",
  vendor:   "/vendor/dashboard/",
  driver:   "/driver/dashboard/",
};

export default function LoginPage() {
  const { login, isLoading } = useAuth();

  const [role, setRole] = useState<StaffRole | "">("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");

  // Forgot-password dialog state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!role) return toast.error("Select your role");
    if (!isMobile(mobile)) return toast.error("Enter a valid 10-digit mobile number");
    if (!password) return toast.error("Enter your password");
    try {
      const user = await login(mobile.trim(), password, role);
      toast.success("Welcome");
      const dest = ROLE_HOME[user.role as StaffRole] ?? "/dashboard/";
      window.location.href = dest;
    } catch (err) {
      toast.error(apiErrorMessage(err, "Login failed"));
    }
  };

  async function sendForgot() {
    if (!forgotEmail) return toast.error("Enter your email");
    setForgotSending(true);
    try {
      const res = await api.post("/auth/forgot-password", { email: forgotEmail.trim() });
      toast.success(res.data?.message || "If that email exists, a reset link is on its way");
      setForgotOpen(false);
      setForgotEmail("");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not send reset email"));
    } finally {
      setForgotSending(false);
    }
  }

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
            <CardTitle className="text-2xl">Staff sign in</CardTitle>
            <p className="text-sm text-muted-foreground">Select your role, then enter mobile and password</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole | "")}
                  disabled={isLoading}
                  className={`h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm ${role === "" ? "text-muted-foreground" : ""}`}
                >
                  <option value="" disabled>Select role</option>
                  {STAFF_ROLES.filter((r) => r.value !== "admin").map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile number</Label>
                <Input
                  id="mobile"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="tel"
                  placeholder="9999999999"
                  value={mobile}
                  onChange={(e) => setMobile(cleanMobile(e.target.value))}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
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
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="text-brand hover:underline"
              >
                Forgot password?
              </button>
            </p>
          </CardContent>
        </Card>
      </main>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              Enter the email on your account. We&apos;ll send a reset link that expires in 1 hour.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              disabled={forgotSending}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForgotOpen(false)} disabled={forgotSending}>Cancel</Button>
            <Button
              onClick={() => void sendForgot()}
              disabled={forgotSending}
              className="bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {forgotSending ? "Sending..." : "Send reset link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GuestGuard>
  );
}
