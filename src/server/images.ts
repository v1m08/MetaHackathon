// Disk cache for placeholder images. Used by /api/img and the warm-images admin route.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const ALLOW = ["picsum.photos", "fastly.picsum.photos", "i.pravatar.cc", "upload.wikimedia.org", "thumb.wikimedia.org"];
const DIR = join(process.cwd(), ".image-cache");

export async function cacheImage(url: string): Promise<{ buf: Buffer; type: string } | null> {
  const key = createHash("sha1").update(url).digest("hex");
  mkdirSync(DIR, { recursive: true });
  const file = join(DIR, key);
  const meta = file + ".type";
  if (existsSync(file)) return { buf: readFileSync(file), type: existsSync(meta) ? readFileSync(meta, "utf8") : "image/jpeg" };
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000), headers: { "user-agent": "fb-hackathon-clone/0.1 (image cache)" } });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(file, buf);
    writeFileSync(meta, type);
    return { buf, type };
  } catch {
    return null;
  }
}

