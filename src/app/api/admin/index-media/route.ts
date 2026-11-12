// Builds the media index: Muse image understanding over every seeded city photo, once, stored as JSON so
// the live agent reads structured notes instead of re-reading pixels. `npm run index-media` calls this.
// Goes through the normal AI client so every call is traced, cached and counted against the budget.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ai } from "@/lib/ai";
import { route } from "@/server/http";

export const maxDuration = 300;

const MEDIA = join(process.cwd(), "src/data/media.json");
const INDEX = join(process.cwd(), "src/data/mediaIndex.json");

export interface MediaNote {
  description: string;
  tags: string[];
  activities: string[];
  food: string[];
  vibe: string[];
  setting: "indoor" | "outdoor" | "mixed";
  timeOfDay: "day" | "golden hour" | "night" | "unclear";
  goodFor: string[];
  model: string;
  indexedAt: string;
  costUsd: number;
  mode: string;
}

const schema = {
  type: "object",
  properties: {
    description: { type: "string", description: "One or two plain sentences describing exactly what is visible." },
    tags: { type: "array", items: { type: "string" }, description: "5-8 short lowercase tags of visible things (e.g. neon signs, skyline, fried chicken)." },
    activities: { type: "array", items: { type: "string" }, description: "Activities someone could do here, lowercase (e.g. live music, hiking, people watching)." },
    food: { type: "array", items: { type: "string" }, description: "Any food or drink visible, lowercase. Empty if none." },
    vibe: { type: "array", items: { type: "string" }, description: "2-4 mood words (e.g. lively, quiet, touristy, scenic, gritty)." },
    setting: { type: "string", enum: ["indoor", "outdoor", "mixed"] },
    timeOfDay: { type: "string", enum: ["day", "golden hour", "night", "unclear"] },
    goodFor: { type: "array", items: { type: "string" }, description: "Which kinds of traveller would like this: pick from runners, foodies, music lovers, photographers, hikers, night owls, art people, budget travellers, thrifters, swimmers, cyclists, coffee people, families." },
  },
  required: ["description", "tags", "activities", "food", "vibe", "setting", "timeOfDay", "goodFor"],
};

export const POST = route(async (req) => {
  const force = req.nextUrl.searchParams.get("force") === "1";
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 0);
  const media = JSON.parse(readFileSync(MEDIA, "utf8")) as Record<string, { id: string; city: string; url: string; title: string }>;
  let index: Record<string, MediaNote> = {};
  try {
    index = JSON.parse(readFileSync(INDEX, "utf8"));
  } catch {
    /* first run */
  }
  const todo = Object.values(media).filter((m) => force || !index[m.id]);
  const batch = limit ? todo.slice(0, limit) : todo;
  let cost = 0;
  const done: string[] = [];
  const failed: string[] = [];
  // small concurrency; each call is one image
  for (let i = 0; i < batch.length; i += 4) {
    await Promise.all(
      batch.slice(i, i + 4).map(async (m) => {
        try {
          const { data, trace } = await ai.json<Omit<MediaNote, "model" | "indexedAt" | "costUsd" | "mode">>(
            `Look at this photo taken in ${m.city.replace("-", " ")}. Describe only what is actually visible; do not guess landmarks you cannot see. The file is titled "${m.title}".`,
            { task: "media.index", schema, images: [`/api/img?u=${encodeURIComponent(m.url)}`], maxTokens: 700, temperature: 0.2 },
          );
          index[m.id] = { ...data, model: trace.model, indexedAt: new Date().toISOString(), costUsd: trace.costUsd ?? 0, mode: trace.mode };
          cost += trace.costUsd ?? 0;
          done.push(m.id);
        } catch (e) {
          failed.push(`${m.id}: ${(e as Error).message}`);
        }
      }),
    );
    writeFileSync(INDEX, JSON.stringify(index, null, 2));
  }
  return { indexed: done.length, failed, skipped: Object.keys(media).length - batch.length, costUsd: Math.round(cost * 10000) / 10000, total: Object.keys(index).length };
});
