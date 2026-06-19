/**
 * Deferred-deep-link referral capture.
 *
 * A pending referral code (= the referrer's 10-digit mobile) is captured from any
 * of three sources and stored in `storage` (localStorage + Capacitor Preferences
 * write-through, so it survives app restarts). The registration screen reads it,
 * auto-fills it read-only, and clears it after a successful signup.
 *
 * Sources:
 *  1. the current URL — `?ref=` (web / landing) or `/ref/{code}` (deep link),
 *  2. the Android Play Install Referrer — recovered on first launch after a
 *     Play Store install that carried `&referrer=ref%3D{code}` (deferred link),
 *  3. `App.appUrlOpen` — an App Link tapped while the app is already running.
 */
import { Capacitor } from "@capacitor/core";
import { storage } from "./storage";
import { InstallReferrer } from "./install-referrer";

export const PENDING_REF_KEY = "epey.pending_ref";

const isCode = (s: string): boolean => /^[0-9]{10}$/.test(s);
const digits = (s: string): string => (s || "").replace(/\D/g, "");

export function savePendingReferral(code: string): void {
  const c = digits(code);
  if (isCode(c)) storage.set(PENDING_REF_KEY, c);
}

export function getPendingReferral(): string | null {
  const c = storage.get(PENDING_REF_KEY);
  return c && isCode(c) ? c : null;
}

export function clearPendingReferral(): void {
  storage.remove(PENDING_REF_KEY);
}

/** Extract a referral code from a `/ref/{code}` path or a `?ref=` query. */
export function codeFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const path = u.pathname.match(/\/ref\/([0-9]{10})/);
    if (path) return path[1];
    const q = digits(u.searchParams.get("ref") ?? "");
    if (isCode(q)) return q;
  } catch {
    /* not an absolute URL — ignore */
  }
  return null;
}

/** Extract `ref={code}` from a raw Play Install Referrer string. */
export function codeFromReferrerString(s: string | null): string | null {
  if (!s) return null;
  const m = s.match(/(?:^|[&?])ref=([0-9]{10})/);
  return m ? m[1] : null;
}

let captured = false;

/**
 * Capture a pending referral from every source, once per launch. Never throws —
 * referral capture must never block app start. `onDeepLink` fires when an App Link
 * arrives while the app is running, so the caller can route to registration.
 */
export async function initReferralCapture(onDeepLink?: (code: string) => void): Promise<void> {
  if (captured) return;
  captured = true;

  // 1. Current URL (?ref= on web, /ref/{code} via a deep-link open).
  if (typeof window !== "undefined") {
    const fromUrl = codeFromUrl(window.location.href);
    if (fromUrl) savePendingReferral(fromUrl);
  }

  if (!Capacitor.isNativePlatform()) return;

  // 2. Play Install Referrer (deferred) — only if nothing captured yet.
  if (!getPendingReferral()) {
    try {
      const { referrer } = await InstallReferrer.getReferrer();
      const code = codeFromReferrerString(referrer);
      if (code) savePendingReferral(code);
    } catch {
      /* plugin unavailable / no referrer */
    }
  }

  // 3. App Links opened while the app is running/backgrounded.
  try {
    const { App } = await import("@capacitor/app");
    await App.addListener("appUrlOpen", (event: { url: string }) => {
      const code = codeFromUrl(event.url);
      if (code) {
        savePendingReferral(code);
        onDeepLink?.(code);
      }
    });
  } catch {
    /* @capacitor/app unavailable */
  }
}
