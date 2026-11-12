// Guide: for a chosen trip, read friends' posts/photos/Reels from that city (with the stored Muse image notes),
// look at one or two photos live with Muse's image understanding, and produce recommendations matched to the
// viewer's taste, each credited to the friend it came from. Every credit/evidence id is validated in code.
import { mediaIdForUrl, mediaIndex } from "@/data/travel";
import { ai, type ToolDef, type TraceStep } from "@/lib/ai";
import { db, getUser } from "@/server/db";
import type { ID } from "@/types";
import { findGuideRecording, forceReplay, replaySteps } from "./replay";
import { getTrip, travelStore, type StreamStep } from "./store";
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tasteFor } from "./taste";
import { cityMediaFor, cityName, getMyTravelProfile } from "./tools";
import type { Trip } from "./validate";
import { canSeePost, canSeeReel, connection } from "./visibility";

export interface GuideItem {
  title: string;
  what: string;
  whyYou: string;
  tasteTags: string[];
  priceHint?: string;
  credit: { id: ID; name: string; avatar: string; connection: string };
  evidence: { kind: "post" | "reel"; id: string; authorId: ID; image?: string; caption: string; sawLive?: string };
  when?: string;
}
export interface Guide {
  tripId: string;
  intro: string;
  items: GuideItem[];
  looked: { mediaId?: string; image: string; author: string; saw: string; costUsd: number; mode: string }[];
  steps: StreamStep[];
  mode: string;
  costUsd: number;
  latencyMs: number;
  model: string;
  createdAt: string;
}

const GUIDE_SCHEMA = {
  type: "object",
  properties: {
    intro: { type: "string", description: "One or two sentences to the user about what their people know about this city, in the house voice." },
    items: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short name of the place or thing, e.g. 'pearl at dusk' or 'the $4.50 banh mi'." },
          what: { type: "string", description: "What it is and what to do there, one or two sentences, concrete." },
          whyYou: { type: "string", description: "Why THIS user, tied to their taste or a Reel they saved." },
          tasteTags: { type: "array", items: { type: "string" }, description: "1-3 of the user's taste keys this matches." },
          priceHint: { type: "string", description: "Price or 'free' if a post mentioned it; omit otherwise." },
          creditId: { type: "string", description: "User id of the friend whose post/Reel this came from. Must be that post's author." },
          evidenceKind: { type: "string", enum: ["post", "reel"] },
          evidenceId: { type: "string", description: "The post or reel id this came from (from get_city_media)." },
          when: { type: "string", description: "Suggested slot like 'saturday golden hour' or 'sunday morning', optional." },
        },
        required: ["title", "what", "whyYou", "tasteTags", "creditId", "evidenceKind", "evidenceId"],
      },
    },
  },
  required: ["intro", "items"],
};
type Proposed = { intro: string; items: { title: string; what: string; whyYou: string; tasteTags: string[]; priceHint?: string; creditId: string; evidenceKind: "post" | "reel"; evidenceId: string; when?: string }[] };

const SYSTEM = `You build a short, personal city guide inside a Facebook-style app, using ONLY what the user's friends posted from that city. The user is about to visit people they know; the guide should feel like those friends talking.
Plan, few round trips:
1. get_my_travel_profile for taste, and get_city_media for the trip's city (one turn).
2. look_at_photo on the 1–2 most promising photos whose notes are thin or whose details matter (a dish, a sign, a trail). This is real image understanding; use what it returns.
3. propose_guide exactly once with 4–6 recommendations. Each one must come from a specific post or Reel (evidenceId) and be credited to its author (creditId = that post's authorId). Match to the user's taste; say why. Include prices or "free" when a caption mentions them. Prefer the host's and close friends' posts. Never invent places that no post mentions.
Voice: a sharp friend texting. lowercase-leaning, concrete, warm, short.`;

export function lookAtPhotoTool(viewerId: ID, city: string, record: (x: Guide["looked"][number]) => void): ToolDef<{ mediaRef: string; question?: string }> {
  return {
    name: "look_at_photo",
    description: "Look at one of the friends' photos with image understanding and answer a question about it (what's the dish, what's the vibe, is it crowded, what does the sign say). Pass the post or reel id.",
    parameters: { type: "object", properties: { mediaRef: { type: "string", description: "post id or reel id from get_city_media" }, question: { type: "string" } }, required: ["mediaRef"] },
    run: async ({ mediaRef, question }) => {
      const item = cityMediaFor(viewerId, city, 60).find((m) => m.id === mediaRef);
      if (!item) return { error: "not one of the photos you can see" };
      const { text, trace } = await ai.text(`${question ?? "What exactly is in this photo, and what would a visitor want to know about it?"} Answer in 2 short sentences, concrete, no guessing beyond what is visible. Caption the friend wrote: "${item.caption}"`, { task: "travel.guide.look", userId: viewerId, images: [item.image], maxTokens: 700, temperature: 0.2, cache: true, mock: () => `(mock) ${item.note?.description ?? "a photo from " + cityName(city)}` });
      record({ mediaId: item.mediaId, image: item.image, author: item.author, saw: text, costUsd: trace.costUsd ?? 0, mode: trace.mode });
      return { author: item.author, caption: item.caption, saw: text, mode: trace.mode };
    },
  };
}

export function describeGuideStep(s: TraceStep, city: string): Omit<StreamStep, "i" | "at"> | null {
  const a = (s.args ?? {}) as Record<string, unknown>;
  const r = (s.result ?? {}) as Record<string, unknown>;
  if (s.type === "model") return { kind: "model", text: "Deciding what to read next", detail: `${s.latencyMs} ms` };
  if (s.type === "tool_call") {
    switch (s.name) {
      case "get_my_travel_profile": return { kind: "tool", tool: s.name, text: "Reading your taste from saved Reels and likes" };
      case "get_city_media": return { kind: "tool", tool: s.name, text: `Reading your friends' posts and Reels from ${cityName(city)}` };
      case "look_at_photo": return { kind: "tool", tool: s.name, text: `Looking closely at a photo${a.question ? `: ${String(a.question).slice(0, 60)}` : ""}`, ids: [String(a.mediaRef)] };
      case "propose_guide": return { kind: "tool", tool: s.name, text: `Writing ${(a.items as unknown[] | undefined)?.length ?? 0} recommendations, each credited to a friend` };
    }
  }
  if (s.type === "tool_result") {
    if (r.error) return { kind: "result", tool: s.name, text: `That didn't work: ${String(r.error).slice(0, 80)}` };
    switch (s.name) {
      case "get_my_travel_profile": return { kind: "result", tool: s.name, text: `You're ${r.tasteSummary}` };
      case "get_city_media": {
        const items = (r.items ?? []) as { author: string }[];
        const by = new Map<string, number>();
        items.forEach((i) => by.set(i.author.split(" ")[0], (by.get(i.author.split(" ")[0]) ?? 0) + 1));
        return { kind: "result", tool: s.name, text: `${items.length} photo${items.length === 1 ? "" : "s"} and captions from ${[...by.keys()].slice(0, 4).join(", ")}${by.size > 4 ? ` +${by.size - 4}` : ""}` };
      }
      case "look_at_photo": return { kind: "result", tool: s.name, text: `Muse saw: ${String(r.saw ?? "").slice(0, 140)}`, detail: `${r.author}'s photo · ${r.mode === "live" ? "live image understanding" : r.mode}` };
      case "propose_guide": return null;
    }
  }
  return null;
}

export async function buildGuide(viewerId: ID, tripId: string, onStep?: (s: StreamStep) => void): Promise<Guide> {
  const trip = getTrip(tripId);
  if (!trip || trip.viewerId !== viewerId) throw Object.assign(new Error("Trip not found"), { status: 404 });
  const cached = travelStore().guides.get(tripId) as Guide | undefined;
  if (cached) {
    cached.steps.forEach((s) => onStep?.(s));
    return cached;
  }
  const t0 = Date.now();
  const steps: StreamStep[] = [];
  const push = (s: Omit<StreamStep, "i" | "at">) => {
    const full: StreamStep = { ...s, i: steps.length, at: Date.now() - t0 };
    steps.push(full);
    onStep?.(full);
  };
  const looked: Guide["looked"] = [];
  let proposed: Proposed | undefined;
  const proposeGuide: ToolDef<Proposed> = { name: "propose_guide", description: "Submit the finished guide. Call exactly once.", parameters: GUIDE_SCHEMA, run: (p) => ((proposed = p), { ok: true }) };
  const tools: ToolDef[] = [getMyTravelProfile as ToolDef, cityMediaTool(trip) as ToolDef, lookAtPhotoTool(viewerId, trip.city, (x) => looked.push(x)) as ToolDef, proposeGuide as ToolDef];
  const taste = tasteFor(viewerId);
  push({ kind: "info", text: `Building your ${trip.cityName} guide from what ${[trip.host, ...trip.people].filter(Boolean).slice(0, 2).map((p) => p!.name.split(" ")[0]).join(" and ") || "your friends"} posted` });

  const replay = async (why: string): Promise<Guide | null> => {
    const rec = findGuideRecording(viewerId, trip.city);
    if (!rec) return null;
    push({ kind: "info", text: why });
    await replaySteps(rec.steps.filter((s) => s.kind !== "info" || !/^Building/.test(s.text)), (s) => push({ ...s }));
    // credits/evidence re-validated against what THIS viewer can see
    const visibleIds = new Set(cityMediaFor(viewerId, trip.city, 80).map((m) => m.id));
    const items = rec.items.filter((it) => visibleIds.has(it.evidence.id));
    const guide: Guide = { ...rec, tripId, items, steps, mode: "replay", costUsd: 0, latencyMs: Date.now() - t0, createdAt: new Date().toISOString() };
    push({ kind: "done", text: `${items.length} picks (replayed from a real run)`, detail: `${(guide.latencyMs / 1000).toFixed(1)}s · replay` });
    travelStore().guides.set(tripId, guide);
    return guide;
  };
  if (forceReplay()) {
    const g = await replay("Replay mode is on: replaying a recorded guide");
    if (g) return g;
  }
  const res = await ai.tools(
    `Build my guide for ${trip.cityName} (${trip.city}), ${trip.start} to ${trip.end}. I'm staying with ${trip.host ? trip.host.name + " (" + trip.host.connection + ")" : "nobody in particular (hostel)"}${trip.people.length ? `; also there: ${trip.people.map((p) => p.name).join(", ")}` : ""}. My budget for the whole trip is about $${trip.budget}. My taste: ${taste.summary}. My user id is "${viewerId}".`,
    { task: "travel.guide", userId: viewerId, tools, system: SYSTEM, maxSteps: 7, maxTokens: 2200, temperature: 0.5, stopOnTool: "propose_guide", onStep: (s) => { const d = describeGuideStep(s, trip.city); if (d) push(d); }, mock: () => "(mock)" },
  );
  if (res.trace.fallback) {
    const g = await replay(res.trace.fallback === "budget" ? "Budget guard: replaying a recorded guide" : "Muse didn't answer, replaying a recorded guide");
    if (g) return g;
  }
  if (!proposed) proposed = mockGuide(viewerId, trip);
  push({ kind: "info", text: "Checking every credit against the real author and what you can see" });
  const items: GuideItem[] = [];
  const media = cityMediaFor(viewerId, trip.city, 80);
  for (const it of proposed.items ?? []) {
    const ev = media.find((m) => m.id === it.evidenceId && m.kind === it.evidenceKind) ?? media.find((m) => m.id === it.evidenceId);
    if (!ev) continue; // evidence must be visible to this viewer
    const visible = ev.kind === "post" ? canSeePost(viewerId, db().posts.find((p) => p.id === ev.id)!) : canSeeReel(viewerId, db().reels.find((r) => r.id === ev.id)!);
    if (!visible) continue;
    const author = getUser(ev.authorId)!; // credit is forced to the real author, whatever the model said
    const saw = looked.find((l) => l.image === ev.image)?.saw;
    items.push({ title: it.title, what: it.what, whyYou: it.whyYou, tasteTags: (it.tasteTags ?? []).slice(0, 3), priceHint: it.priceHint, when: it.when, credit: { id: author.id, name: author.name, avatar: author.avatar, connection: connection(viewerId, author.id)?.label ?? (author.id === viewerId ? "you" : "public post") }, evidence: { kind: ev.kind, id: ev.id, authorId: ev.authorId, image: ev.image, caption: ev.caption, sawLive: saw } });
  }
  const dropped = (proposed.items?.length ?? 0) - items.length;
  if (dropped) push({ kind: "info", text: `Dropped ${dropped} recommendation${dropped === 1 ? "" : "s"} that didn't trace to a post you can see` });
  const guide: Guide = { tripId, intro: proposed.intro ?? "", items, looked, steps, mode: res.trace.mode, costUsd: (res.trace.costUsd ?? 0) + looked.reduce((n, l) => n + l.costUsd, 0), latencyMs: Date.now() - t0, model: res.trace.model, createdAt: new Date().toISOString() };
  push({ kind: "done", text: `${items.length} picks, credited to ${new Set(items.map((i) => i.credit.name)).size} friend${new Set(items.map((i) => i.credit.name)).size === 1 ? "" : "s"}`, detail: `${(guide.latencyMs / 1000).toFixed(1)}s · ${guide.mode}${guide.costUsd ? ` · $${guide.costUsd.toFixed(3)}` : ""}` });
  travelStore().guides.set(tripId, guide);
  try {
    const dir = process.env.AI_RUNS_DIR ?? join(process.cwd(), ".ai-runs");
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, "guides.jsonl"), JSON.stringify({ ...guide, city: trip.city, viewerId }) + "\n");
  } catch {
    /* optional */
  }
  return guide;
}

/** get_city_media bound to the trip's city, so the model can't wander. */
function cityMediaTool(trip: Trip): ToolDef<{ limit?: number }> {
  return {
    name: "get_city_media",
    description: `Your friends' posts, photos and Reels from ${trip.cityName}, each with what Muse saw in the photo. Only content you can already see.`,
    parameters: { type: "object", properties: { limit: { type: "integer" } } },
    run: ({ limit }, { userId }) => {
      const items = cityMediaFor(userId, trip.city, limit ?? 30);
      return { city: trip.city, cityName: trip.cityName, count: items.length, items };
    },
  };
}

function mockGuide(viewerId: ID, trip: Trip): Proposed {
  const media = cityMediaFor(viewerId, trip.city, 6).filter((m) => m.note);
  return {
    intro: `(mock) here's what your people posted from ${trip.cityName}.`,
    items: media.slice(0, 4).map((m) => ({ title: (m.note!.tags[0] ?? "a spot").toLowerCase(), what: m.note!.description, whyYou: `you're into ${m.note!.goodFor.slice(0, 2).join(" and ")}`, tasteTags: m.note!.goodFor.slice(0, 2), creditId: m.authorId, evidenceKind: m.kind, evidenceId: m.id })),
  };
}

/** For the eval: which media id does a guide item point at. */
export const guideItemMediaId = (g: GuideItem) => (g.evidence.image ? mediaIdForUrl(g.evidence.image) : undefined);
export const noteFor = (mediaId?: string) => (mediaId ? mediaIndex[mediaId] : undefined);
