import type { CapacitorConfig } from "@capacitor/cli";

// ADMIN_BUILD=1 produces the dedicated admin APK (separate app id so it installs
// alongside the staff app, and opens to /control). Default is the staff app.
const IS_ADMIN = process.env.ADMIN_BUILD === "1";

const config: CapacitorConfig = {
  appId: IS_ADMIN ? "com.epey.admin" : "com.epey.staff",
  appName: IS_ADMIN ? "SPRITHI Admin" : "SPRITHI Staff",
  webDir: "out",
  android: {
    allowMixedContent: false,
  },
  // server: { url: "http://192.168.1.5:3001", cleartext: true },
};

export default config;
