"use client";

import { useRef, useState } from "react";
import { Store, Upload, Loader2, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/stores/auth";
import { api, apiErrorMessage, fileUrl, type AuthUser } from "@/lib/api";

export default function ShopImagePage() {
  const { user, setUser } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const approved = fileUrl(user?.shop_image ?? null);
  const pending  = fileUrl(user?.shop_image_pending ?? null);
  const status   = user?.shop_image_status ?? null;
  const reason   = user?.shop_image_reject_reason ?? null;

  // Show the just-picked file, else the pending (under review) image, else the
  // approved/live one, else nothing.
  const shown = preview ?? (status === "pending" ? pending : null) ?? approved;

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error("Image must be 5 MB or smaller"); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function save() {
    if (!file) { toast.error("Pick an image first"); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await api.post("/auth/me/shop-image", fd);
      setUser(res.data.data as AuthUser);
      setFile(null);
      setPreview(null);
      toast.success("Submitted for admin approval");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Upload failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <MobileHeader title="Shop image" />
      <section className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
        <PageHeader
          eyebrow="Shop"
          icon={Store}
          title="Shop image"
          description="A cover image shown to customers when they view your shop online. New images go live only after admin approval."
        />
        <LuxuryCard className="space-y-4 p-5">
          <div className="flex aspect-[16/9] items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-2/40">
            {shown ? (
              <img src={shown} alt="shop" className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Store className="h-10 w-10" />
                <p className="text-sm">No shop image yet</p>
              </div>
            )}
          </div>

          {/* Approval status (only when not previewing a fresh pick) */}
          {!preview && status === "pending" && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-500">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-xs">Pending admin approval. {approved ? "Customers still see your last approved image until this is approved." : "It will show to customers once approved."}</p>
            </div>
          )}
          {!preview && status === "rejected" && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-rose-500">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-xs"><span className="font-semibold">Rejected:</span> {reason || "Please upload a different image."} Upload a new image to try again.</p>
            </div>
          )}
          {!preview && status === "approved" && approved && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-500">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <p className="text-xs">Approved and live for customers.</p>
            </div>
          )}

          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => inputRef.current?.click()} disabled={saving}>
              <Upload className="h-4 w-4" /> {shown || preview ? "Choose another" : "Choose image"}
            </Button>
            <GradientButton className="flex-1" onClick={() => void save()} disabled={saving || !file}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit for approval"}
            </GradientButton>
          </div>
          <p className="text-[11px] text-muted-foreground">JPG, PNG or WEBP · up to 5 MB · shown to customers after admin approval.</p>
        </LuxuryCard>
      </section>
    </>
  );
}
