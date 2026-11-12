// Critter art drawn by Muse Image: background cutouts, the right mood image for each critter state, and
// keepsakes drawn into the art after a meetup. Falls back to the SVG parts whenever an image is missing.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { ai } from "@/lib/ai";
import { keepsakeLabel } from "@/lib/hangout/parts";
import type { CritterState } from "@/lib/hangout/types";

/** Muse originals on a white background (inputs for edits). */
export const SOURCE_DIR = join(process.cwd(), "public", "seed", "critters", "soft");
/** Transparent cutouts the Hangout shows (committed). */
export const ART_DIR = join(process.cwd(), "public", "seed", "critters", "art");
/** Drawn while the app runs (keepsakes after a meetup), served by /api/hangout/art. */
export const RUNTIME_ART_DIR = join(process.cwd(), "data", "hangout", "art");

export const MOODS = ["awake", "sleepy", "napping", "celebrating"] as const;
export type Mood = (typeof MOODS)[number];
export const moodFor = (s: CritterState): Mood | null => (s === "egg" ? null : s === "resting" ? "napping" : s === "hatching" ? "awake" : s);

export const MOOD_PROMPT: Record<Mood, string> = {
  awake: "bright, happy and wide awake: sparkling open eyes, a big warm smile, waving one paw hello",
  sleepy: "sleepy: droopy half-closed eyes, a small yawn, head tilted a little, arms hanging relaxed",
  napping: "fast asleep: eyes closed as gentle curved lines, a peaceful little smile, sitting down and slightly slumped as if napping",
  celebrating: "overjoyed and celebrating: eyes squeezed shut in happy arcs, a big open smile, both arms raised high",
};
const KEEP = "Keep this exact same character: same animal, colors, fur, accessories, art style, lighting and plain white background.";
export const moodEditPrompt = (mood: Mood) => `${KEEP} Only change its expression and pose so it looks ${MOOD_PROMPT[mood]}.`;
export const keepsakeEditPrompt = (pin: string) => `${KEEP} Keep its pose and expression too. Add one small detail: a tiny ${keepsakeLabel(pin).replace(/ pin$/i, "")} enamel pin on its chest.`;

// ---------- cutout ----------

/**
 * Remove the plain background by flood-filling from the border, soften the edge, crop to the character and
 * bottom-align it on a square canvas. Pale characters get a gentler fill so the cut doesn't eat into them.
 */
export async function cutout(input: Buffer, size = 512): Promise<Buffer> {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const fill = (thresh: number) => {
    const bg = new Uint8Array(w * h);
    const seeds = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [w >> 1, 0], [0, h >> 1], [w - 1, h >> 1], [w >> 1, h - 1]];
    for (const [sx, sy] of seeds) {
      const s = (sy * w + sx) * 3;
      const [r0, g0, b0] = [data[s], data[s + 1], data[s + 2]];
      const stack = [sy * w + sx];
      while (stack.length) {
        const p = stack.pop()!;
        if (bg[p]) continue;
        const i = p * 3;
        if (Math.abs(data[i] - r0) + Math.abs(data[i + 1] - g0) + Math.abs(data[i + 2] - b0) > thresh) continue;
        bg[p] = 1;
        const x = p % w;
        if (x > 0) stack.push(p - 1);
        if (x < w - 1) stack.push(p + 1);
        if (p >= w) stack.push(p - w);
        if (p < w * (h - 1)) stack.push(p + w);
      }
    }
    return bg;
  };
  const gentle = fill(24);
  let bg = fill(60);
  const count = (m: Uint8Array) => m.reduce((n, v) => n + v, 0);
  // A big jump between gentle and strong fills means the strong one ate into the character.
  // Measured: shadows alone add ~2% of the image; a pale character being eaten adds ~6%.
  if ((count(bg) - count(gentle)) / (w * h) > 0.035) bg = gentle;

  // Alpha: erode one pixel, then blur so fuzzy edges stay soft.
  const alpha = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let keep = 255;
      for (let dy = -1; dy <= 1 && keep; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = Math.min(w - 1, Math.max(0, x + dx)), yy = Math.min(h - 1, Math.max(0, y + dy));
          if (bg[yy * w + xx]) { keep = 0; break; }
        }
      alpha[y * w + x] = keep;
    }
  const soft = await sharp(Buffer.from(alpha), { raw: { width: w, height: h, channels: 1 } }).blur(1.4).extractChannel(0).raw().toBuffer();

  let [x0, y0, x1, y1] = [w, h, 0, 0];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (soft[y * w + x] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 <= x0 || y1 <= y0) throw new Error("cutout removed everything");

  const rgba = await sharp(data, { raw: { width: w, height: h, channels: 3 } }).joinChannel(soft, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
  const box = { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  const fit = Math.round(size * 0.94);
  const character = await sharp(rgba).extract(box).resize({ width: fit, height: fit, fit: "inside" }).png().toBuffer();
  const meta = await sharp(character).metadata();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: character, left: Math.round((size - meta.width!) / 2), top: size - meta.height! - 4 }])
    .webp({ quality: 90 })
    .toBuffer();
}

export const dataUrlToBuffer = async (url: string) => (url.startsWith("data:") ? Buffer.from(url.split(",")[1], "base64") : Buffer.from(await (await fetch(url)).arrayBuffer()));

/** One Muse Image edit of a white-background original. Returns the edited original (not cut out). */
export async function museEdit(source: Buffer, prompt: string, task: string) {
  const png = await sharp(source).png().toBuffer();
  const { url } = await ai.imageEdit(prompt, { data: png, filename: "critter.png", type: "image/png" }, { task, model: process.env.MUSE_IMAGE_MODEL || process.env.MODEL_IMAGE || "muse-image-1.0", mode: "live" });
  return dataUrlToBuffer(url);
}

// ---------- picking art for a critter ----------

const file = (dir: string, name: string) => join(dir, `${name}.webp`);

export interface ArtPick {
  image: string;
  /** Drawn for this mood (no filter needed). */
  own: boolean;
  /** Keepsake already drawn into the art (don't overlay that pin again). */
  drawnPin?: string;
}

export function critterArt(friendId: string, state: CritterState, keepsakes: string[] = []): ArtPick | null {
  const mood = moodFor(state);
  if (!mood) return null;
  const pin = keepsakes.at(-1);
  const names = [pin ? `${friendId}-${mood}+${pin}` : "", `${friendId}-${mood}`, friendId].filter(Boolean);
  for (const name of names) {
    const meta = { own: name !== friendId, drawnPin: name.includes("+") ? pin : undefined };
    const runtime = file(RUNTIME_ART_DIR, name);
    if (existsSync(runtime)) return { image: `/api/hangout/art/${name}.webp?v=${statSync(runtime).mtimeMs | 0}`, ...meta };
    if (existsSync(file(ART_DIR, name))) return { image: `/seed/critters/art/${name}.webp`, ...meta };
  }
  return null;
}

const drawing = new Set<string>();

/**
 * After a meetup, Muse Image draws the new keepsake pin into the friend's awake and celebrating art.
 * Runs in the background; the Hangout picks the new images up on its next poll. Skips anything already drawn.
 */
export async function drawKeepsake(friendId: string, pin: string, live: boolean): Promise<string[]> {
  const made: string[] = [];
  for (const mood of ["celebrating", "awake"] as const) {
    const name = `${friendId}-${mood}+${pin}`;
    if (drawing.has(name) || existsSync(file(RUNTIME_ART_DIR, name)) || existsSync(file(ART_DIR, name))) continue;
    const srcPath = [file(SOURCE_DIR, `${friendId}-${mood}`), file(SOURCE_DIR, friendId)].find(existsSync);
    if (!live || !srcPath) continue;
    drawing.add(name);
    try {
      const edited = await museEdit(readFileSync(srcPath), keepsakeEditPrompt(pin), "hangout.keepsakeArt");
      mkdirSync(RUNTIME_ART_DIR, { recursive: true });
      writeFileSync(file(RUNTIME_ART_DIR, name), await cutout(edited));
      made.push(name);
    } finally {
      drawing.delete(name);
    }
  }
  return made;
}

/** The Hangout host: official Muse art if the team adds it, else the original plush host, else the SVG sprite. */
export function hostArt(): string | undefined {
  const pub = join(process.cwd(), "public", "seed", "muse");
  if (existsSync(join(pub, "host.png"))) return "/seed/muse/host.png";
  if (existsSync(join(pub, "host-plush.webp"))) return "/seed/muse/host-plush.webp";
  return undefined;
}
