"use client";

import { useRef, useState } from "react";
import { Camera, FileText, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
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
  const cameraRef = useRef<HTMLInputElement>(null);
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
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  // "Take Photo": inside the APK the WebView ignores the file input's `capture`
  // attribute and opens the gallery, so on native we open the real device
  // camera via @capacitor/camera and feed the shot into the same upload path.
  // On web the file input (with capture) already opens the camera fine.
  async function takePhoto() {
    if (!Capacitor.isNativePlatform()) {
      cameraRef.current?.click();
      return;
    }
    try {
      const { Camera: CapCamera, CameraResultType, CameraSource } = await import("@capacitor/camera");
      const photo = await CapCamera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Uri,
        quality: 80,
      });
      if (!photo.webPath) return;
      const blob = await (await fetch(photo.webPath)).blob();
      const ext = photo.format || "jpeg";
      const file = new File([blob], `prescription.${ext}`, { type: blob.type || `image/${ext}` });
      void handleFile(file);
    } catch {
      // User cancelled the camera, or it's unavailable — stay silent.
    }
  }

  return (
    <div className="space-y-1.5">
      {/* Files: photo or PDF from the device (gallery / file manager). */}
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
      {/* Camera: `capture` opens the camera directly inside the APK WebView
          (the WebView doesn't add a camera option to the plain file picker
          the way a mobile browser does). */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
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
      ) : busy ? (
        <div className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2/40 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Uploading…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => void takePhoto()}
            className="flex h-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2/40 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"
          >
            <Camera className="h-5 w-5" />
            Take Photo
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="flex h-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-2/40 text-sm text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-50"
          >
            <Paperclip className="h-5 w-5" />
            Photo / PDF
          </button>
        </div>
      )}
    </div>
  );
}
