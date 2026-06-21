"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { api, apiErrorMessage, fileUrl } from "@/lib/api";

/**
 * Single-file uploader that accepts an image OR a PDF — used for the
 * prescription attachment at checkout. Uploads to the given endpoint and
 * reports back the stored relative path (to send with the order) + its URL
 * (to preview). Images render as a thumbnail; PDFs as a labelled chip.
 */
export function FileUpload({
  label,
  path,
  url,
  onChange,
  endpoint = "/orders/prescription-upload",
  disabled,
}: {
  label: string;
  /** Current stored path (or null). */
  path: string | null;
  /** Current preview URL (or null). */
  url: string | null;
  /** Called with (path, url) after upload, or (null, null) when cleared. */
  onChange: (path: string | null, url: string | null) => void;
  endpoint?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const isPdf = (path ?? "").toLowerCase().endsWith(".pdf");

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post(endpoint, fd, {
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
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        disabled={disabled || busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      {path ? (
        isPdf ? (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/40 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{label} attached</p>
              {url && (
                <a href={url} target="_blank" rel="noreferrer" className="text-xs text-brand underline">
                  View PDF
                </a>
              )}
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(null, null)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10 text-foreground"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url ?? ""} alt={label} className="h-40 w-full object-contain bg-surface-2" />
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(null, null)}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2/40 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
          {busy ? "Uploading…" : "Tap to attach (photo or PDF)"}
        </button>
      )}
    </div>
  );
}
