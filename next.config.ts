import type { NextConfig } from "next";

// The Sidequest game server (npm run sidequest). Proxied through this app so a single public URL (the demo tunnel)
// serves both. Fallback rewrites only apply when no Next page or route matches.
const SQ = `http://127.0.0.1:${process.env.SIDEQUEST_PORT || 5180}`;
const sqPaths = ["/x", "/x/:id", "/k/:id", "/r/:id", "/s/:id", "/rarity.js", "/kitchen.js", "/run.js", "/sketch.js", "/bg/:file", "/api/x/:path*", "/api/k/:path*", "/api/r/:path*", "/api/s/:path*"];

const nextConfig: NextConfig = {
  // The public demo builds into its own folder so it never clobbers a running `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: { unoptimized: true },
  // Generating a new game topic calls the model and can take a while; the default proxy timeout is 30s.
  experimental: { serverActions: { bodySizeLimit: "4mb" }, proxyTimeout: 300_000 },
  // Pin the project root: a stray ~/package-lock.json otherwise makes Turbopack treat the home folder as the root.
  turbopack: { root: __dirname },
  async rewrites() {
    return { beforeFiles: [], afterFiles: [], fallback: sqPaths.map((source) => ({ source, destination: `${SQ}${source}` })) };
  },
};

export default nextConfig;
