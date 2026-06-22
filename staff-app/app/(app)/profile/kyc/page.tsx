"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { ImageUpload } from "@/components/ui/custom/image-upload";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/stores/auth";
import { api, apiErrorMessage, fileUrl } from "@/lib/api";

type Kyc = {
  aadhar: string;
  aadhar_image: string | null;
  aadhar_image_url: string | null;
  pan: string;
  pan_image: string | null;
  pan_image_url: string | null;
  account_holder: string;
  account_number: string;
  ifsc_code: string;
  bank_name: string;
  upi: string;
  kyc_status: string;
  kyc_note: string | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  none:     { label: "Not submitted",  cls: "bg-muted text-muted-foreground" },
  pending:  { label: "Pending review", cls: "border border-amber-500/30 bg-amber-500/10 text-amber-500" },
  verified: { label: "Verified",       cls: "border border-emerald-500/30 bg-emerald-500/10 text-emerald-500" },
  rejected: { label: "Rejected",       cls: "border border-rose-500/30 bg-rose-500/10 text-rose-500" },
};

const EMPTY: Kyc = {
  aadhar: "", aadhar_image: null, aadhar_image_url: null,
  pan: "", pan_image: null, pan_image_url: null,
  account_holder: "", account_number: "", ifsc_code: "", bank_name: "", upi: "",
  kyc_status: "none", kyc_note: null,
};

export default function StaffKycPage() {
  const router = useRouter();
  const { hydrate } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [k, setK] = useState<Kyc>(EMPTY);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/customer/kyc");
        const d = res.data.data as Partial<Kyc>;
        setK({
          ...EMPTY,
          ...d,
          aadhar_image_url: fileUrl(d.aadhar_image ?? null),
          pan_image_url: fileUrl(d.pan_image ?? null),
          aadhar: d.aadhar ?? "",
          pan: d.pan ?? "",
          account_holder: d.account_holder ?? "",
          account_number: d.account_number ?? "",
          ifsc_code: d.ifsc_code ?? "",
          bank_name: d.bank_name ?? "",
          upi: d.upi ?? "",
          kyc_status: d.kyc_status ?? "none",
        });
      } catch (e) {
        toast.error(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (f: keyof Kyc, v: string) => setK((p) => ({ ...p, [f]: v }));
  const verified = k.kyc_status === "verified";
  const st = STATUS[k.kyc_status] ?? STATUS.none;

  async function submit() {
    if (!k.aadhar || !k.aadhar_image || !k.pan || !k.pan_image || !k.account_holder || !k.account_number || !k.ifsc_code) {
      toast.error("Fill all ID documents and bank details");
      return;
    }
    setBusy(true);
    try {
      await api.post("/customer/kyc", {
        aadhar: k.aadhar,
        aadhar_image: k.aadhar_image,
        pan: k.pan,
        pan_image: k.pan_image,
        account_holder: k.account_holder,
        account_number: k.account_number,
        ifsc_code: k.ifsc_code,
        bank_name: k.bank_name,
        upi: k.upi,
      });
      toast.success("KYC submitted for verification");
      await hydrate();
      router.push("/wallet");
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <MobileHeader title="KYC verification" />
      <section className="mx-auto max-w-2xl space-y-5 p-4 pb-24 md:p-8">
        <PageHeader
          eyebrow="Compliance"
          icon={ShieldCheck}
          title="KYC verification"
          description="Submit your Aadhaar, PAN and bank details. Once an admin verifies them, you can withdraw from your wallet."
        />

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <LuxuryCard hoverLift={false} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand" />
                <p className="text-sm font-semibold">Verification status</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${st.cls}`}>
                {st.label}
              </span>
            </LuxuryCard>

            {k.kyc_status === "rejected" && k.kyc_note && (
              <LuxuryCard hoverLift={false} className="border-rose-500/30 bg-rose-500/5 p-4">
                <p className="text-xs font-semibold text-rose-500">Reason for rejection</p>
                <p className="mt-1 text-sm">{k.kyc_note}</p>
              </LuxuryCard>
            )}

            {verified && (
              <LuxuryCard hoverLift={false} className="border-emerald-500/30 bg-emerald-500/5 p-4">
                <p className="text-sm text-emerald-600 dark:text-emerald-400">
                  Your documents are verified. You can withdraw from your wallet.
                </p>
              </LuxuryCard>
            )}

            <LuxuryCard hoverLift={false} className="space-y-4 p-5">
              <p className="text-sm font-semibold">Identity documents</p>
              <div className="space-y-1.5">
                <Label>Aadhaar number</Label>
                <Input value={k.aadhar} disabled={verified} onChange={(e) => set("aadhar", e.target.value)} placeholder="XXXX XXXX XXXX" className="h-11 rounded-xl bg-surface-2/60" />
              </div>
              <ImageUpload
                label="Aadhaar card image"
                url={k.aadhar_image_url}
                disabled={verified}
                onChange={(path, url) => setK((p) => ({ ...p, aadhar_image: path, aadhar_image_url: url }))}
              />
              <div className="space-y-1.5">
                <Label>PAN number</Label>
                <Input value={k.pan} disabled={verified} onChange={(e) => set("pan", e.target.value.toUpperCase())} placeholder="ABCDE1234F" className="h-11 rounded-xl bg-surface-2/60 font-mono uppercase" />
              </div>
              <ImageUpload
                label="PAN card image"
                url={k.pan_image_url}
                disabled={verified}
                onChange={(path, url) => setK((p) => ({ ...p, pan_image: path, pan_image_url: url }))}
              />
            </LuxuryCard>

            <LuxuryCard hoverLift={false} className="space-y-4 p-5">
              <p className="text-sm font-semibold">Bank account</p>
              <div className="space-y-1.5">
                <Label>Account holder name</Label>
                <Input value={k.account_holder} disabled={verified} onChange={(e) => set("account_holder", e.target.value)} className="h-11 rounded-xl bg-surface-2/60" />
              </div>
              <div className="space-y-1.5">
                <Label>Account number</Label>
                <Input value={k.account_number} disabled={verified} onChange={(e) => set("account_number", e.target.value)} className="h-11 rounded-xl bg-surface-2/60" />
              </div>
              <div className="space-y-1.5">
                <Label>IFSC</Label>
                <Input value={k.ifsc_code} disabled={verified} onChange={(e) => set("ifsc_code", e.target.value.toUpperCase())} className="h-11 rounded-xl bg-surface-2/60 font-mono uppercase" />
              </div>
              <div className="space-y-1.5">
                <Label>Bank name <span className="text-muted-foreground">(optional)</span></Label>
                <Input value={k.bank_name} disabled={verified} onChange={(e) => set("bank_name", e.target.value)} className="h-11 rounded-xl bg-surface-2/60" />
              </div>
              <div className="space-y-1.5">
                <Label>UPI ID <span className="text-muted-foreground">(optional)</span></Label>
                <Input value={k.upi} disabled={verified} onChange={(e) => set("upi", e.target.value)} placeholder="yourname@bank" className="h-11 rounded-xl bg-surface-2/60" />
              </div>
            </LuxuryCard>

            {!verified && (
              <GradientButton size="lg" className="w-full" disabled={busy} onClick={() => void submit()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit for verification"}
              </GradientButton>
            )}
          </>
        )}
      </section>
    </>
  );
}
