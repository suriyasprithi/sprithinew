"use client";

import { useEffect, useRef } from "react";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";
import jsQR from "jsqr";
import { cleanMobile, isMobile } from "@/lib/phone";

// Minimal type for the Web BarcodeDetector API (not in lib.dom yet).
type DetectedBarcode = { rawValue: string; format: string };
type BarcodeDetectorLike = { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

/**
 * Full-screen camera QR scanner. Resolves the first valid 10-digit mobile it
 * reads (vendor QR encodes the vendor's mobile). Native BarcodeDetector when
 * available, jsQR fallback for the Capacitor WebView / Safari / Firefox.
 */
export function QrScanModal({ open, onClose, onResult }: {
  open: boolean;
  onClose: () => void;
  onResult: (mobile: string) => void;
}) {
  const videoRef  = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef    = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Keep the latest callbacks without re-running the camera effect each render.
  const onResultRef = useRef(onResult); onResultRef.current = onResult;
  const onCloseRef  = useRef(onClose);  onCloseRef.current  = onClose;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const stop = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    };

    void (async () => {
      if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        toast.error("Camera not available on this device");
        onCloseRef.current();
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const handle = (raw: string): boolean => {
          const digits = cleanMobile(raw);
          if (isMobile(digits)) { stop(); onResultRef.current(digits); return true; }
          return false;
        };

        const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
        const detector = Ctor ? new Ctor({ formats: ["qr_code"] }) : null;

        const tick = async () => {
          const v = videoRef.current;
          if (!v || !streamRef.current) return;
          try {
            if (detector) {
              const codes = await detector.detect(v);
              if (codes.length > 0 && handle(codes[0].rawValue)) return;
            } else if (v.videoWidth > 0) {
              const scale = Math.min(1, 800 / Math.max(v.videoWidth, v.videoHeight));
              const canvas = canvasRef.current ?? (canvasRef.current = document.createElement("canvas"));
              canvas.width  = Math.max(1, Math.round(v.videoWidth * scale));
              canvas.height = Math.max(1, Math.round(v.videoHeight * scale));
              const ctx = canvas.getContext("2d", { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                const img  = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
                if (code && handle(code.data)) return;
              }
            }
          } catch { /* bad frame — keep polling */ }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        toast.error((e as Error)?.message || "Camera permission denied");
        onCloseRef.current();
      }
    })();

    return () => { cancelled = true; stop(); };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close scanner"
        className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="relative flex-1">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-64 w-64 rounded-2xl border-2 border-white/70 shadow-[0_0_0_2000px_rgba(0,0,0,0.40)]">
            <span className="absolute -left-px -top-px h-6 w-6 rounded-tl-2xl border-l-4 border-t-4 border-brand" />
            <span className="absolute -right-px -top-px h-6 w-6 rounded-tr-2xl border-r-4 border-t-4 border-brand" />
            <span className="absolute -bottom-px -left-px h-6 w-6 rounded-bl-2xl border-b-4 border-l-4 border-brand" />
            <span className="absolute -bottom-px -right-px h-6 w-6 rounded-br-2xl border-b-4 border-r-4 border-brand" />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 bg-black p-6 text-sm text-white">
        <Camera className="h-4 w-4 opacity-80" />
        <span className="opacity-80">Point at the shop&apos;s QR code</span>
      </div>
    </div>
  );
}
