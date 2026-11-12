// npm run critters:cutout [-- maya dev …]
// Cuts the white background out of every Muse original in public/seed/critters/soft (base + mood images)
// and writes transparent, bottom-aligned 512px images to public/seed/critters/art for the Hangout.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ART_DIR, SOURCE_DIR, cutout } from "@/server/hangout/art";

const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));

async function main() {
  mkdirSync(ART_DIR, { recursive: true });
  const files = readdirSync(SOURCE_DIR).filter((f) => f.endsWith(".webp") && (!only.length || only.includes(f.split(/[-.]/)[0])));
  for (const f of files) {
    const out = await cutout(readFileSync(join(SOURCE_DIR, f)));
    writeFileSync(join(ART_DIR, f), out);
    console.log(`${f} → public/seed/critters/art/${f} (${(out.length / 1024) | 0} KB)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
