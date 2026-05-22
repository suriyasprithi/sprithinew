import type { NextConfig } from "next";

// Capacitor (APK) loads index.html from the app root, so basePath/assetPrefix
// must be empty. Web (served from backend/public/customer/) needs the prefix.
const IS_CAPACITOR = process.env.CAPACITOR_BUILD === "1";
const BASE_PATH = IS_CAPACITOR ? "" : "/customer";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: BASE_PATH || undefined,
  assetPrefix: BASE_PATH || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
  images: { unoptimized: true },
  reactStrictMode: true,
  allowedDevOrigins: ["*.trycloudflare.com"],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
