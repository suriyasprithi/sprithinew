import type { NextConfig } from "next";

const BASE_PATH = process.env.BASE_PATH ?? "/admin";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: BASE_PATH,
  assetPrefix: BASE_PATH,
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
  images: { unoptimized: true },
  reactStrictMode: true,
  allowedDevOrigins: ["*.trycloudflare.com"],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
