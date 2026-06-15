"use client";

import { useRef, useState } from "react";
import { Store, Upload, Loader2 } from "lucide-react";
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

  const current = fileUrl(user?.shop_image ?? null);

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
      toast.success("Shop image updated");
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
          description="A cover image shown to customers when they view your shop online."
        />
        <LuxuryCard className="space-y-4 p-5">
          <div className="flex aspect-[16/9] items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-2/40">
            {preview ? (
              <img src={preview} alt="preview" className="h-full w-full object-cover" />
            ) : current ? (
              <img src={current} alt="shop" className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Store className="h-10 w-10" />
                <p className="text-sm">No shop image yet</p>
              </div>
            )}
          </div>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => inputRef.current?.click()} disabled={saving}>
              <Upload className="h-4 w-4" /> {current || preview ? "Choose another" : "Choose image"}
            </Button>
            <GradientButton className="flex-1" onClick={() => void save()} disabled={saving || !file}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </GradientButton>
          </div>
          <p className="text-[11px] text-muted-foreground">JPG, PNG or WEBP · up to 5 MB · shown to customers on your shop page.</p>
        </LuxuryCard>
      </section>
    </>
  );
}
