// Device token registration.
// Web build  -> stub token in localStorage.
// APK build  -> real FCM token via @capacitor/push-notifications.
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { api } from "./api";

const STUB_TOKEN_KEY = "epey.web_push_stub_token";
let handlersInstalled = false;

function ensureStubToken(): string {
  if (typeof window === "undefined") return "ssr-no-token";
  const existing = window.localStorage.getItem(STUB_TOKEN_KEY);
  if (existing) return existing;
  const fresh = `web-stub-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  window.localStorage.setItem(STUB_TOKEN_KEY, fresh);
  return fresh;
}

async function registerNative(): Promise<{ token: string; platform: "android" | "ios" } | null> {
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const perm = await PushNotifications.checkPermissions();
    let granted = perm.receive === "granted";
    if (!granted) {
      const req = await PushNotifications.requestPermissions();
      granted = req.receive === "granted";
    }
    if (!granted) return null;
    return new Promise((resolve) => {
      let resolved = false;
      PushNotifications.addListener("registration", (t: { value: string }) => {
        if (resolved) return; resolved = true;
        resolve({ token: t.value, platform: Capacitor.getPlatform() === "ios" ? "ios" : "android" });
      });
      PushNotifications.addListener("registrationError", () => { if (!resolved) { resolved = true; resolve(null); } });
      PushNotifications.register();
      setTimeout(() => { if (!resolved) { resolved = true; resolve(null); } }, 8000);
    });
  } catch {
    return null;
  }
}

export async function registerDeviceToken() {
  try {
    if (Capacitor.isNativePlatform()) {
      const r = await registerNative();
      if (r) {
        await api.post("/devices/register", { token: r.token, platform: r.platform });
        return;
      }
    }
    const token = ensureStubToken();
    await api.post("/devices/register", { token, platform: "web" });
  } catch {
    // never block login on this
  }
}

// Foreground display + tap-to-deep-link. Safe to call once on mount.
export function initPushHandlers(navigate: (route: string) => void) {
  if (handlersInstalled) return;
  if (!Capacitor.isNativePlatform()) return;
  handlersInstalled = true;
  void (async () => {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      await PushNotifications.addListener("pushNotificationReceived", (n) => {
        toast(n.title ?? "Notification", { description: n.body ?? undefined });
      });
      await PushNotifications.addListener("pushNotificationActionPerformed", (e) => {
        const data = (e.notification.data ?? {}) as { route?: string };
        navigate(data.route ?? "/notifications");
      });
    } catch {
      handlersInstalled = false;
    }
  })();
}

export async function unregisterDeviceToken() {
  try {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem(STUB_TOKEN_KEY);
    if (token) await api.post("/devices/unregister", { token });
  } catch {
    // ignore
  }
}
