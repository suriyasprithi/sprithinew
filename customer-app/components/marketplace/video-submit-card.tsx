"use client";

import { useEffect, useRef, useState } from "react";
import { Video, Upload, Loader2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { api, apiErrorMessage } from "@/lib/api";

const MAX_MB = 100;

type Status = "pending" | "active" | "inactive" | "rejected";

const STATUS_PILL: Record<Status, { label: string; cls: string; icon: typeof Clock }> = {
  pending:  { label: "Pending review", cls: "bg-amber-100 text-amber-700",     icon: Clock },
  active:   { label: "Approved · live", cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  inactive: { label: "Hidden",          cls: "bg-gray-100 text-gray-600",       icon: XCircle },
  rejected: { label: "Not approved",    cls: "bg-rose-100 text-rose-700",       icon: XCircle },
};

/**
 * Customer-submitted promo/testimonial video. Uploads the file, then creates a
 * pending customer_videos row for admin approval. Once approved it shows on the
 * home "Customer videos" carousel. Mirrors the vendor ad-video-request flow.
 */
export function VideoSubmitCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Status | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get("/customer/videos/mine");
        const items = (res.data.data?.items ?? []) as { status: Status }[];
        if (items.length) setLast(items[0].status);
      } catch { /* non-blocking */ }
    })();
  }, []);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) { toast.error(`Video must be ${MAX_MB} MB or smaller`); return; }
    setFile(f);
  }

  async function submit() {
    if (!file) { toast.error("Choose a video first"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // The api instance defaults to application/json — must force multipart so
      // the browser sets the boundary, else PHP sees no file. Bigger timeout for
      // the (up to 100 MB) video.
      const up = await api.post("/customer/videos/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      const path = up.data.data?.path as string;
      await api.post("/customer/videos", { video_path: path, title: caption.trim() || undefined });
      toast.success("Video sent to admin for approval");
      setFile(null);
      setCaption("");
      setLast("pending");
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      // PHP rejects an over-limit POST before our API runs: comes back as 413, or
      // a non-JSON body (a PHP warning) that can't be parsed. Either way it's a
      // size problem — show a clear toast, not a raw error.
      const err = e as { response?: { status?: number; data?: unknown } };
      const data = err?.response?.data;
      const tooLarge = err?.response?.status === 413
        || (typeof data === "string" && /content-length|post_max|exceed|too large/i.test(data));
      toast.error(tooLarge
        ? `That video is too large to upload. Try a smaller file (under ${MAX_MB} MB).`
        : apiErrorMessage(e, "Could not send video"));
    } finally {
      setBusy(false);
    }
  }

  const pill = last ? STATUS_PILL[last] : null;

  return (
    <LuxuryCard hoverLift={false} className="space-y-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fee2e2] text-[#b91c1c]"><Video className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#111827]">Share a video with us</p>
            <p className="text-xs text-[#6b7280]">Sent to admin — shown on the home page once approved.</p>
          </div>
        </div>
        {pill && (
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill.cls}`}>
            <pill.icon className="h-3 w-3" /> {pill.label}
          </span>
        )}
      </div>

      <input ref={inputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={pick} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex w-full items-center gap-2 truncate rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2.5 text-left text-sm text-[#374151] hover:border-brand/40"
      >
        <Upload className="h-4 w-4 shrink-0 text-[#6b7280]" />
        <span className="truncate">{file ? file.name : "Choose video (MP4 / WEBM · up to 100 MB)"}</span>
      </button>
      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Caption (optional)"
        className="w-full rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2.5 text-sm outline-none focus-visible:border-brand/50"
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy || !file}
        className="flex w-full items-center justify-center gap-2 rounded-xl brand-gradient px-3 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-95 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send video"}
      </button>
    </LuxuryCard>
  );
}
