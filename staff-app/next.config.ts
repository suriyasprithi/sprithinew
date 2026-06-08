import type { NextConfig } from "next";

// Capacitor (APK) loads index.html from the app root, so basePath/assetPrefix
// must be empty. Web is deployed per-role (admin/state/district/taluk/vendor)
// and needs the prefix injected via BASE_PATH env at build time.
const IS_CAPACITOR = process.env.CAPACITOR_BUILD === "1";
const BASE_PATH = IS_CAPACITOR ? "" : (process.env.BASE_PATH ?? "/admin");
// Admin APK variant (com.epey.admin) — opens to /control instead of /login.
const IS_ADMIN = process.env.ADMIN_BUILD === "1";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: BASE_PATH || undefined,
  assetPrefix: BASE_PATH || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH, NEXT_PUBLIC_ADMIN_BUILD: IS_ADMIN ? "1" : "" },
  images: { unoptimized: true },
  reactStrictMode: true,
  allowedDevOrigins: ["*.trycloudflare.com"],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
