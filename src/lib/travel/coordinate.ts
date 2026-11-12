// Coordinate: dates that work for everyone (code), and drafted messages (Muse writes the words, code picks the
// recipients). Friend-of-friend introductions always go through the mutual. Nothing sends until the user approves
// it in Messenger; approval flips a draft message to sent inside the clone. Nothing leaves the app.
import { weekendDates, weekendLabel } from "@/data/travel";
import { ai } from "@/lib/ai";
import { db, getOrCreateDM, getUser, newId, notify } from "@/server/db";
import type { ID, Message } from "@/types";
import { getTrip } from "./store";
import { datesBetween } from "./tools";
import { inferAvailability, LABEL, quickStatus } from "./availability";
import type { Availability, DayAvailability } from "./store";
import type { Trip, TripPerson } from "./validate";
import { connection } from "./visibility";

const first = (n: string) => n.split(" ")[0];
const fmtRange = (start: string, end: string) => {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const mo = (d: Date) => d.toLocaleString("en-US", { month: "short" });
  return mo(s) === mo(e) ? `${mo(s)} ${s.getDate()}–${e.getDate()}` : `${mo(s)} ${s.getDate()} – ${mo(e)} ${e.getDate()}`;
};

export interface DatesResult {
  dates: string[];
  people: { id: ID; name: string; avatar: string; role: string; busyOn: string[]; free: boolean; status: Availability["overall"]; label: string; summary: string; days: DayAvailability[]; mode: string; canAsk: boolean }[];
  allFree: boolean;
  /** Everyone involved is confirmed or likely free (no unknowns). */
  allKnown: boolean;
  alternatives: { start: string; end: string; label: string }[];
}

/** Who is around when, for the trip's weekend, from inferred signals (never a seeded calendar); plus the next
 *  weekends with no known conflict for everyone involved. Unknown stays unknown until someone is asked. */
export async function sharedDates(viewerId: ID, trip: Trip): Promise<DatesResult> {
  const me = getUser(viewerId)!;
  const involved: { id: ID; role: string }[] = [{ id: viewerId, role: "you" }];
  if (trip.host) involved.push({ id: trip.host.id, role: "host" });
  if (trip.ride) involved.push({ id: trip.ride.driver.id, role: "driver" });
  const dates = datesBetween(trip.start, trip.end);
  const people = await Promise.all(involved.map(async ({ id, role }) => {
    const u = getUser(id)!;
    const av = id === viewerId ? selfAvailability(viewerId, trip.start, trip.end) : await inferAvailability(viewerId, id, trip.start, trip.end, { context: trip.city });
    const busyOn = av.days.filter((d) => d.status === "busy").map((d) => d.date);
    return { id, name: id === viewerId ? me.name : u.name, avatar: u.avatar, role, busyOn, free: av.overall !== "busy", status: av.overall, label: LABEL[av.overall], summary: av.summary, days: av.days, mode: av.mode, canAsk: id !== viewerId && connection(viewerId, id)?.degree === 1 && av.overall !== "confirmed" };
  }));
  const alternatives: DatesResult["alternatives"] = [];
  for (let n = 1; n <= 8 && alternatives.length < 2; n++) {
    const ds = weekendDates(n);
    if (ds[0] === trip.start) continue;
    if (involved.every(({ id }) => (id === viewerId ? selfAvailability(viewerId, ds[0], ds[2]).overall : quickStatus(viewerId, id, ds[0], ds[2], trip.city)) !== "busy")) alternatives.push({ start: ds[0], end: ds[2], label: weekendLabel(n) });
  }
  return { dates, people, allFree: people.every((p) => p.free), allKnown: people.every((p) => p.status === "confirmed" || p.status === "likely_free"), alternatives };
}

/** The viewer's own availability: their RSVPs away from home are busy; otherwise they said they're free by asking. */
function selfAvailability(viewerId: ID, start: string, end: string): Availability {
  const me = getUser(viewerId)!;
  const dates = datesBetween(start, end);
  const days: DayAvailability[] = dates.map((d) => {
    const ev = db().events.find((e) => e.going.includes(viewerId) && e.city && e.city !== me.city && e.startsAt.slice(0, 10) === d);
    return ev ? { date: d, status: "busy", reason: `you RSVP'd to ${ev.title}`, source: { kind: "rsvp", id: ev.id }, confidence: "high" } : { date: d, status: "confirmed_free", reason: "you picked this weekend", confidence: "high" };
  });
  const busy = days.some((d) => d.status === "busy");
  return { personId: viewerId, requesterId: viewerId, dates, days, overall: busy ? "busy" : "confirmed", summary: busy ? "you have plans elsewhere" : "you picked this weekend", mode: "code", costUsd: 0, signalCount: 0, computedAt: new Date().toISOString(), key: "" };
}

/** One-tap availability check: a short question drafted into Messenger, sent only when the user approves it. */
export function draftConfirmAsk(viewerId: ID, personId: ID, start: string, end: string, tripId?: string) {
  const to = getUser(personId);
  if (!to) throw Object.assign(new Error("unknown person"), { status: 404 });
  const c = connection(viewerId, personId);
  if (!c || c.degree !== 1) throw Object.assign(new Error("you can only ask people you're friends with; friends-of-friends go through an intro"), { status: 403 });
  const conv = getOrCreateDM(viewerId, personId);
  const existing = conv.messages.find((m) => m.senderId === viewerId && m.draftReason?.startsWith("Availability check") && m.draftReason.includes(start));
  if (existing) return { id: existing.id, conversationId: conv.id, status: existing.status ?? "sent", text: existing.text };
  const text = `around ${fmtRange(start, end)}?`;
  const m: Message = { id: newId("m"), senderId: viewerId, text, createdAt: new Date().toISOString(), readBy: [viewerId], status: "draft", draftReason: `Availability check · ${start}`, attachment: tripId ? { type: "trip", ref: tripId } : undefined };
  conv.messages.push(m);
  return { id: m.id, conversationId: conv.id, status: "draft" as const, text };
}

export interface DraftPlan {
  key: "host" | "ride" | "friend" | "confirm";
  /** Who the message goes to (the mutual, for a friend-of-friend). */
  toId: ID;
  /** The person it is ultimately about, when toId is a mutual doing the intro. */
  aboutId?: ID;
  purpose: string;
}
/** Code decides recipients: direct friend → them; friend-of-friend → the mutual, asking for an intro. */
export function planDrafts(viewerId: ID, trip: Trip): DraftPlan[] {
  const plans: DraftPlan[] = [];
  const add = (key: DraftPlan["key"], p: TripPerson, what: string) => {
    if (p.degree === 1) plans.push({ key, toId: p.id, purpose: `ask ${first(p.name)} ${what}` });
    else if (p.via) plans.push({ key, toId: p.via.id, aboutId: p.id, purpose: `ask ${first(p.via.name)} to introduce you to ${first(p.name)} so you can ask ${what}` });
  };
  if (trip.host) add("host", trip.host, `about staying ${fmtRange(trip.start, trip.end)}`);
  if (trip.ride) add("ride", trip.ride.driver, `for a seat in the car`);
  const friend = trip.people.find((p) => p.degree === 1 && p.id !== trip.host?.id && p.id !== trip.ride?.driver.id);
  if (friend && plans.length < 3) add("friend", friend, `if they're around that weekend`);
  return plans.slice(0, 3);
}

export interface Draft {
  id: string;
  conversationId: string;
  key: DraftPlan["key"];
  to: { id: ID; name: string; avatar: string; connection: string };
  about?: { id: ID; name: string };
  text: string;
  status: "draft" | "sent";
  reason: string;
}

const SCHEMA = {
  type: "object",
  properties: {
    drafts: { type: "array", items: { type: "object", properties: { key: { type: "string" }, text: { type: "string", description: "The message, 2-4 sentences, like a real text between friends. Name the dates. For an intro request, ask the mutual to connect you and say why." } }, required: ["key", "text"] } },
  },
  required: ["drafts"],
};

export async function draftMessages(viewerId: ID, tripId: string): Promise<{ dates: DatesResult; drafts: Draft[]; mode: string; costUsd: number }> {
  const trip = getTrip(tripId);
  if (!trip || trip.viewerId !== viewerId) throw Object.assign(new Error("Trip not found"), { status: 404 });
  const me = getUser(viewerId)!;
  const dates = await sharedDates(viewerId, trip);
  const plans = planDrafts(viewerId, trip);
  // already drafted for this trip? return them (idempotent)
  const existing = existingDrafts(viewerId, tripId);
  if (existing.length) return { dates, drafts: existing, mode: "stored", costUsd: 0 };
  if (!plans.length) return { dates, drafts: [], mode: "none", costUsd: 0 };

  const ctx = plans.map((p) => {
    const to = getUser(p.toId)!;
    const about = p.aboutId ? getUser(p.aboutId)! : undefined;
    return `- key "${p.key}": message TO ${to.name} (${connection(viewerId, to.id)?.label}). Purpose: ${p.purpose}.${about ? ` ${first(about.name)} is ${to.friendLabels?.[about.id] ?? "their friend"}; ${about.openToHosting && p.key === "host" ? `${first(about.name)} has "open to hosting friends" on and wrote: "${about.hostingNote}".` : ""}` : ""}${p.key === "host" && !about && to.hostingNote ? ` ${first(to.name)} has "open to hosting friends" on and wrote: "${to.hostingNote}".` : ""}${p.key === "ride" && trip.ride ? ` The ride: ${trip.ride.fromCity} → ${trip.ride.toCity}, leaving ${new Date(trip.ride.departAt).toLocaleString("en-US", { weekday: "short", hour: "numeric" })}, ${trip.ride.seatsOpen} seats open${trip.ride.note ? `, note: "${trip.ride.note}"` : ""}.` : ""}`;
  });
  const { data, trace } = await ai.json<{ drafts: { key: string; text: string }[] }>(
    `Write the messages ${me.name.split(" ")[0]} (me) would send to set up this trip: ${trip.title} — ${trip.cityName}, ${fmtRange(trip.start, trip.end)}${trip.event ? `, around ${trip.event.title}` : ""}.\n${ctx.join("\n")}\nMy voice: ${me.bio}. Keep each message short, warm, specific about dates, easy to say no to. No emojis beyond one. Never promise money; offer to cover gas or cook.`,
    { task: "travel.coordinate.draft", userId: viewerId, schema: SCHEMA, maxTokens: 1800, temperature: 0.6, mock: () => ({ drafts: plans.map((p) => ({ key: p.key, text: `(mock) hey ${first(getUser(p.toId)!.name)}! ${p.purpose} — ${fmtRange(trip.start, trip.end)}. totally fine if not!` })) }) },
  );
  const drafts: Draft[] = [];
  for (const p of plans) {
    const text = data.drafts?.find((d) => d.key === p.key)?.text?.trim();
    if (!text) continue;
    const to = getUser(p.toId)!;
    const conv = getOrCreateDM(viewerId, p.toId);
    const reason = `Trip: ${trip.title} · ${p.purpose}`;
    const m: Message = { id: newId("m"), senderId: viewerId, text, createdAt: new Date().toISOString(), readBy: [viewerId], status: "draft", draftReason: reason, attachment: { type: "trip", ref: tripId } };
    conv.messages.push(m);
    drafts.push({ id: m.id, conversationId: conv.id, key: p.key, to: { id: to.id, name: to.name, avatar: to.avatar, connection: connection(viewerId, to.id)?.label ?? "" }, about: p.aboutId ? { id: p.aboutId, name: getUser(p.aboutId)!.name } : undefined, text, status: "draft", reason });
  }
  return { dates, drafts, mode: trace.mode, costUsd: trace.costUsd ?? 0 };
}

export function existingDrafts(viewerId: ID, tripId: string): Draft[] {
  const out: Draft[] = [];
  for (const c of db().conversations) {
    if (!c.participantIds.includes(viewerId)) continue;
    for (const m of c.messages) {
      if (m.senderId !== viewerId || m.attachment?.type !== "trip" || m.attachment.ref !== tripId) continue;
      const toId = c.participantIds.find((p) => p !== viewerId)!;
      const to = getUser(toId)!;
      const key: DraftPlan["key"] = /^Availability check/.test(m.draftReason ?? "") ? "confirm" : /seat|ride|car/i.test(m.draftReason ?? "") ? "ride" : /stay|host/i.test(m.draftReason ?? "") ? "host" : "friend";
      out.push({ id: m.id, conversationId: c.id, key, to: { id: to.id, name: to.name, avatar: to.avatar, connection: connection(viewerId, to.id)?.label ?? "" }, text: m.text, status: m.status === "sent" || !m.status ? "sent" : "draft", reason: m.draftReason ?? "" });
    }
  }
  return out;
}

/** Approve (send inside the clone), edit, or discard a draft. Only its sender may. */
export function actOnDraft(viewerId: ID, messageId: string, action: "approve" | "edit" | "discard", text?: string) {
  for (const c of db().conversations) {
    const i = c.messages.findIndex((m) => m.id === messageId);
    if (i < 0) continue;
    const m = c.messages[i];
    if (m.senderId !== viewerId) throw Object.assign(new Error("Not your draft"), { status: 403 });
    if (m.status !== "draft") throw Object.assign(new Error("Already sent"), { status: 409 });
    if (action === "discard") {
      c.messages.splice(i, 1);
      return { ok: true, removed: true };
    }
    if (action === "edit") {
      m.text = (text ?? m.text).trim();
      return { ok: true, message: m };
    }
    m.status = "sent";
    m.createdAt = new Date().toISOString();
    c.messages.splice(i, 1);
    c.messages.push(m);
    const toId = c.participantIds.find((p) => p !== viewerId)!;
    const me = getUser(viewerId)!;
    notify(toId, { actorId: viewerId, type: "travel", text: `**${me.name}** sent you a message about a trip`, href: `/messages/${c.id}` });
    return { ok: true, message: m, conversationId: c.id };
  }
  throw Object.assign(new Error("Draft not found"), { status: 404 });
}
