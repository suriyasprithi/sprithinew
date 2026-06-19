import { registerPlugin } from "@capacitor/core";

/**
 * Bridge to the native Google Play Install Referrer plugin (Android only).
 * The native side lives in `customer-app/install-referrer/` and is auto-registered
 * by Capacitor on `cap sync`. On web there is no install referrer, so the stub
 * returns null.
 */
export interface InstallReferrerPlugin {
  /** Raw Play referrer string, e.g. "ref=9876543210&utm_source=playstore", or null. */
  getReferrer(): Promise<{ referrer: string | null }>;
}

class InstallReferrerWeb implements InstallReferrerPlugin {
  async getReferrer(): Promise<{ referrer: string | null }> {
    return { referrer: null };
  }
}

export const InstallReferrer = registerPlugin<InstallReferrerPlugin>("InstallReferrer", {
  web: () => Promise.resolve(new InstallReferrerWeb()),
});
