"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Loader2, Image as ImageIcon, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import { StatusBadge } from "@/components/data-table/status-badge";
import { EmptyState } from "@/components/data-table/empty-state";
import { MobileHeader } from "@/components/layout/mobile-nav";
import { PageHeader } from "@/components/layout/page-header";
import { api, apiErrorMessage, fileUrl } from "@/lib/api";

type AdType = "banner" | "video";
type Req = {
  id: number;
  type: string;
  attachment: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

const CFG = {
  banner: { icon: ImageIcon, accept: "image/jpeg,image/png,image/webp", maxMB: 5,  hint: "JPG, PNG or WEBP · up to 5 MB",  title: "Ad banner request", desc: "Upload a banner image for an ad and submit it for admin review." },
  video:  { icon: Video,     accept: "video/mp4,video/webm",            maxMB: 250, hint: "MP4 or WEBM · up to 250 MB",    title: "Ad video request",  desc: "Upload a promo video for an ad and submit it for admin review." },
} as const;

export function AdRequestForm({ type }: { type: AdType }) {
  const cfg = CFG[type];
  const Icon = cfg.icon;
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const res = await api.get("/ads/requests/mine", { params: { type } });
      setRows((res.data.data?.items ?? []) as Req[]);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [type]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > cfg.maxMB * 1024 * 1024) { toast.error(`File must be ${cfg.maxMB} MB or smaller`); return; }
    setFile(f);
  }

  async function submit() {
    if (!file) { toast.error("Choose a file first"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", type);
      // Video/banner uploads can be large (up to 250 MB) and slow on mobile —
      // the api default 15s timeout aborts them. Disable the cap for this upload
      // and force multipart so the browser sets the boundary.
      const up = await api.post("/ads/requests/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 0,
      });
      const path = up.data.data?.path as string;
      await api.post("/ads/requests", { type, attachment: path, notes: notes.trim() || undefined });
      toast.success("Request submitted");
      setFile(null);
      setNotes("");
      if (inputRef.current) inputRef.current.value = "";
      void refresh();
    } catch (e) {
      // An over-limit upload is rejected by PHP before our API runs: it comes
      // back as 413, or as a non-JSON body (a PHP warning) that can't be parsed.
      // Either way it's a size problem — show a clear toast, not a raw error.
      const err = e as { response?: { status?: number; data?: unknown } };
      const status = err?.response?.status;
      const data = err?.response?.data;
      const tooLarge = status === 413
        || (typeof data === "string" && /content-length|post_max|exceed|too large/i.test(data));
      if (tooLarge) {
        toast.error(`That ${type} is too large to upload. Try a smaller file (under ${cfg.maxMB} MB).`);
      } else {
        toast.error(apiErrorMessage(e, "Submit failed"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <MobileHeader title={cfg.title} />
      <section className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
        <PageHeader eyebrow="Ads" icon={Icon} title={cfg.title} description={cfg.desc} />

        <LuxuryCard className="space-y-3 p-5">
          <input ref={inputRef} type="file" accept={cfg.accept} className="hidden" onChange={pick} />
          <Button variant="outline" className="w-full justify-start truncate" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Upload className="h-4 w-4" /> {file ? file.name : `Choose ${type}`}
          </Button>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes for the admin (optional)" rows={3} />
          <GradientButton className="w-full" onClick={() => void submit()} disabled={busy || !file}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit request"}
          </GradientButton>
          <p className="text-[11px] text-muted-foreground">{cfg.hint} · reviewed by admin.</p>
        </LuxuryCard>

        <div>
          <p className="mb-2 text-sm font-semibold">My requests</p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <EmptyState icon={Icon} title="No requests yet" />
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <LuxuryCard key={r.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {type === "banner" && r.attachment && (
                      <img src={fileUrl(r.attachment) ?? ""} alt="" className="h-10 w-16 shrink-0 rounded object-cover" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm">{r.notes || cfg.title}</p>
                      <p className="text-xs text-muted-foreground">{r.created_at}</p>
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </LuxuryCard>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
