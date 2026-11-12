// View models for the Hangout screens and the demo panel. Blocked friends never appear in any of these.
import { CALENDARS, GATHERINGS, ME } from "@/data/hangout/seed";
import { SCENARIOS } from "@/data/hangout/scenarios";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { artCaption } from "@/lib/hangout/art";
import type { EvidenceItem } from "@/lib/hangout/evidence";
import type { CritterState, Friend, Nudge } from "@/lib/hangout/types";
import { hasKey, museModelId, recordedKeys } from "./muse";
import { slotLabel } from "./pipeline";
import { builtMemory, critterStateFor, evidenceIndex, firstName, friendById, hang, memoryStore, photoById, visibleFriends } from "./store";
import { daysBetween } from "@/lib/hangout/sleep";

const notFound = () => Object.assign(new Error("Not found"), { status: 404 });

/** Muse Image critter art for this friend, if it's been drawn (public/seed/critters/art). Falls back to SVG parts. */
const ART_DIR = "/seed/critters/art";
export const critterArt = (friendId: string) => (existsSync(join(process.cwd(), "public", ART_DIR, `${friendId}.webp`)) ? `${ART_DIR}/${friendId}.webp` : undefined);

export function critterCard(f: Friend) {
  const s = hang();
  const { state, sleep } = critterStateFor(f.id);
  const mem = builtMemory(f.id);
  const design = s.critters[f.id] ?? mem?.critter ?? { body: "blob", color: "sky", accessory: "none" };
  return {
    friendId: f.id,
    name: f.name,
    first: firstName(f.name),
    avatar: f.avatarPhoto,
    state,
    design: { ...design, keepsakes: s.keepsakes[f.id] ?? [], image: critterArt(f.id) },
    daysSince: sleep.daysSince,
    rhythmDays: sleep.rhythmDays,
    lastTwoWayChat: sleep.lastTwoWayChat?.date ?? null,
  };
}
export type CritterCard = ReturnType<typeof critterCard>;

const WORDS: Record<"critters" | "plants", Record<CritterState, string>> = {
  critters: { awake: "awake", sleepy: "a little sleepy", napping: "napping", celebrating: "celebrating", resting: "resting", egg: "egg", hatching: "hatching" },
  plants: { awake: "thriving", sleepy: "a little thirsty", napping: "dormant", celebrating: "blooming", resting: "resting", egg: "seed", hatching: "sprouting" },
};

const names = (cs: CritterCard[]) => (cs.length === 1 ? cs[0].first : `${cs.slice(0, -1).map((c) => c.first).join(", ")} and ${cs.at(-1)!.first}`);
const poss = (cs: CritterCard[]) => `${names(cs)}'s`;

/** What the Muse host says. Short, warm, never guilt-trippy. */
export function hostLine(cards: CritterCard[], theme: "critters" | "plants") {
  const w = WORDS[theme];
  const noun = theme === "plants" ? "plant" : "critter";
  const by = (st: CritterState) => cards.filter((c) => c.state === st);
  const many = (cs: CritterCard[]) => (cs.length > 1 ? `${noun}s are` : `${noun} is`);
  const lines: string[] = [];
  if (by("hatching").length) lines.push(`${poss(by("hatching"))} ${theme === "plants" ? "seed is sprouting" : "egg is hatching"}!`);
  if (by("celebrating").length) lines.push(`${poss(by("celebrating"))} ${many(by("celebrating"))} ${w.celebrating}!`);
  if (by("egg").length) lines.push(`${poss(by("egg"))} ${w.egg} is waiting for a hello.`);
  if (by("napping").length) lines.push(`${poss(by("napping"))} ${many(by("napping"))} ${w.napping}.`);
  if (by("sleepy").length) lines.push(`${poss(by("sleepy"))} ${by("sleepy").length > 1 ? "are" : "is"} ${w.sleepy}.`);
  return lines.slice(0, 2).join(" ") || (theme === "plants" ? "Everything's thriving. Nice." : "Everyone's awake. Cozy in here.");
}

export function hangoutView() {
  const s = hang();
  const cards = visibleFriends().filter((f) => f.isCloseCircle).map(critterCard);
  const sa = s.seeAgain;
  const g = GATHERINGS.find((x) => x.id === sa.gatheringId)!;
  const since = daysBetween(g.date, s.demoDate);
  return {
    me: { name: ME.name, avatar: ME.avatarPhoto },
    demoDate: s.demoDate,
    theme: s.theme,
    aiMode: s.aiMode,
    host: { line: hostLine(cards, s.theme) },
    critters: cards.filter((c) => c.state !== "egg" && c.state !== "resting"),
    eggs: cards.filter((c) => c.state === "egg"),
    hammock: cards.filter((c) => c.state === "resting"),
    nudges: s.nudges.filter((n) => n.status === "shown" && visibleFriends().some((f) => f.id === n.friendId)).map(nudgeView),
    seeAgain: !sa.submitted && since >= 0 && since <= 3 ? { gatheringId: g.id, name: g.name, place: g.place, date: g.date, today: since === 0 } : null,
  };
}

function evidenceCard(e: EvidenceItem, friendFirst: string) {
  switch (e.kind) {
    case "photo":
      return { id: e.id, kind: e.kind, date: e.date, title: e.photo.place, text: e.photo.caption, imagePath: e.photo.imagePath };
    case "chat":
      return { id: e.id, kind: e.kind, date: e.date, title: e.chat.sender === "me" ? "You" : friendFirst, text: e.chat.text };
    case "gathering":
      return { id: e.id, kind: e.kind, date: e.date, title: e.gathering.name, text: e.gathering.place };
    case "post":
      return { id: e.id, kind: e.kind, date: e.date, title: `${friendFirst}'s post`, text: e.post.text, imagePath: e.post.imagePath };
    case "reel":
      return { id: e.id, kind: e.kind, date: e.date, title: `${friendFirst}'s Reel`, text: e.reel.caption, imagePath: e.reel.imagePath };
  }
}
export type EvidenceCard = ReturnType<typeof evidenceCard>;

export function nudgeView(n: Nudge) {
  const f = friendById(n.friendId);
  if (!f || f.isBlocked) throw notFound();
  const first = firstName(f.name);
  const index = evidenceIndex();
  const trigger = index.get(n.triggerId);
  const evidence = n.evidenceIds.map((id) => index.get(id)).filter((e): e is EvidenceItem => !!e);
  // The old photo to show: the one Muse picked to send, else the first cited photo.
  const photoId = n.photoId ?? evidence.find((e) => e.kind === "photo")?.id;
  const headline =
    trigger?.kind === "reel" ? `${first} shared a Reel` : trigger?.kind === "post" && trigger.post.kind === "life_update" ? `${first} has news` : trigger?.kind === "post" && trigger.post.place ? `${first} posted from ${trigger.post.place}` : `${first} posted`;
  const triggerLabel = trigger?.kind === "reel" ? `${first}'s new Reel` : trigger?.kind === "post" && trigger.post.kind === "life_update" ? `${first}'s news` : `${first}'s new post`;
  return {
    ...n,
    headline,
    triggerLabel,
    friend: { id: f.id, name: f.name, first, avatar: f.avatarPhoto },
    trigger: trigger ? evidenceCard(trigger, first) : null,
    photo: (photoId && photoById(photoId)) || null,
    evidence: evidence.map((e) => evidenceCard(e, first)),
    critter: critterCard(f),
  };
}
export type NudgeView = ReturnType<typeof nudgeView>;

export function friendView(friendId: string) {
  const f = friendById(friendId);
  if (!f || f.isBlocked || !f.isFriend) throw notFound();
  const s = hang();
  const card = critterCard(f);
  const { sleep } = critterStateFor(friendId);
  const mem = builtMemory(friendId);
  const lastEx = sleep.lastTwoWayChat ? s.chats.filter((c) => sleep.lastTwoWayChat!.sourceIds.includes(c.id)) : [];
  const last = lastEx.at(-1);
  return {
    ...card,
    city: f.city,
    isResting: f.isResting,
    isCloseCircle: f.isCloseCircle,
    why: card.design.image && mem ? artCaption(mem) : card.design.why,
    sleep: { daysSince: sleep.daysSince, rhythmDays: sleep.rhythmDays, ratio: sleep.ratio, lastRealContact: sleep.lastRealContact?.date ?? null },
    lastChat: last ? { date: last.date.slice(0, 10), daysAgo: daysBetween(last.date.slice(0, 10), s.demoDate), text: last.text, sender: last.sender === "me" ? "You" : card.first } : null,
    sharedPlaces: (mem?.sharedPlaces ?? []).map((p) => ({ ...p, photos: p.photoIds.map(photoById).filter((x) => !!x) })),
    insideJokes: (mem?.insideJokes ?? []).map((j) => ({ phrase: j.phrase, sources: j.sourceIds.length })),
    memorySource: memoryStore()[friendId]?.source ?? "fixture",
    egg: s.eggs[friendId] ?? null,
    plan: s.plans[friendId] ?? null,
  };
}

export function chatView(friendId: string) {
  const f = friendById(friendId);
  if (!f || f.isBlocked || !f.isFriend) throw notFound();
  const s = hang();
  const messages = s.chats
    .filter((c) => c.friendId === friendId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((c) => {
      const p = c.photoId ? photoById(c.photoId) : undefined;
      return { id: c.id, date: c.date, sender: c.sender, text: c.text, photo: p ? { id: p.id, imagePath: p.imagePath, place: p.place, date: p.date } : null };
    });
  const nudge = s.nudges.find((n) => n.friendId === friendId && (n.status === "shown" || n.status === "sent"));
  const plan = s.plans[friendId];
  return {
    friend: { id: f.id, name: f.name, first: firstName(f.name), avatar: f.avatarPhoto },
    critter: critterCard(f),
    demoDate: s.demoDate,
    messages,
    plan: plan ? { ...plan, dayTime: slotLabel(plan.slotId) } : null,
    nudge: nudge ? { id: nudge.id, action: nudge.action, photoId: nudge.photoId, status: nudge.status } : null,
    hasFreeTime: (CALENDARS.find((c) => c.personId === friendId)?.free.length ?? 0) > 0,
  };
}

export function latestAlert() {
  const s = hang();
  return s.alerts.find((a) => !a.seen && visibleFriends().some((f) => f.id === a.friendId)) ?? null;
}

export function demoView() {
  const s = hang();
  return {
    demoDate: s.demoDate,
    aiMode: s.aiMode,
    theme: s.theme,
    hasKey: hasKey(),
    models: { ember: museModelId("ember"), wonder: museModelId("wonder") },
    scenarios: SCENARIOS.map((sc) => ({ id: sc.id, label: sc.label, friendId: sc.friendId, expect: sc.expect.outcome === "nudge" ? `${sc.expect.type} nudge` : sc.expect.outcome === "filtered" ? `filtered (${sc.expect.reason})` : "no nudge" })),
    nudges: s.nudges.map((n) => ({ id: n.id, friendId: n.friendId, type: n.type, reason: n.reason, status: n.status, createdAt: n.createdAt })),
    repliers: visibleFriends().filter((f) => f.replies.length).map((f) => ({ id: f.id, first: firstName(f.name), state: critterStateFor(f.id).state })),
    seeAgain: s.seeAgain,
    plans: Object.values(s.plans),
    recorded: recordedKeys(),
    memory: Object.fromEntries(visibleFriends().map((f) => [f.id, memoryStore()[f.id]?.source ?? "fixture"])),
    runs: s.runs,
  };
}

export type HangoutView = ReturnType<typeof hangoutView>;
export type FriendView = ReturnType<typeof friendView>;
export type ChatView = ReturnType<typeof chatView>;
export type DemoView = ReturnType<typeof demoView>;
export type AlertView = NonNullable<ReturnType<typeof latestAlert>>;
