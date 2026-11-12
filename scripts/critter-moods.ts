// npm run critters:moods [-- maya dev …] [--force]
// Muse Image edits each friend's soft critter into every mood (same character, new expression and pose):
// white-background originals go to public/seed/critters/soft/<id>-<mood>.webp, cutouts to art/.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

import { ART_DIR, MOODS, SOURCE_DIR, cutout, moodEditPrompt, museEdit } from "@/server/hangout/art";
import { hang } from "@/server/hangout/store";

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));

async function main() {
  const friends = hang().friends.filter((f) => !f.isBlocked && f.isFriend && (!only.length || only.includes(f.id)) && existsSync(join(SOURCE_DIR, `${f.id}.webp`)));
  console.log(`\nDrawing moods (${MOODS.join(", ")}) for ${friends.map((f) => f.id).join(", ")}\n`);
  for (const f of friends) {
    const base = readFileSync(join(SOURCE_DIR, `${f.id}.webp`));
    await Promise.all(
      MOODS.map(async (mood) => {
        const name = `${f.id}-${mood}.webp`;
        if (!force && existsSync(join(SOURCE_DIR, name))) return console.log(`· ${name} exists`);
        const t0 = Date.now();
        try {
          const edited = await museEdit(base, moodEditPrompt(mood), `hangout.moodArt.${mood}`);
          writeFileSync(join(SOURCE_DIR, name), edited);
          writeFileSync(join(ART_DIR, name), await cutout(edited));
          console.log(`✓ ${name.padEnd(24)} ${String(Date.now() - t0).padStart(6)}ms`);
        } catch (err) {
          console.log(`✗ ${name}: ${(err as Error).message}`);
        }
      }),
    );
  }
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
