// Challenge links: `#g=<base64url(zlib-deflate(JSON))>`. Works in Node 18+ and modern browsers via
// CompressionStream("deflate"). `#j=` (uncompressed) is accepted as a fallback. Decoded configs are
// untrusted: always run sanitizeConfig on them.
import { sanitizeConfig } from "./schema";
import type { SharePayload } from "./types";

const toB64url = (bytes: Uint8Array) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export async function encodeShare(p: SharePayload): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(p));
  if (typeof CompressionStream === "undefined") return "j=" + toB64url(json);
  return "g=" + toB64url(await pipe(json, new CompressionStream("deflate")));
}

export async function decodeShare(hash: string): Promise<SharePayload | null> {
  const h = hash.replace(/^#/, "");
  try {
    let json: string;
    if (h.startsWith("g=")) json = new TextDecoder().decode(await pipe(fromB64url(h.slice(2)), new DecompressionStream("deflate")));
    else if (h.startsWith("j=")) json = new TextDecoder().decode(fromB64url(h.slice(2)));
    else return null;
    const raw = JSON.parse(json) as { config?: unknown; scoreToBeat?: unknown };
    const s = Number(raw.scoreToBeat);
    return { config: sanitizeConfig(raw.config), scoreToBeat: Number.isFinite(s) && s > 0 ? Math.min(Math.round(s), 1e7) : undefined };
  } catch {
    return null;
  }
}
