"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, QrCode, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/layout/app-header";
import { LuxuryCard } from "@/components/ui/custom/luxury-card";
import { GradientButton } from "@/components/ui/custom/gradient-button";
import jsQR from "jsqr";
import { api, apiErrorMessage } from "@/lib/api";
import { cleanMobile, isMobile } from "@/lib/phone";

// Minimal type for the Web BarcodeDetector API (not in lib.dom yet)
type DetectedBarcode = { rawValue: string; format: string };
type BarcodeDetectorLike = { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

export default function QrPurchasePage() {
  const router = useRouter();
  const [vendorMobile, setVendorMobile] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  // An unpaid order with the scanned vendor — pay it directly (wallet) instead
  // of entering an amount. Resolved whenever the vendor mobile is a valid number.
  const [payableOrder, setPayableOrder] = useState<{ id: number; total: number; vendor_name?: string } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);

  const videoRef  = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef    = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const stopCamera = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };
  useEffect(() => () => stopCamera(), []);

  // When the vendor mobile is a full 10-digit number (scanned or typed), look up
  // an unpaid order with that shop so we can offer to pay it directly.
  useEffect(() => {
    if (!isMobile(vendorMobile)) { setPayableOrder(null); return; }
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get(`/orders/qr-payable?vendor_mobile=${vendorMobile}`);
        if (!cancelled) setPayableOrder((res.data.data?.order as { id: number; total: number; vendor_name?: string } | null) ?? null);
      } catch { if (!cancelled) setPayableOrder(null); }
    })();
    return () => { cancelled = true; };
  }, [vendorMobile]);

  async function payOrder() {
    if (!payableOrder) return;
    setBusy(true);
    try {
      await api.post(`/orders/${payableOrder.id}/qr-pay`, { vendor_mobile: vendorMobile });
      toast.success(`Paid ₹${payableOrder.total} for Order #${payableOrder.id}`);
      router.push("/orders");
    } catch (e) {
      // Insufficient balance / number mismatch surface as a friendly toast.
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function openScanner() {
    setScannerError(null);
    if (typeof window === "undefined") return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError("Camera access not available. Enter mobile manually below.");
      return;
    }

    setScannerOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      // Accept plain mobile digits, or `tel:`/`upi:` URIs — keep the last 10
      // digits and require a full 10-digit mobile. Returns true once matched.
      const handle = (raw: string): boolean => {
        const digits = cleanMobile(raw);
        if (isMobile(digits)) {
          setVendorMobile(digits);
          toast.success(`Vendor: ${digits}`);
          closeScanner();
          return true;
        }
        return false;
      };

      // Fast path: native BarcodeDetector (Chrome/web). Fallback: jsQR on canvas
      // frames — works in the Capacitor WebView (no BarcodeDetector) and Safari/Firefox.
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
            // Decode a downscaled frame (≤800px) with jsQR — fast enough on phones.
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
      const msg = (e as Error)?.message || "Camera permission denied";
      setScannerError(msg);
      closeScanner();
    }
  }

  function closeScanner() {
    stopCamera();
    setScannerOpen(false);
  }

  async function pay() {
    const amt = Number(amount);
    if (!isMobile(vendorMobile)) { toast.error("Enter a valid 10-digit vendor mobile"); return; }
    if (!amt) { toast.error("Enter an amount"); return; }
    setBusy(true);
    try {
      await api.post("/purchase/qr", { vendor_mobile: vendorMobile, amount: amt });
      toast.success(`Paid ₹${amt} to ${vendorMobile}`);
      router.push("/orders");
    } catch (e) { toast.error(apiErrorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <>
      <AppHeader title="QR Pay" />
      <section className="mx-auto max-w-md space-y-4 p-4 pb-24 md:p-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <button
            type="button"
            onClick={() => void openScanner()}
            className="block w-full"
            disabled={busy}
          >
            <LuxuryCard glow hoverLift={false} className="relative overflow-hidden brand-gradient p-8 text-center text-brand-foreground transition-transform active:scale-[0.99]">
              <div className="absolute inset-0 brand-gradient-soft opacity-30" />
              <div className="relative flex flex-col items-center gap-3">
                <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                  <QrCode className="h-10 w-10" />
                </span>
                <p className="text-sm font-medium opacity-95">Tap to scan vendor QR</p>
                <p className="text-xs opacity-80">or enter mobile manually below</p>
              </div>
            </LuxuryCard>
          </button>
        </motion.div>

        {scannerError && (
          <LuxuryCard hoverLift={false} className="border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700">
            {scannerError}
          </LuxuryCard>
        )}

        {/* An unpaid order with the scanned shop — pay it directly from wallet. */}
        {payableOrder && (
          <LuxuryCard hoverLift={false} className="space-y-3 border-brand/30 bg-brand/5 p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Order payment</p>
                <p className="truncate text-sm font-semibold">Order #{payableOrder.id}{payableOrder.vendor_name ? ` · ${payableOrder.vendor_name}` : ""}</p>
              </div>
              <p className="shrink-0 text-lg font-bold text-brand">₹{payableOrder.total}</p>
            </div>
            <GradientButton size="lg" className="w-full" disabled={busy} onClick={() => void payOrder()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay ₹${payableOrder.total} from wallet`}
            </GradientButton>
            <p className="text-[11px] text-muted-foreground">Pays this order from your wallet and confirms it with the shop.</p>
          </LuxuryCard>
        )}

        <LuxuryCard hoverLift={false} className="space-y-4 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="m">Vendor mobile</Label>
            <Input id="m" inputMode="numeric" maxLength={10} value={vendorMobile} onChange={(e) => setVendorMobile(cleanMobile(e.target.value))} placeholder="9999000010" className="h-11 rounded-xl bg-surface-2/60" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a">Amount (₹)</Label>
            <Input id="a" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" className="h-11 rounded-xl bg-surface-2/60" />
          </div>
          <GradientButton size="lg" className="w-full" disabled={busy} onClick={() => void pay()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pay"}
          </GradientButton>
        </LuxuryCard>
      </section>

      {/* Full-screen camera scanner overlay */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <button
            type="button"
            onClick={closeScanner}
            className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80"
            aria-label="Close scanner"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative flex-1">
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            {/* Aiming square */}
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
            <span className="opacity-80">Point at vendor's QR code</span>
          </div>
        </div>
      )}
    </>
  );
}
