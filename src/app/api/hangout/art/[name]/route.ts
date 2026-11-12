// Serves critter art drawn while the app runs (keepsakes after a meetup), from data/hangout/art.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { RUNTIME_ART_DIR } from "@/server/hangout/art";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!/^[a-z0-9_-]+(\+[a-z_]+)?\.webp$/.test(name)) return new NextResponse("bad name", { status: 400 });
  const file = join(RUNTIME_ART_DIR, name);
  if (!existsSync(file)) return new NextResponse("not found", { status: 404 });
  return new NextResponse(new Uint8Array(readFileSync(file)), { headers: { "content-type": "image/webp", "cache-control": "no-cache" } });
}
