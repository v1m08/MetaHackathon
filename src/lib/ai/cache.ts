// Request cache: identical chat request → identical response, $0, labelled "cached" in traces.
// Gitignored .ai-cache/. Keyed by a hash of the full request body.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = () => process.env.AI_CACHE_DIR ?? join(process.cwd(), ".ai-cache");

export function cacheKey(body: unknown) {
  return createHash("sha1").update(JSON.stringify(body)).digest("hex");
}
export function cacheGet<T>(key: string): T | undefined {
  const f = join(DIR(), key + ".json");
  if (!existsSync(f)) return undefined;
  try {
    return JSON.parse(readFileSync(f, "utf8")) as T;
  } catch {
    return undefined;
  }
}
export function cacheSet(key: string, value: unknown) {
  mkdirSync(DIR(), { recursive: true });
  writeFileSync(join(DIR(), key + ".json"), JSON.stringify(value));
}
