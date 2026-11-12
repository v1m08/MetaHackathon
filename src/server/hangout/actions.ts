// Everything the Hangout UI and the demo panel can change. API routes stay thin and call these.
import { GATHERINGS, PEOPLE } from "@/data/hangout/seed";
import type { NudgeStatus } from "@/lib/hangout/types";
import { keepsakeLabel } from "@/lib/hangout/parts";
import { drawKeepsake } from "./art";
import { hasKey } from "./muse";
import { designCritter, pickKeepsake, type RunOpts } from "./pipeline";
import { builtMemory, demoNow, firstName, friendById, hang, hid, pushAlert, pushRun, timelineFor } from "./store";

const notFound = (what: string) => Object.assign(new Error(`${what} not found`), { status: 404 });
const appRun: RunOpts = { fallbackToCache: true };

/** A friend the UI may touch. Blocked people behave as if they don't exist. */
function requireFriend(id: string) {
  const f = friendById(id);
  if (!f || f.isBlocked) throw notFound("Friend");
  return f;
}

export function sendMessage(friendId: string, input: { text?: string; photoId?: string; nudgeId?: string }) {
  requireFriend(friendId);
  const text = (input.text ?? "").trim();
  if (!text && !input.photoId) throw Object.assign(new Error("Write something first"), { status: 400 });
  const s = hang();
  const msg = { id: hid("ch"), friendId, date: demoNow(), sender: "me", text, photoId: input.photoId };
  s.chats.push(msg);
  const nudge = s.nudges.find((n) => n.id === input.nudgeId && n.friendId === friendId);
  if (nudge) nudge.status = "sent";
  return msg;
}

/** Demo trigger: the friend sends their next canned reply. Their first two-way chat hatches an egg. */
export async function friendReplies(friendId: string) {
  const f = requireFriend(friendId);
  const s = hang();
  if (!f.replies.length) throw Object.assign(new Error(`${f.name} has no replies`), { status: 400 });
  const i = s.replyIdx[friendId] ?? 0;
  s.replyIdx[friendId] = i + 1;
  const text = f.replies[i % f.replies.length];
  s.chats.push({ id: hid("ch"), friendId, date: demoNow(), sender: friendId, text });
  pushAlert({ kind: "reply", friendId, title: firstName(f.name), body: text, href: `/friends/hangout/chat/${friendId}` });

  const egg = s.eggs[friendId];
  if (egg && !egg.hatchedAt && timelineFor(friendId).some((e) => e.type === "two_way_chat")) {
    egg.hatchedAt = s.demoDate;
    egg.hatchSeen = false;
    const mem = builtMemory(friendId) ?? { sharedPlaces: [], insideJokes: [] };
    const { design, step } = await designCritter(friendId, mem, appRun);
    s.critters[friendId] = design;
    pushRun({ id: hid("run"), at: new Date().toISOString(), label: `${firstName(f.name)}'s egg hatched`, friendId, steps: [step], outcome: `${design.body} / ${design.color} / ${design.accessory}: ${design.why ?? ""}`, ok: true });
    pushAlert({ kind: "hatch", friendId, title: "Muse", body: `${firstName(f.name)}'s egg hatched!`, href: "/friends/hangout" });
  }
  return { text };
}

export function setNudgeStatus(id: string, status: NudgeStatus) {
  const n = hang().nudges.find((x) => x.id === id);
  if (!n) throw notFound("Nudge");
  n.status = status;
  if (status === "rested") setResting(n.friendId, true);
  return n;
}

export function setResting(friendId: string, resting: boolean) {
  const f = requireFriend(friendId);
  f.isResting = resting;
  if (resting) for (const n of hang().nudges) if (n.friendId === friendId && n.status === "shown") n.status = "rested";
  return f;
}

// ---------- See again ----------

export function seeAgainAttendees() {
  const s = hang();
  const g = GATHERINGS.find((x) => x.id === s.seeAgain.gatheringId)!;
  const people = g.attendeeIds
    .filter((id) => id !== "me")
    .map((id) => friendById(id) ?? PEOPLE.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p && !("isBlocked" in p && p.isBlocked));
  return { gathering: g, people };
}

function makeMatch(personId: string) {
  const s = hang();
  if (s.seeAgain.matches.includes(personId)) return;
  s.seeAgain.matches.push(personId);
  const f = friendById(personId);
  if (!f || f.isBlocked) return;
  f.isCloseCircle = true;
  s.eggs[personId] = { since: s.demoDate };
  pushAlert({ kind: "match", friendId: personId, title: "See again", body: `You and ${firstName(f.name)} both want to hang again. There's an egg in your Hangout.`, href: `/friends/hangout/${personId}` });
}

export function submitSeeAgain(picks: string[]) {
  const s = hang();
  const allowed = new Set(seeAgainAttendees().people.map((p) => p.id));
  s.seeAgain.myPicks = picks.filter((p) => allowed.has(p));
  s.seeAgain.submitted = true;
  for (const id of s.seeAgain.myPicks) if (s.seeAgain.theyPicked.includes(id)) makeMatch(id);
  return s.seeAgain;
}

/** Demo trigger: someone at the meetup privately picks you. */
export function theyPickYou(personId: string) {
  const s = hang();
  if (!s.seeAgain.theyPicked.includes(personId)) s.seeAgain.theyPicked.push(personId);
  if (s.seeAgain.myPicks.includes(personId)) makeMatch(personId);
  return s.seeAgain;
}

export function markHatchSeen(friendId: string) {
  const egg = hang().eggs[friendId];
  if (egg?.hatchedAt) egg.hatchSeen = true;
}

// ---------- plans and meetups ----------

/** The user chose to post Muse's draft plan into the chat. */
export function sharePlan(friendId: string) {
  requireFriend(friendId);
  const plan = hang().plans[friendId];
  if (!plan) throw notFound("Plan");
  plan.sharedOn ??= hang().demoDate;
  return plan;
}

export function dismissPlan(friendId: string) {
  const plan = hang().plans[friendId];
  if (plan && !plan.sharedOn) delete hang().plans[friendId];
}

export function confirmPlan(friendId: string, who: string) {
  requireFriend(friendId);
  const plan = hang().plans[friendId];
  if (!plan?.sharedOn) throw notFound("Shared plan");
  if ((who === "me" || who === friendId) && !plan.confirmedBy.includes(who)) plan.confirmedBy.push(who);
  return plan;
}

/** "We met up": logs the meetup (critter celebrates for 3 days) and Muse picks a keepsake pin. */
export async function confirmMeetup(friendId: string) {
  const f = requireFriend(friendId);
  const s = hang();
  const plan = s.plans[friendId];
  if (!plan) throw notFound("Plan");
  if (plan.metUpOn) return plan;
  s.gatherings.push({ id: hid("gt"), kind: "event", name: `Hang with ${firstName(f.name)}`, date: s.demoDate, place: plan.place, attendeeIds: ["me", friendId] });
  const { pin } = await pickKeepsake(friendId, plan.place, appRun);
  const keepsakes = (s.keepsakes[friendId] ??= []);
  if (!keepsakes.includes(pin)) keepsakes.push(pin);
  plan.metUpOn = s.demoDate;
  plan.keepsake = pin;
  // Muse Image draws the new pin into the critter's art in the background; the Hangout picks it up on its next poll.
  const t0 = Date.now();
  void drawKeepsake(friendId, pin, s.aiMode === "live" && hasKey())
    .then((made) =>
      pushRun({ id: hid("run"), at: new Date().toISOString(), label: `Draw ${keepsakeLabel(pin)} into ${firstName(f.name)}'s critter`, friendId, steps: [{ name: "Muse Image edit", status: made.length ? "ok" : "skip", detail: made.length ? `${made.join(", ")} in ${Date.now() - t0}ms` : "already drawn, or cached mode / no key" }], outcome: made.length ? `${made.length} images drawn` : "skipped", ok: true }),
    )
    .catch((err) => pushRun({ id: hid("run"), at: new Date().toISOString(), label: `Draw ${keepsakeLabel(pin)} into ${firstName(f.name)}'s critter`, friendId, steps: [{ name: "Muse Image edit", status: "fail", detail: (err as Error).message }], outcome: "failed, pin stays as an overlay", ok: false }));
  return plan;
}

export function markAlertSeen(id: string) {
  const a = hang().alerts.find((x) => x.id === id);
  if (a) a.seen = true;
}
