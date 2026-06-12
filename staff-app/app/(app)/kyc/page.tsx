"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { EmptyState } from "@/components/data-table/empty-state";
import { TableSkeleton } from "@/components/data-table/table-skeleton";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage } from "@/lib/api";

type KycRow = {
  id: number;
  name: string;
  mobile_number: string;
  aadhar: string | null;
  aadhar_image_url: string | null;
  pan: string | null;
  pan_image_url: string | null;
  account_holder: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  bank_name: string | null;
  upi: string | null;
};

function DocField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function DocImage({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="h-32 w-full rounded-lg border border-border object-cover transition hover:opacity-90" />
        </a>
      ) : (
        <div className="flex h-32 w-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
          No image
        </div>
      )}
    </div>
  );
}

export default function KycReviewPage() {
  const [rows, setRows] = useState<KycRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<KycRow | null>(null);
  const [note, setNote] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/admin/kyc/pending");
      setRows((res.data.data?.items ?? []) as KycRow[]);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not load KYC requests"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function verify(r: KycRow) {
    setBusyId(r.id);
    try {
      await api.post(`/admin/kyc/${r.id}/verify`);
      toast.success(`${r.name} verified`);
      setRows((cur) => cur.filter((x) => x.id !== r.id));
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  async function reject() {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      await api.post(`/admin/kyc/${rejecting.id}/reject`, { note });
      toast.success(`${rejecting.name} rejected`);
      setRows((cur) => cur.filter((x) => x.id !== rejecting.id));
      setRejecting(null);
      setNote("");
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <MobileHeader title="KYC Review" />
      <section className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Compliance"
          icon={ShieldCheck}
          title="KYC Review"
          description="Verify each customer's Aadhaar, PAN and bank details before they can withdraw."
        />

        {loading ? (
          <div className="luxe-card p-3"><TableSkeleton rows={3} cols={1} /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No pending KYC" description="New submissions awaiting verification will appear here." />
        ) : (
          <div className="space-y-4">
            {rows.map((r) => (
              <div key={r.id} className="luxe-card space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{r.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{r.mobile_number}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setRejecting(r); setNote(""); }} disabled={busyId === r.id}>
                      <X className="h-4 w-4" /> Reject
                    </Button>
                    <GradientButton onClick={() => void verify(r)} disabled={busyId === r.id}>
                      {busyId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Verify</>}
                    </GradientButton>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <DocImage label="Aadhaar image" url={r.aadhar_image_url} />
                  <DocImage label="PAN image" url={r.pan_image_url} />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <DocField label="Aadhaar no." value={r.aadhar} />
                  <DocField label="PAN no." value={r.pan} />
                  <DocField label="Account holder" value={r.account_holder} />
                  <DocField label="Account number" value={r.account_number} />
                  <DocField label="IFSC" value={r.ifsc_code} />
                  <DocField label="Bank" value={r.bank_name} />
                  <DocField label="UPI" value={r.upi} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="rounded-2xl border-border bg-popover">
          <DialogHeader>
            <DialogTitle>Reject KYC</DialogTitle>
            <DialogDescription>Tell {rejecting?.name} what to fix — they&apos;ll be asked to re-submit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Aadhaar image is blurry" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(null)} disabled={busyId === rejecting?.id}>Cancel</Button>
            <GradientButton onClick={() => void reject()} disabled={busyId === rejecting?.id}>
              {busyId === rejecting?.id ? "Rejecting…" : "Reject KYC"}
            </GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
