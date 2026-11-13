// A generated pixel-art backdrop per topic: one tall image the player scrolls through as they score.
// Cached in .cache/bg/<topic>.png and served at /bg/<topic>.png. If it fails, the game keeps its drawn world.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { norm, type Pack } from "../../shared/rarity";
import { cleanText } from "../../shared/text";
import { chatJSON, extractJson, generateImage } from "../llm";

export const BG_DIR = join(__dirname, "..", "..", ".cache", "bg");
export const bgKey = (interest: string) => norm(interest).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "x";
const bgFile = (interest: string) => join(BG_DIR, `${bgKey(interest)}.png`);
export const hasBg = (interest: string) => existsSync(bgFile(interest));
export const bgUrl = (interest: string) => `/bg/${bgKey(interest)}.png`;

type Source = Pick<Pack, "interest" | "scene" | "meter"> & { backdrop?: string };

function prompt(p: Source) {
  const up = p.meter?.up !== false;
  const world = p.backdrop?.trim() || `A world a fan of ${p.interest} would instantly recognise, full of its iconic places, gear and objects.`;
  return [
    "Tall vertical pixel-art video game background, detailed 16-bit style, rich colors, strong depth.",
    "No text, no letters, no numbers, no logos, no UI, no people or characters.",
    `Theme: ${p.interest}. ${world}`,
    "Feature the theme's single most iconic, instantly recognisable landmark or symbol large and unmistakable (for a city, its most famous sight: e.g. the Golden Gate Bridge for San Francisco).",
    up
      ? "It is one continuous journey read from the BOTTOM (the start, at ground level) up to the TOP (the summit, the legendary finish)."
      : "It is one continuous journey read from the TOP (the start, at the surface) down to the BOTTOM (the deepest, legendary finish).",
    "Keep the middle third calm and open (a path, stairs, sky or water) because the player and text sit there; put detail on the left and right sides.",
  ].join("\n");
}

/** For topics made before backdrops existed: a quick, specific scene description from the fast model. */
async function describe(interest: string) {
  const r = await chatJSON(
    [
      {
        role: "system",
        content:
          'Describe a custom pixel-art game background for a fan of the given interest, in 1-2 vivid sentences. Name the actual places, landmarks, gear and objects a fan would recognise instantly (for chess: giant marble kings, knights and rooks on floating checkered platforms; for Fortnite: the battle bus over a colorful island with loot llamas and the storm wall), laid out as a journey from start to a legendary finish. No text, no real people. Reply with only JSON: {"backdrop": "..."}',
      },
      { role: "user", content: `Interest: ${interest}` },
    ],
    { maxTokens: 1500, timeoutMs: 30000, reasoning: "low", temperature: 0.7, model: process.env.MODEL_FAST || "muse-ember-1.0", task: "rarity.backdrop-text" },
  );
  return cleanText((extractJson(r.text) as { backdrop?: unknown }).backdrop, 400);
}

const pending = new Map<string, Promise<boolean>>();
/** Make (once) the backdrop for a topic. Resolves true when the file exists. Never throws. */
export function makeBackdrop(p: Source): Promise<boolean> {
  const k = bgKey(p.interest);
  if (hasBg(p.interest)) return Promise.resolve(true);
  let job = pending.get(k);
  if (!job) {
    job = (async () => {
      try {
        const src = p.backdrop?.trim() ? p : { ...p, backdrop: await describe(p.interest).catch(() => "") };
        const png = await generateImage(prompt(src), { size: "1024x1792", task: "rarity.backdrop" });
        mkdirSync(BG_DIR, { recursive: true });
        writeFileSync(bgFile(p.interest), png);
        return true;
      } catch (e) {
        console.error(`[backdrop] ${p.interest}: ${String((e as Error).message).slice(0, 200)}`);
        return false;
      } finally {
        pending.delete(k);
      }
    })();
    pending.set(k, job);
  }
  return job;
}
