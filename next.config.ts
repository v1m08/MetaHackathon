import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // Pin the project root: a stray ~/package-lock.json otherwise makes Turbopack treat the home folder as the root.
  turbopack: { root: __dirname },
};

export default nextConfig;
