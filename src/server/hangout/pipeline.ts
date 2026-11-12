// Hang Again AI pipeline.
//   A  memory builder     Muse Ember   friend's shared items → places + inside jokes (verified in code)
//   C  why-now detector   Muse Wonder  new post/Reel + memory file + evidence → one small nudge, or none
//   D  guardrail filter   plain code   before C (blocked/resting never reach the model) and after it
//   E  critter designer   Muse Wonder  memory file → body/color/accessory from the parts library
//   F  plan proposer      Muse Wonder  shared places + both calendars + costs → plan (slot checked in code)
//   G  keepsake picker    Muse Wonder  meetup place → keepsake pin
import { CALENDARS, ME, PLACES, SLOTS } from "@/data/hangout/seed";
import { scenarioById } from "@/data/hangout/scenarios";
import { checkEvidence, sharedItems, type EvidenceItem } from "@/lib/hangout/evidence";
import { nudgeGuard, statusGuard } from "@/lib/hangout/guardrails";
import { verifyMemory } from "@/lib/hangout/memory";
import { ACCESSORIES, BODIES, COLORS, KEEPSAKES, keepsakeForKind } from "@/lib/hangout/parts";
import { CritterSchema, KeepsakeSchema, MemoryAiSchema, PlanSchema, softenDashes, WhyNowSchema, type CritterAi, type WhyNow } from "@/lib/hangout/schemas";
import { daysBetween } from "@/lib/hangout/sleep";
import type { CritterDesign, FeedPost, Nudge, Plan, ReelItem, Scenario } from "@/lib/hangout/types";
import { museJson, recordResponse, type HangMode, type MuseLog } from "./muse";
import { builtMemory, critterStateFor, evidenceIndex, firstName, friendById, hang, hid, memoryFile, pushAlert, pushRun, saveMemory, type PipelineRun, type RunStep } from "./store";

export interface RunOpts {
  mode?: HangMode;
  /** App runs fall back to the cache if the live call fails; evals don't. */
  fallbackToCache?: boolean;
  /** Save live responses that pass their checks to data/hangout/recorded.json. */
  record?: boolean;
}

const modeOf = (o: RunOpts) => o.mode ?? hang().aiMode;
const wasLive = (log: MuseLog) => log.mode === "live" && log.ok;
const newRun = (label: string, friendId?: string): PipelineRun => ({ id: hid("run"), at: new Date().toISOString(), label, friendId, steps: [], outcome: "", ok: false });
const museStep = (name: string, log: MuseLog): RunStep => ({ name, status: log.ok ? "ok" : "fail", detail: log.error, muse: log });

// ---------- shared prompt pieces ----------

function describe(e: EvidenceItem, first: string) {
  switch (e.kind) {
    case "photo":
      return `${e.id} | photo | ${e.date} | ${e.photo.place}${e.photo.caption ? ` | "${e.photo.caption}"` : ""}`;
    case "chat":
      return `${e.id} | chat | ${e.date} | ${e.chat.sender === ME.id ? "You" : first}: "${e.chat.text}"`;
    case "gathering":
      return `${e.id} | ${e.gathering.kind === "event" ? "event" : "group meetup"} | ${e.date} | ${e.gathering.name} at ${e.gathering.place}`;
    case "post":
      return `${e.id} | post | ${e.date} | ${first}: "${e.post.text}"`;
    case "reel":
      return `${e.id} | reel | ${e.date} | ${first}: "${e.reel.caption}"`;
  }
}

function memorySummary(m: { sharedPlaces: { name: string; count: number; firstDate: string; lastDate: string }[]; insideJokes: { phrase: string; sourceIds: string[] }[] }) {
  const places = m.sharedPlaces.length ? m.sharedPlaces.map((p) => `${p.name} (${p.count} photo${p.count > 1 ? "s" : ""} together, ${p.firstDate} to ${p.lastDate})`).join("; ") : "none";
  const jokes = m.insideJokes.length ? m.insideJokes.map((j) => `"${j.phrase}" (${j.sourceIds.length} sources: ${j.sourceIds.join(", ")})`).join("; ") : "none";
  return `Shared places: ${places}\nInside jokes: ${jokes}`;
}

export function slotLabel(slotId: string, demoDate = hang().demoDate) {
  const s = SLOTS.find((x) => x.id === slotId);
  if (!s) return slotId;
  const d = new Date(`${demoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + s.dayOffset);
  return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })} · ${s.hours}`;
}

// ---------- A + E: memory builder and critter designer ----------

const MEMORY_SYSTEM = `You build a private memory file of one friendship from the user's own tagged photos, events and opted-in chats. Use only the items provided and copy their IDs exactly. Never guess anyone's mood, health or feelings.`;

export async function buildMemory(friendId: string, opts: RunOpts = {}) {
  const mode = modeOf(opts);
  const f = friendById(friendId);
  const run = newRun(`Rebuild memory: ${f ? firstName(f.name) : friendId}`, friendId);
  if (!f || f.isBlocked) {
    run.steps.push({ name: "Skip", status: "skip", detail: "blocked: never processed" });
    run.outcome = "skipped";
    return pushRun(run);
  }
  const first = firstName(f.name);
  const index = evidenceIndex();
  const items = sharedItems(index, friendId).filter((e) => e.kind !== "post" && e.kind !== "reel");
  const prompt = `FRIEND: ${f.name} (${first}). The user is "You".

ITEMS (photos you're both tagged in, events you both went to, and your opted-in 1:1 chat):
${items.map((e) => describe(e, first)).join("\n")}

Return:
- sharedPlaces: every place you two have photos at together, with the photo IDs taken there.
- insideJokes: running jokes or phrases that come back in at least 2 different items. Quote the phrase as written and cite every item it appears in. Return [] if there are none. Don't stretch.`;

  const a = await museJson({ task: "hangout.memory", model: "ember", schema: MemoryAiSchema, system: MEMORY_SYSTEM, prompt, cacheKey: `memory:${friendId}`, mode, fallbackToCache: opts.fallbackToCache, temperature: 0.1 });
  run.steps.push(museStep("A · Memory builder (Muse Ember)", a.log));
  if (!a.data) {
    run.outcome = "memory build failed; kept the previous memory file";
    return pushRun(run);
  }
  const v = verifyMemory(a.data, friendId, index);
  run.steps.push({ name: "Evidence check", status: v.dropped.length ? "info" : "ok", detail: v.dropped.length ? `dropped ${v.dropped.length} IDs that weren't shared: ${v.dropped.join(", ")}` : `${v.sharedPlaces.length} places, ${v.insideJokes.length} inside jokes, all IDs verified` });
  if (opts.record !== false && wasLive(a.log)) recordResponse(`memory:${friendId}`, a.raw, { model: a.log.modelId, latencyMs: a.log.latencyMs });

  const e = await designCritter(friendId, v, opts);
  run.steps.push(e.step);
  saveMemory(friendId, { sharedPlaces: v.sharedPlaces, insideJokes: v.insideJokes, critter: e.design, source: wasLive(a.log) ? "live" : "cached", model: a.log.modelId, builtAt: new Date().toISOString() });
  run.ok = true;
  run.outcome = `memory file saved (${v.sharedPlaces.map((p) => `${p.name} ×${p.count}`).join(", ") || "no places"})`;
  return pushRun(run);
}

const CRITTER_SYSTEM = `You design a small friendship critter from a fixed parts library. Pick IDs only from the lists. Base every pick on this friendship's specific shared places or inside jokes. Write one short line on why (max 14 words) that names the place or joke. No em-dashes.`;

export async function designCritter(friendId: string, mem: Parameters<typeof memorySummary>[0], opts: RunOpts = {}): Promise<{ design: Omit<CritterDesign, "keepsakes">; step: RunStep }> {
  const f = friendById(friendId)!;
  const prompt = `FRIEND: ${f.name}
${memorySummary(mem)}

BODIES: ${BODIES.map((b) => `${b.id} (${b.hint})`).join("; ")}
COLORS: ${COLORS.map((c) => c.id).join(", ")}
ACCESSORIES: ${ACCESSORIES.map((a) => `${a.id} (${a.hint})`).join("; ")}`;
  const r = await museJson({ task: "hangout.critter", model: "wonder", schema: CritterSchema, system: CRITTER_SYSTEM, prompt, cacheKey: `critter:${friendId}`, mode: modeOf(opts), fallbackToCache: opts.fallbackToCache, temperature: 0.7 });
  if (opts.record !== false && wasLive(r.log)) recordResponse(`critter:${friendId}`, r.raw, { model: r.log.modelId, latencyMs: r.log.latencyMs });
  const fallback: CritterAi = { body: "blob", color: COLORS[friendId.length % COLORS.length].id, accessory: "none", why: "A fresh critter for a new friendship." };
  return { design: r.data ?? fallback, step: museStep("E · Critter designer (Muse Wonder)", r.log) };
}

export async function rebuildAllMemory(opts: RunOpts = {}) {
  const runs: PipelineRun[] = [];
  for (const f of hang().friends.filter((x) => !x.isBlocked && x.isFriend)) runs.push(await buildMemory(f.id, opts));
  return runs;
}

// ---------- C + D: why-now detector and guardrail filter ----------

export const WHY_NOW_SYSTEM = `You help someone reconnect with a friend by linking the friend's new activity to their real shared history. Only use the evidence items provided and cite their IDs. Write one casual line, max 20 words, no em-dashes. Never guess anyone's mood, health or feelings. If the connection isn't specific and real, return nudge: false.

Details:
- Write the reason to the user ("you"), calling the friend by first name. Example: "Maya's back at Ramen Ya. You two came here 9 times junior year."
- type: "place" when the new activity is at a place you've been together; "joke" when it touches a running inside joke; "life_update" for big news that makes hanging out newly possible (like moving to your city); "drift" only if none fit.
- action: "send_photo" when one of your shared photos fits (set photoId to a cited photo ID), "say_hi", or "suggest_plan" (good for life updates).
- evidenceIds: the IDs from SHARED HISTORY that prove the link (1 to 10). Never cite the new activity's own ID. Never invent IDs.
- Generic overlap (everyone eats lunch, everyone likes memes) is not a connection. A recent real chat means a nudge is rarely needed.
- When nudge is false: type null, action null, reason "", evidenceIds [], photoId null.`;

export type WhyNowOutcome = "nudge" | "no_nudge" | "filtered" | "rejected" | "failed";
export interface WhyNowResult {
  outcome: WhyNowOutcome;
  reason?: string;
  nudge?: Nudge;
  model?: WhyNow | null;
  run: PipelineRun;
}

function triggerText(s: Scenario) {
  const it = s.trigger.item;
  if (s.trigger.kind === "reel") {
    const r = it as ReelItem;
    return `Reel: "${r.caption}" (topics: ${r.topicTags.join(", ")})`;
  }
  const p = it as FeedPost;
  return `${s.trigger.kind === "life_update" ? "Life update" : "Post"}: "${p.text}"${p.place ? ` · at ${p.place}` : ""}`;
}

export async function runWhyNow(scenarioId: string, opts: RunOpts & { tamper?: (w: WhyNow) => WhyNow } = {}): Promise<WhyNowResult> {
  const sc = scenarioById(scenarioId);
  if (!sc) throw Object.assign(new Error(`Unknown scenario ${scenarioId}`), { status: 404 });
  const s = hang();
  const mode = modeOf(opts);
  const f = friendById(sc.friendId);
  const run = newRun(sc.label, sc.friendId);
  const finish = (outcome: WhyNowOutcome, reason: string, extra: Partial<WhyNowResult> = {}): WhyNowResult => {
    run.outcome = outcome === "nudge" ? "nudge shown" : `${outcome.replace("_", " ")}: ${reason}`;
    run.ok = outcome === "nudge" || outcome === "no_nudge" || outcome === "filtered";
    pushRun(run);
    return { outcome, reason, run, ...extra };
  };

  // The friend's new activity lands in their feed regardless of what Muse does.
  const item = { ...sc.trigger.item, date: s.demoDate };
  if (sc.trigger.kind === "reel") s.reels = [...s.reels.filter((r) => r.id !== item.id), item as ReelItem];
  else s.posts = [...s.posts.filter((p) => p.id !== item.id), item as FeedPost];
  run.steps.push({ name: "Trigger", status: "info", detail: `${f ? firstName(f.name) : sc.friendId} · ${triggerText(sc)}` });

  // D (before C): blocked, unfriended, resting and outside-circle people never reach the model.
  const pre = statusGuard(f);
  if (!pre.ok) {
    run.steps.push({ name: "D · Guardrail (before model)", status: "fail", detail: `${pre.reason}: not sent to the model` });
    return finish("filtered", pre.reason);
  }
  run.steps.push({ name: "D · Guardrail (before model)", status: "ok", detail: "close friend, not blocked or resting" });

  const first = firstName(f!.name);
  const mem = memoryFile(f!.id);
  const { state, sleep } = critterStateFor(f!.id);
  const index = evidenceIndex();
  const items = sharedItems(index, f!.id).filter((e) => e.id !== item.id);
  const contact = sleep.lastRealContact
    ? `Last real contact ${sleep.lastRealContact.date} (${sleep.daysSince} days ago); last two-way chat ${sleep.lastTwoWayChat?.date ?? "never"}. Usual rhythm: about every ${sleep.rhythmDays} days. Critter is ${state}.`
    : "No real contact on record.";
  const prompt = `FRIEND: ${f!.name} (first name ${first})
CONTACT: ${contact}

NEW ACTIVITY (id ${item.id}, ${item.date}):
${triggerText(sc)}

MEMORY FILE:
${mem ? memorySummary(mem) : "none"}

SHARED HISTORY (cite only these IDs):
${items.map((e) => describe(e, first)).join("\n")}`;

  const c = await museJson({ task: "hangout.whyNow", model: "wonder", schema: WhyNowSchema, system: WHY_NOW_SYSTEM, prompt, cacheKey: `whyNow:${sc.id}`, mode, fallbackToCache: opts.fallbackToCache, temperature: 0.3 });
  run.steps.push(museStep("C · Why-now (Muse Wonder)", c.log));
  if (!c.data) return finish("failed", c.log.error ?? "model failed safe", { model: null });

  const out = opts.tamper ? opts.tamper(c.data) : c.data;
  if (opts.tamper) run.steps.push({ name: "Tamper (eval)", status: "info", detail: `evidenceIds → ${out.evidenceIds.join(", ")}` });
  const record = () => {
    if (opts.record !== false && !opts.tamper && wasLive(c.log)) recordResponse(`whyNow:${sc.id}`, c.raw, { model: c.log.modelId, latencyMs: c.log.latencyMs });
  };
  if (!out.nudge) {
    run.steps.push({ name: "Evidence check", status: "skip", detail: "model returned nudge: false" });
    if (sc.expect.outcome === "no_nudge") record();
    return finish("no_nudge", "model found no specific link", { model: out });
  }

  const ev = checkEvidence(out, f!.id, index, { triggerId: item.id });
  if (!ev.ok) {
    run.steps.push({ name: "Evidence check", status: "fail", detail: `${ev.reason}${ev.badIds.length ? `: ${ev.badIds.join(", ")}` : ""}` });
    return finish("rejected", ev.reason, { model: out });
  }
  run.steps.push({ name: "Evidence check", status: "ok", detail: `${ev.evidenceIds.length} cited IDs exist and include you both` });

  const post = nudgeGuard(f, out, s.nudges, s.demoDate);
  if (!post.ok) {
    run.steps.push({ name: "D · Guardrail (after model)", status: "fail", detail: `${post.reason}${post.detail ? ` (${post.detail})` : ""}` });
    return finish("filtered", post.reason, { model: out });
  }
  run.steps.push({ name: "D · Guardrail (after model)", status: "ok", detail: "under the daily cap, no mood or health words" });

  const nudge: Nudge = {
    id: hid("ndg"),
    friendId: f!.id,
    type: out.type!,
    reason: softenDashes(out.reason).trim(),
    evidenceIds: ev.evidenceIds,
    action: out.action!,
    photoId: out.action === "send_photo" ? (out.photoId ?? undefined) : undefined,
    triggerId: item.id,
    createdAt: s.demoDate,
    status: "shown",
  };
  s.nudges.unshift(nudge);
  pushAlert({ kind: "nudge", friendId: f!.id, title: "Muse", body: nudge.reason, href: `/friends/hangout?nudge=${nudge.id}` });
  if (sc.expect.outcome === "nudge" && sc.expect.type === nudge.type) record();
  return finish("nudge", nudge.reason, { nudge, model: out });
}

/** Did a why-now run do what the scenario expects? Shared by the eval and the debug drawer. */
export function grade(sc: Scenario, r: WhyNowResult): { pass: boolean; note: string } {
  const e = sc.expect;
  if (e.outcome === "nudge") {
    if (r.outcome !== "nudge" || !r.nudge) return { pass: false, note: `expected a ${e.type} nudge, got ${r.outcome}${r.reason ? ` (${r.reason})` : ""}` };
    if (r.nudge.type !== e.type) return { pass: false, note: `expected type ${e.type}, got ${r.nudge.type}` };
    if (e.mustCite && !r.nudge.evidenceIds.some((id) => e.mustCite!.includes(id))) return { pass: false, note: `didn't cite any of ${e.mustCite.join(", ")}` };
    return { pass: true, note: `"${r.nudge.reason}" [${r.nudge.evidenceIds.join(", ")}]` };
  }
  if (e.outcome === "no_nudge") {
    if (r.outcome === "nudge") return { pass: false, note: `expected no nudge, got "${r.nudge?.reason}"` };
    if (r.outcome === "failed") return { pass: false, note: `model call failed: ${r.reason}` };
    return { pass: true, note: r.outcome === "no_nudge" ? "model said no" : `caught by ${r.outcome === "rejected" ? "evidence check" : "guardrail"}: ${r.reason}` };
  }
  if (r.outcome === "filtered" && r.reason === e.reason) return { pass: true, note: `filtered (${r.reason}) before the model` };
  return { pass: false, note: `expected filtered (${e.reason}), got ${r.outcome}${r.reason ? ` (${r.reason})` : ""}` };
}

// ---------- F: plan proposer ----------

const PLAN_SYSTEM = `You suggest one small, low-cost plan for two friends. Pick a place from PLACES (prefer one from their shared history) and one slot ID that is free for BOTH people. Copy the cost from PLACES. Write one casual reason, max 18 words, no em-dashes. Don't mention anyone's mood or feelings.`;

export async function proposePlan(friendId: string, opts: RunOpts = {}): Promise<{ plan: Plan | null; run: PipelineRun }> {
  const s = hang();
  const f = friendById(friendId);
  if (!f || f.isBlocked) throw Object.assign(new Error("Not found"), { status: 404 });
  const run = newRun(`Plan with ${firstName(f.name)}`, friendId);
  const mine = CALENDARS.find((c) => c.personId === ME.id)?.free ?? [];
  const theirs = CALENDARS.find((c) => c.personId === friendId)?.free ?? [];
  const mutual = SLOTS.filter((sl) => mine.includes(sl.id) && theirs.includes(sl.id)).map((sl) => sl.id);
  if (!mutual.length) {
    run.steps.push({ name: "Calendars", status: "fail", detail: "no shared free time this week" });
    run.outcome = "no plan: no shared free time";
    return { plan: null, run: pushRun(run) };
  }
  const mem = builtMemory(friendId);
  const basePrompt = `FRIEND: ${f.name}
SHARED PLACES: ${mem?.sharedPlaces.map((p) => `${p.name} (${p.count}x)`).join(", ") || "none yet"}
PLACES (name · cost per person): ${PLACES.map((p) => `${p.name} · $${p.costPerPerson}`).join("; ")}
SLOTS: ${SLOTS.map((sl) => `${sl.id} = ${slotLabel(sl.id)}`).join("; ")}
YOU ARE FREE: ${mine.join(", ")}
${firstName(f.name).toUpperCase()} IS FREE: ${theirs.join(", ")}`;

  let r = await museJson({ task: "hangout.plan", model: "wonder", schema: PlanSchema, system: PLAN_SYSTEM, prompt: basePrompt, cacheKey: `plan:${friendId}`, mode: modeOf(opts), fallbackToCache: opts.fallbackToCache, temperature: 0.5 });
  run.steps.push(museStep("F · Plan proposer (Muse Wonder)", r.log));
  if (r.data && !mutual.includes(r.data.slotId)) {
    run.steps.push({ name: "Slot check", status: "fail", detail: `${r.data.slotId} isn't free for both. Retrying once.` });
    r = await museJson({ task: "hangout.plan", model: "wonder", schema: PlanSchema, system: PLAN_SYSTEM, prompt: `${basePrompt}\n\nYour last pick (${r.data.slotId}) isn't free for both. Free for both: ${mutual.join(", ")}.`, cacheKey: `plan:${friendId}`, mode: modeOf(opts), fallbackToCache: opts.fallbackToCache, temperature: 0.3 });
    run.steps.push(museStep("F · Plan proposer, retry", r.log));
  }
  const ai = r.data;
  let slotId = ai?.slotId ?? "";
  if (!mutual.includes(slotId)) {
    slotId = mutual[0];
    run.steps.push({ name: "Slot check", status: "info", detail: `fell back to the first mutual free slot: ${slotId}` });
  } else run.steps.push({ name: "Slot check", status: "ok", detail: `${slotId} is free for both` });
  const placeFromShared = mem?.sharedPlaces.map((p) => PLACES.find((x) => x.name === p.name)).find(Boolean);
  const place = PLACES.find((p) => p.name === ai?.place) ?? placeFromShared ?? PLACES[0];
  if (place.name !== ai?.place) run.steps.push({ name: "Place check", status: "info", detail: `"${ai?.place ?? "none"}" isn't in the places list; using ${place.name}` });
  if (ai && ai.estCostPerPerson !== place.costPerPerson) run.steps.push({ name: "Cost check", status: "info", detail: `model said $${ai.estCostPerPerson}, places list says $${place.costPerPerson}` });

  const plan: Plan = { friendId, place: place.name, slotId, dayTime: slotLabel(slotId), estCostPerPerson: place.costPerPerson, reason: ai?.reason ?? `You're both free ${slotLabel(slotId)}.`, confirmedBy: [] };
  if (opts.record !== false && wasLive(r.log) && ai && mutual.includes(ai.slotId)) recordResponse(`plan:${friendId}`, r.raw, { model: r.log.modelId, latencyMs: r.log.latencyMs });
  s.plans[friendId] = plan;
  run.ok = true;
  run.outcome = `${plan.place} · ${plan.dayTime} · $${plan.estCostPerPerson}`;
  return { plan, run: pushRun(run) };
}

// ---------- G: keepsake picker ----------

const KEEPSAKE_SYSTEM = `Pick one keepsake pin for a meetup from the library, matching the place. Return its ID and a playful line, max 8 words.`;

export async function pickKeepsake(friendId: string, placeName: string, opts: RunOpts = {}) {
  const run = newRun(`Keepsake for ${placeName}`, friendId);
  const place = PLACES.find((p) => p.name === placeName);
  const prompt = `MEETUP PLACE: ${placeName}${place ? ` (${place.kind})` : ""}\nPINS: ${KEEPSAKES.map((k) => `${k.id} (${k.label})`).join("; ")}`;
  const r = await museJson({ task: "hangout.keepsake", model: "wonder", schema: KeepsakeSchema, system: KEEPSAKE_SYSTEM, prompt, cacheKey: `keepsake:${placeName}`, mode: modeOf(opts), fallbackToCache: opts.fallbackToCache, temperature: 0.4 });
  run.steps.push(museStep("G · Keepsake picker (Muse Wonder)", r.log));
  if (opts.record !== false && wasLive(r.log)) recordResponse(`keepsake:${placeName}`, r.raw, { model: r.log.modelId, latencyMs: r.log.latencyMs });
  const pin = r.data?.pin ?? keepsakeForKind(place?.kind ?? "");
  if (!r.data) run.steps.push({ name: "Fallback", status: "info", detail: `picked ${pin} from the place type` });
  run.ok = true;
  run.outcome = `${pin}${r.data?.why ? `: ${r.data.why}` : ""}`;
  pushRun(run);
  return { pin, why: r.data?.why };
}

export const daysAgo = (date: string) => daysBetween(date, hang().demoDate);
