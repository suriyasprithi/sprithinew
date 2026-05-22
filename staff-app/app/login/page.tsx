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

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const [role, setRole] = useState<StaffRole | "">("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return toast.error("Select your role");
    if (!mobile || !password) return toast.error("Enter mobile and password");
    try {
      await login(mobile.trim(), password, role);
      toast.success("Welcome");
      router.replace("/dashboard");
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
            <CardTitle className="text-2xl">Staff sign in</CardTitle>
            <p className="text-sm text-muted-foreground">Select your role and sign in</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
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
