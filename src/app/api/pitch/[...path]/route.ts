// Dev convenience: serve the pitch folder (deck, animations, screenshots) from the running app so it can be
// previewed in the same browser as the demo: http://localhost:3000/api/pitch/deck.html
import { readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { NextRequest, NextResponse } from "next/server";

const ROOT = join(process.cwd(), "pitch");
const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".pdf": "application/pdf", ".json": "application/json", ".md": "text/plain; charset=utf-8", ".mp4": "video/mp4", ".webm": "video/webm" };

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const rel = normalize(path.join("/"));
  if (rel.startsWith("..")) return new NextResponse("nope", { status: 400 });
  const file = join(ROOT, rel);
  try {
    if (!statSync(file).isFile()) return new NextResponse("not found", { status: 404 });
    return new NextResponse(new Uint8Array(readFileSync(file)), { headers: { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" } });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
