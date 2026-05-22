import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.epey.staff",
  appName: "Epey Staff",
  webDir: "out",
  android: {
    allowMixedContent: false,
  },
  // server: { url: "http://192.168.1.5:3001", cleartext: true },
};

export default config;
