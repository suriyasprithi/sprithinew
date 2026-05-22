/**
 * Token storage abstraction.
 * Web:    localStorage (sync).
 * Native: localStorage (sync mirror) + Capacitor Preferences write-through (encrypted on Android).
 *
 * The sync interface is preserved so the rest of the app doesn't change.
 * On native first-load we eagerly hydrate from Preferences into localStorage
 * (Preferences survives Android backup/restore even when localStorage is wiped).
 */
import { Capacitor } from "@capacitor/core";

export const STORAGE_KEYS = {
  ACCESS: "epey.access_token",
  REFRESH: "epey.refresh_token",
} as const;

const ALL_KEYS = Object.values(STORAGE_KEYS);

let hydrated = false;
let hydrationPromise: Promise<void> | null = null;

async function loadPreferences(): Promise<void> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    for (const key of ALL_KEYS) {
      const localVal = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
      if (localVal) continue; // localStorage already has it
      const { value } = await Preferences.get({ key });
      if (value && typeof window !== "undefined") window.localStorage.setItem(key, value);
    }
  } catch {
    // ignore — fall back to localStorage-only
  }
}

export function hydrateStorage(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (hydrationPromise) return hydrationPromise;
  if (typeof window === "undefined" || !Capacitor.isNativePlatform()) {
    hydrated = true;
    return Promise.resolve();
  }
  hydrationPromise = loadPreferences().finally(() => { hydrated = true; });
  return hydrationPromise;
}

async function writeThrough(key: string, value: string | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    if (value === null) await Preferences.remove({ key });
    else                await Preferences.set({ key, value });
  } catch {
    // ignore
  }
}

export const storage = {
  get(key: string): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  },
  set(key: string, value: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
    void writeThrough(key, value);
  },
  remove(key: string) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
    void writeThrough(key, null);
  },
};
