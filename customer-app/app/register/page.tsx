"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { GuestGuard } from "@/components/auth-guard";
import { useAuth } from "@/stores/auth";
import { api, apiErrorMessage } from "@/lib/api";
import { cleanMobile, isMobile } from "@/lib/phone";
import { saveLocation } from "@/components/marketplace/location-picker";

type GeoState    = { id: number; name: string };
type GeoDistrict = { id: number; state_id: number; name: string };
type GeoTaluk    = { id: number; district_id: number; name: string };

// Whole years between a YYYY-MM-DD date and today.
function ageFrom(dob: string): number {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return -1;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

// Latest DOB allowed for an 18-year-old (used as the date input's max).
function maxDobForAdult(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

const selectClass =
  "h-11 w-full appearance-none rounded-xl bg-surface-2/60 border border-input px-3 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";
const selectStyle: React.CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.75rem center",
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>}>
      <RegisterInner />
    </Suspense>
  );
}

function RegisterInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { hydrate, isLoading } = useAuth();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pincode, setPincode] = useState("");
  const [dob, setDob] = useState("");
  const [referrerCode, setReferrerCode] = useState("");
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [refChecking, setRefChecking] = useState(false);
  const [mobileTaken, setMobileTaken] = useState<boolean | null>(null);
  const [mobileChecking, setMobileChecking] = useState(false);
  const [busy, setBusy] = useState(false);

  const [states, setStates] = useState<GeoState[]>([]);
  const [districts, setDistricts] = useState<GeoDistrict[]>([]);
  const [taluks, setTaluks] = useState<GeoTaluk[]>([]);
  const [stateId, setStateId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [talukId, setTalukId] = useState<number | null>(null);

  useEffect(() => {
    const ref = sp?.get("ref");
    if (ref) setReferrerCode(cleanMobile(ref));
  }, [sp]);

  // Resolve the referral code (= referrer's mobile) to a name, so the customer
  // sees who invited them. Debounced; clears when the code isn't 10 digits.
  useEffect(() => {
    if (!isMobile(referrerCode)) { setReferrerName(null); setRefChecking(false); return; }
    let cancelled = false;
    setRefChecking(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await api.get(`/public/referrer/${referrerCode}`);
          if (!cancelled) setReferrerName((r.data.data?.name ?? null) as string | null);
        } catch { if (!cancelled) setReferrerName(null); }
        finally { if (!cancelled) setRefChecking(false); }
      })();
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [referrerCode]);

  // Flag a mobile that's already a customer, before the form is submitted.
  // Debounced; resets when the number isn't a full 10 digits. Network errors
  // are ignored — register() still rejects duplicates with a 409 on submit.
  useEffect(() => {
    if (!isMobile(mobile)) { setMobileTaken(null); setMobileChecking(false); return; }
    let cancelled = false;
    setMobileChecking(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await api.get("/auth/check-mobile", { params: { mobile } });
          if (!cancelled) setMobileTaken(!(r.data?.data?.available ?? true));
        } catch { if (!cancelled) setMobileTaken(null); }
        finally { if (!cancelled) setMobileChecking(false); }
      })();
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [mobile]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await api.get("/public/locations");
        if (cancelled) return;
        setStates(r.data?.data?.states ?? []);
        setDistricts(r.data?.data?.districts ?? []);
        setTaluks(r.data?.data?.taluks ?? []);
      } catch {
        if (!cancelled) toast.error("Could not load locations");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const districtsForState = useMemo(
    () => (stateId == null ? [] : districts.filter((d) => d.state_id === stateId)),
    [districts, stateId],
  );
  const taluksForDistrict = useMemo(
    () => (districtId == null ? [] : taluks.filter((t) => t.district_id === districtId)),
    [taluks, districtId],
  );

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return toast.error("Name is required");
    if (!isMobile(mobile)) return toast.error("Enter a valid 10-digit mobile number");
    if (mobileTaken) return toast.error("This mobile is already registered. Please log in.");
    if (!dob) return toast.error("Date of birth is required");
    if (ageFrom(dob) < 18) return toast.error("You must be at least 18 to register");
    if (stateId == null) return toast.error("Select your state");
    if (districtId == null) return toast.error("Select your district");
    if (!password) return toast.error("Password is required");
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirmPassword) return toast.error("Passwords do not match");
    if (referrerCode && !isMobile(referrerCode)) return toast.error("Referrer mobile must be 10 digits");
    setBusy(true);
    try {
      const res = await api.post("/auth/register", {
        name: name.trim(),
        mobile_number: mobile.trim(),
        password,
        email: email.trim() || undefined,
        pincode: pincode.trim() || undefined,
        dob,
        state_id: stateId,
        district_id: districtId,
        taluk_id: talukId ?? undefined,
        referrer_code: referrerCode.trim() || undefined,
      });
      const tokens = res.data.data;
      if (typeof window !== "undefined" && tokens?.access_token) {
        window.localStorage.setItem("epey.access_token", tokens.access_token);
        window.localStorage.setItem("epey.refresh_token", tokens.refresh_token);
      }
      await hydrate();
      // Carry the chosen location into the delivery-location picker so the
      // storefront opens pre-selected to where the customer registered.
      const stName = states.find((s) => s.id === stateId)?.name ?? "";
      const dName  = districts.find((d) => d.id === districtId)?.name ?? "";
      const tName  = talukId ? (taluks.find((t) => t.id === talukId)?.name ?? "") : "";
      saveLocation({
        state_id: stateId,
        district_id: districtId,
        taluk_id: talukId,
        label: [tName, dName, stName].filter(Boolean).join(", "),
      });
      toast.success("Account created");
      router.replace("/home");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Registration failed"));
    } finally { setBusy(false); }
  };

  return (
    <GuestGuard>
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full brand-gradient opacity-20 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-brand-deep opacity-25 blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative w-full max-w-md"
        >
          <LuxuryCard glow hoverLift={false} className="p-7">
            <div className="text-center">
              <img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/logo.png`} alt="SPRITHI Digital Mart" className="mx-auto mb-4 h-14 w-14 object-contain" />
              <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
              <p className="mt-1 text-sm text-muted-foreground">Join SPRITHI Digital Mart today</p>
            </div>

            <form onSubmit={register} className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" autoComplete="name" placeholder="Ramesh Kumar" value={name} onChange={(e) => setName(e.target.value)} disabled={busy || isLoading} className="h-11 rounded-xl bg-surface-2/60" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mobile">Mobile</Label>
                <Input id="mobile" type="tel" inputMode="numeric" autoComplete="tel" placeholder="9999999999" value={mobile} onChange={(e) => setMobile(cleanMobile(e.target.value))} disabled={busy || isLoading} className={`h-11 rounded-xl bg-surface-2/60 ${mobileTaken ? "border-rose-500" : ""}`} />
                {mobileChecking && <p className="text-[11px] text-muted-foreground">Checking…</p>}
                {mobileTaken === true && <p className="text-[11px] text-rose-500">This number is already registered. Please log in.</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pincode">Pincode</Label>
                <Input id="pincode" inputMode="numeric" placeholder="600001" value={pincode} onChange={(e) => setPincode(e.target.value)} disabled={busy || isLoading} className="h-11 rounded-xl bg-surface-2/60" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="dob">Date of birth</Label>
                <Input id="dob" type="date" max={maxDobForAdult()} value={dob} onChange={(e) => setDob(e.target.value)} disabled={busy || isLoading} className="h-11 rounded-xl bg-surface-2/60" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="state">State</Label>
                <select
                  id="state"
                  value={stateId ?? ""}
                  onChange={(e) => { const v = e.target.value ? Number(e.target.value) : null; setStateId(v); setDistrictId(null); setTalukId(null); }}
                  disabled={busy || isLoading || states.length === 0}
                  className={selectClass}
                  style={selectStyle}
                >
                  <option value="">{states.length === 0 ? "Loading…" : "Select your state"}</option>
                  {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="district">District</Label>
                <select
                  id="district"
                  value={districtId ?? ""}
                  onChange={(e) => { const v = e.target.value ? Number(e.target.value) : null; setDistrictId(v); setTalukId(null); }}
                  disabled={busy || isLoading || stateId == null}
                  className={selectClass}
                  style={selectStyle}
                >
                  <option value="">{stateId == null ? "Pick a state first" : (districtsForState.length === 0 ? "No districts" : "Select district")}</option>
                  {districtsForState.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="taluk">Taluk <span className="text-muted-foreground">(optional)</span></Label>
                <select
                  id="taluk"
                  value={talukId ?? ""}
                  onChange={(e) => setTalukId(e.target.value ? Number(e.target.value) : null)}
                  disabled={busy || isLoading || districtId == null}
                  className={selectClass}
                  style={selectStyle}
                >
                  <option value="">{districtId == null ? "Pick a district first" : (taluksForDistrict.length === 0 ? "No taluks" : "Any (district-wide)")}</option>
                  {taluksForDistrict.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="email">Email <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy || isLoading} className="h-11 rounded-xl bg-surface-2/60" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete="new-password" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy || isLoading} className="h-11 rounded-xl bg-surface-2/60" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input id="confirmPassword" type="password" autoComplete="new-password" placeholder="Re-enter password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={busy || isLoading} className="h-11 rounded-xl bg-surface-2/60" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ref">Referral code <span className="text-muted-foreground">(optional)</span></Label>
                <Input id="ref" inputMode="numeric" placeholder="Referrer's mobile" value={referrerCode} onChange={(e) => setReferrerCode(cleanMobile(e.target.value))} disabled={busy || isLoading} className="h-11 rounded-xl bg-surface-2/60" />
                {isMobile(referrerCode) && (
                  refChecking
                    ? <p className="text-xs text-muted-foreground">Checking…</p>
                    : referrerName
                      ? <p className="text-xs font-medium text-emerald-600">✓ Referred by {referrerName}</p>
                      : <p className="text-xs text-muted-foreground">No account found for this code</p>
                )}
              </div>
              <GradientButton type="submit" size="lg" className="w-full sm:col-span-2" disabled={busy || isLoading}>
                {busy || isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4" /> Create account</>}
              </GradientButton>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              Already have an account? <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link>
            </p>
          </LuxuryCard>
        </motion.div>
      </main>
    </GuestGuard>
  );
}
