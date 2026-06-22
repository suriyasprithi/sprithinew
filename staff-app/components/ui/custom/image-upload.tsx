"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { api, apiErrorMessage, fileUrl } from "@/lib/api";

/**
 * Single-image uploader for KYC documents. Uploads to POST /customer/upload
 * (auth-gated — works for any signed-in user, including vendors) and reports
 * back the stored relative path (to save) + its URL (to preview).
 */
export function ImageUpload({
  label,
  url,
  onChange,
  disabled,
}: {
  label: string;
  /** Current preview URL (or null). */
  url: string | null;
  /** Called with (path, url) after upload, or (null, null) when cleared. */
  onChange: (path: string | null, url: string | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await api.post("/customer/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const d = res.data.data as { path: string; url: string };
      onChange(d.path, fileUrl(d.path));
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        disabled={disabled || busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      {url ? (
        <div className="relative overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="h-36 w-full object-cover" />
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(null, null)}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
              aria-label="Remove image"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2/40 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          {busy ? "Uploading…" : "Tap to upload"}
        </button>
      )}
    </div>
  );
}
