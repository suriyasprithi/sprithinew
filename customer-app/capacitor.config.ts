import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.epey.customer",
  appName: "Epey",
  webDir: "out",
  android: {
    allowMixedContent: false,
  },
  // For dev against a hosted backend, leave server.url unset and the app uses
  // bundled web assets that call NEXT_PUBLIC_API_URL.
  // For testing against a LAN dev server (e.g. on Wi-Fi), uncomment:
  // server: { url: "http://192.168.1.5:3000", cleartext: true },
};

export default config;
