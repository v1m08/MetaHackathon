// npm run critters:generate [-- --force] [-- --style flat|plush|cute|costume|fuzzy|soft] [-- maya dev …]
// Draws each friend's critter with Muse Image (muse-image-1.0), from their memory file: the body/color/accessory
// Muse Wonder picked plus a prop from a shared place or inside joke. Saves to public/seed/critters/<id>.<ext>.
// Existing images are kept unless --force. Blocked friends are never drawn.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

import { PLACES } from "@/data/hangout/seed";
import { ai } from "@/lib/ai";
import { ART, artKey } from "@/lib/hangout/art";
import { colorById } from "@/lib/hangout/parts";
import { builtMemory, hang } from "@/server/hangout/store";

const STYLES = ["flat", "plush", "cute", "costume", "fuzzy", "soft"] as const;
type Style = (typeof STYLES)[number];
const styleArg = process.argv.find((a, i) => a.startsWith("--style=") || process.argv[i - 1] === "--style")?.replace("--style=", "");
const STYLE: Style = STYLES.includes(styleArg as Style) ? (styleArg as Style) : "flat";
const OUT = join(process.cwd(), "public", "seed", "critters", ...(STYLE === "flat" ? [] : [STYLE]));
const STYLE_TEXT: Record<Style, string> = {
  flat: "Gentle happy expression, soft rosy cheeks, tiny stubby arms. Simple flat vector illustration with soft pastel shading and a thin darker outline, centered on a plain cream background, no text, no logos.",
  plush: "An original character made as a soft handmade plush toy from fuzzy felt fabric, with simple dot eyes, a tiny stitched smile, rosy embroidered cheeks and tiny stubby arms. Photographed like a 3D plush toy in soft studio lighting, centered on a plain cream background, no text, no logos.",
  cute: "An original kawaii character with chibi proportions: a big round head on a tiny body, large sparkly eyes with white highlights, rosy blush, a small happy open smile and tiny nub arms. Soft glossy 3D cartoon render in pastel colors with gentle rim light, like a collectible sticker, centered on a plain cream background, no text, no logos.",
  soft: "Minimal kawaii design: a big round head on a small rounded body, a smooth cream-colored face, two small shiny black dot eyes set wide apart, a tiny curved smile, soft oval pink blush, short nub arms and little feet. Photorealistic 3D render of a soft collectible plush with short, smooth felted fuzz in muted pastel tones, standing full-body facing the viewer, pure white background, soft diffused studio lighting, gentle shadow, centered, no text, no logos.",
  fuzzy: "Chubby rounded proportions with a cream-colored muzzle, tiny black dot eyes, soft pink blush cheeks, a tiny smile, short stubby arms and little feet, standing full-body facing the viewer. Photorealistic 3D render of a soft fuzzy felt-and-fur collectible plush in pastel colors, clean pure white background, soft diffused studio lighting, subtle shadow, centered, no text, no logos.",
  costume: "Small black dot eyes, rosy cheeks, a tiny gentle smile, short arms and little feet, standing full-body facing the viewer. Photorealistic 3D render of a soft collectible figure with realistic fuzzy fur and real fabric clothing, clean bright white studio background, soft even lighting, subtle floor shadow, no text, no logos.",
};

/** Costume style: each friendship becomes an outfit, picked from what Muse remembers about it. */
const COSTUME: Record<string, string> = {
  ramen: "a little ramen chef outfit: a white twisted headband, a navy apron, and a tiny steaming bowl of ramen with chopsticks in its hands",
  goose: "a park ranger vest and wide-brim ranger hat, with a small grumpy white goose tucked under one arm",
  school: "a varsity letterman jacket with a big letter patch, holding a small school pennant",
  run: "running gear: a sweatband, a race bib pinned to a tank top, and bright running sneakers",
  movies: "a movie-night outfit: retro red-and-blue 3D glasses and a striped popcorn bucket",
  swim: "swim gear: goggles pushed up on its head, a flower behind one ear, and a striped swim ring around its waist",
  campus: "a cozy oversized campus hoodie and a tiny backpack, holding a pencil",
};
const FIGURE: Record<string, string> = {
  blob: "a round, chubby body",
  noodle: "a tall, slender, slightly wiggly body",
  bean: "a plump, bean-shaped body",
  puff: "a cloud-like, extra fluffy body",
  pebble: "a short, wide, chubby body",
};
const MODEL = process.env.MUSE_IMAGE_MODEL || process.env.MODEL_IMAGE || "muse-image-1.0";

const BODY: Record<string, string> = {
  blob: "a round, squishy blob creature",
  noodle: "a tall, wiggly noodle-shaped creature",
  bean: "a plump, slightly tilted bean-shaped creature",
  puff: "a fluffy cloud-puff creature",
  pebble: "a low, wide, smooth pebble-shaped creature",
};
const ACCESSORY: Record<string, string> = {
  none: "",
  beanie: "wearing a cozy red knit beanie with a white pompom",
  party_hat: "wearing a tiny purple party hat",
  bow: "with a pink bow on its head",
  headphones: "wearing chunky headphones",
  glasses: "wearing round glasses",
  flower: "with a pink flower tucked on its head",
  cap: "wearing a blue baseball cap",
  scarf: "wearing a small red knit scarf",
  feather: "with a single white goose feather tucked on top of its head",
  sprout: "with a tiny green sprout growing from its head",
  star_clip: "with a yellow star hair clip",
  bandana: "wearing a red runner's sweatband",
};
const PROP: Record<string, string> = {
  ramen: "holding tiny chopsticks",
  coffee: "holding a tiny coffee cup",
  movies: "holding a small striped popcorn bucket",
  swim: "with a tiny striped swim ring around its middle",
  run: "wearing tiny running sneakers",
  park: "holding a small green leaf",
  tacos: "holding a tiny taco",
  diner: "holding a tiny stack of pancakes",
};

/** Fuzzy style: each friendship becomes a pastel animal plus one small detail from what Muse remembers. */
const ANIMAL: Record<string, { species: string; detail: string }> = {
  ramen: { species: "kitten", detail: "holding a tiny steaming bowl of ramen with chopsticks, wearing a little red knit scarf" },
  goose: { species: "baby gosling", detail: "holding a single white goose feather" },
  school: { species: "bunny with long floppy ears", detail: "holding a tiny school pennant, with a yellow star clip on one ear" },
  run: { species: "fox with a fluffy tail", detail: "wearing a red sweatband and tiny running sneakers" },
  movies: { species: "bear cub", detail: "wearing little round glasses and hugging a striped popcorn bucket" },
  swim: { species: "baby seal", detail: "wearing a striped swim ring, with a pink flower behind one ear" },
  campus: { species: "penguin", detail: "wearing a tiny backpack" },
};

function themeKey(m: NonNullable<ReturnType<typeof builtMemory>>) {
  if (m.insideJokes.some((j) => /goose/i.test(j.phrase))) return "goose";
  const kinds = m.sharedPlaces.map((p) => PLACES.find((x) => x.name === p.name)?.kind);
  const kind = kinds.find((k) => k && ANIMAL[k]);
  if (kind) return kind;
  return /lincoln|high/i.test(m.sharedPlaces[0]?.name ?? "") ? "school" : "campus";
}

function costumeFor(m: NonNullable<ReturnType<typeof builtMemory>>) {
  if (m.insideJokes.some((j) => /goose/i.test(j.phrase))) return COSTUME.goose;
  const kinds = m.sharedPlaces.map((p) => PLACES.find((x) => x.name === p.name)?.kind);
  const kind = kinds.find((k) => k && COSTUME[k]);
  if (kind) return COSTUME[kind];
  if (/lincoln|high/i.test(m.sharedPlaces[0]?.name ?? "")) return COSTUME.school;
  return COSTUME.campus;
}

function promptFor(friendId: string) {
  const m = builtMemory(friendId);
  if (!m) return null;
  const c = colorById(m.critter.color);
  if (STYLE === "soft") {
    const a = ART[artKey(m).key];
    return `An original kawaii plush animal character: a ${a.species} in ${a.color}, ${a.detail}. ${STYLE_TEXT.soft}`;
  }
  if (STYLE === "fuzzy") {
    const a = ANIMAL[themeKey(m)];
    return `An original kawaii plush animal character: a ${a.species} with soft fuzzy pastel ${c.label.toLowerCase()} (${c.fill}) fur, ${a.detail}. ${STYLE_TEXT.fuzzy}`;
  }
  if (STYLE === "costume")
    return `An original fluffy creature character with ${FIGURE[m.critter.body] ?? FIGURE.blob} covered in soft ${c.label.toLowerCase()} (${c.fill}) fur, dressed in ${costumeFor(m)}. ${STYLE_TEXT.costume}`;
  const joke = m.insideJokes.find((j) => /goose/i.test(j.phrase));
  const kind = m.sharedPlaces.map((p) => PLACES.find((x) => x.name === p.name)?.kind).find((k) => k && PROP[k]);
  const extra = joke ? "with a tiny cartoon goose peeking out from behind it" : kind ? PROP[kind] : /lincoln|school|gym/i.test(m.sharedPlaces[0]?.name ?? "") ? "holding a small school pennant" : "";
  return [
    `A cute friendship critter for a cozy social app: ${BODY[m.critter.body] ?? BODY.blob} in soft ${c.label.toLowerCase()} (${c.fill})`,
    ACCESSORY[m.critter.accessory],
    extra,
  ]
    .filter(Boolean)
    .join(", ")
    .concat(`. ${STYLE_TEXT[STYLE]}`);
}

const extFor = (buf: Buffer) => (buf.subarray(0, 4).toString() === "RIFF" ? "webp" : buf[0] === 0x89 ? "png" : "jpg");

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const only = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--style");
  mkdirSync(OUT, { recursive: true });
  const have = new Set(readdirSync(OUT).map((f) => f.replace(/\.\w+$/, "")));
  const friends = hang().friends.filter((f) => !f.isBlocked && f.isFriend && (!only.length || only.includes(f.id)));
  const todo = friends.filter((f) => force || !have.has(f.id));
  console.log(`\nStyle: ${STYLE}. Drawing ${todo.length} critter${todo.length === 1 ? "" : "s"} with ${MODEL}${have.size ? ` (keeping ${friends.length - todo.length} existing; --force to redraw)` : ""}\n`);

  await Promise.all(
    todo.map(async (f) => {
      const prompt = promptFor(f.id);
      if (!prompt) return console.log(`✗ ${f.id}: no memory file`);
      const t0 = Date.now();
      try {
        const { url } = await ai.image(prompt, { task: "hangout.critterImage", model: MODEL, size: "1024x1024", mode: "live" });
        const buf = url.startsWith("data:") ? Buffer.from(url.split(",")[1], "base64") : Buffer.from(await (await fetch(url)).arrayBuffer());
        const file = join(OUT, `${f.id}.${extFor(buf)}`);
        writeFileSync(file, buf);
        console.log(`✓ ${f.id.padEnd(6)} ${String(Date.now() - t0).padStart(6)}ms  ${file.replace(process.cwd() + "/", "")}\n    ${prompt}`);
      } catch (err) {
        console.log(`✗ ${f.id}: ${(err as Error).message}`);
      }
    }),
  );
  console.log("");
}

main();
