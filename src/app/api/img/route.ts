// Caching image proxy. Seed images point at placeholder services; the first request fetches and caches
// to disk (.image-cache/), every later request is served locally. Run `npm run warm` before a demo so the
// whole app works offline. Only allow-listed hosts are proxied.
import { NextRequest, NextResponse } from "next/server";

import { ALLOW, cacheImage } from "@/server/images";

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  let host = "";
  try {
    host = new URL(u).hostname;
  } catch {
    return new NextResponse("bad url", { status: 400 });
  }
  if (!ALLOW.includes(host)) return new NextResponse("host not allowed", { status: 403 });
  const img = await cacheImage(u);
  if (!img) return new NextResponse("upstream unavailable", { status: 502 });
  return new NextResponse(new Uint8Array(img.buf), { headers: { "content-type": img.type, "cache-control": "public, max-age=31536000, immutable" } });
}
