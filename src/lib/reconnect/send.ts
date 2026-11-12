// From a plan to two humans: Muse drafts the message in the owner's own voice (from their past messages to that
// person); the owner edits and sends it from the normal composer; sending creates a real Facebook Event, invite-only,
// attached to the thread. The other side sees a friend's words and an Event card, never an agent.
import { photoUrl } from "@/lib/img";
import { ai } from "@/lib/ai";
import { db, getOrCreateDM, getUser, newId, notify, rsvp } from "@/server/db";
import type { FBEvent, ID, Message } from "@/types";
import { connection } from "@/lib/travel/visibility";
import { getPlan, savePlan, type Plan } from "./store";

const first = (id: ID) => getUser(id)?.name.split(" ")[0] ?? id;
const fmtRange = (start: string, end: string) => {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const mo = (d: Date) => d.toLocaleString("en-US", { month: "short" });
  if (start === end) return `${mo(s)} ${s.getDate()}`;
  return mo(s) === mo(e) ? `${mo(s)} ${s.getDate()}–${e.getDate()}` : `${mo(s)} ${s.getDate()} – ${mo(e)} ${e.getDate()}`;
};

/** Where the message goes: the crew's group chat when the plan is for a crew, else a DM with the first person. */
export function conversationForPlan(ownerId: ID, plan: Plan) {
  if (plan.target.crewId) {
    const c = db().conversations.find((c) => c.id === plan.target.crewId && c.participantIds.includes(ownerId));
    if (c) return c;
  }
  const direct = plan.people.find((p) => connection(ownerId, p.id)?.degree === 1) ?? plan.people[0];
  return getOrCreateDM(ownerId, direct.id);
}

const SCHEMA = { type: "object", properties: { text: { type: "string", description: "The message, 1–3 short sentences, in the sender's own voice. Name the dates and the thing. Easy to say no to. At most one emoji." } }, required: ["text"] };

/** Draft the invite into Messenger. Idempotent per plan. Nothing is sent. */
export async function draftInvite(ownerId: ID, planId: string): Promise<{ plan: Plan; messageId: string; conversationId: string; text: string; mode: string }> {
  const plan = getPlan(planId);
  if (!plan || plan.ownerId !== ownerId) throw Object.assign(new Error("Plan not found"), { status: 404 });
  const me = getUser(ownerId)!;
  const conv = conversationForPlan(ownerId, plan);
  const existing = conv.messages.find((m) => m.attachment?.type === "plan" && m.attachment.ref === plan.id && m.senderId === ownerId);
  if (existing) return { plan, messageId: existing.id, conversationId: conv.id, text: existing.text, mode: "stored" };
  const to = conv.isGroup ? (conv.name ?? "the group") : getUser(conv.participantIds.find((id) => id !== ownerId)!)!.name;
  // the sender's own voice: their last lines in this thread (or anywhere), never anyone else's
  const sample = db().conversations.filter((c) => c.participantIds.includes(ownerId)).flatMap((c) => c.messages.filter((m) => m.senderId === ownerId && m.status !== "draft" && m.text.length > 8).map((m) => ({ t: m.createdAt, text: m.text, here: c.id === conv.id }))).sort((a, b) => Number(b.here) - Number(a.here) || b.t.localeCompare(a.t)).slice(0, 8).map((m) => `- ${m.text.slice(0, 120)}`).join("\n");
  const facts = [`plan: ${plan.title}`, `when: ${fmtRange(plan.start, plan.end)}`, `where: ${plan.cityName}${plan.event ? ` · ${plan.event.title}` : ""}`, `who: ${plan.people.map((p) => first(p.id)).join(", ")}`, plan.hostId ? `you'd ask to stay with ${first(plan.hostId)}` : "", plan.ride ? `${plan.ride.driverName.split(" ")[0]} is driving with a seat` : "", `why: ${plan.pitch}`].filter(Boolean).join("\n");
  const prompt = `Write the message ${me.name.split(" ")[0]} sends to ${to} to float this plan.\n\nFACTS (only these):\n${facts}\n\nHOW ${me.name.split(" ")[0].toUpperCase()} ACTUALLY TEXTS (match this voice, don't copy it):\n${sample || `- ${me.bio}`}\n\nRules: 1–3 short sentences, lowercase-leaning, specific about the dates and the thing, no money, no mention of how long it's been, no apology, easy to say no to.`;
  const { data, trace } = await ai.json<{ text: string }>(prompt, { task: "reconnect.draft", userId: ownerId, schema: SCHEMA, maxTokens: 300, temperature: 0.7, mock: () => ({ text: `(mock) ok what if I actually came ${plan.city === me.city ? "out" : `to ${plan.cityName}`} ${fmtRange(plan.start, plan.end)}? ${plan.title}. no pressure at all` }) });
  const text = (data.text ?? "").trim().replace(/\$\s?\d+/g, "").trim();
  const m: Message = { id: newId("m"), senderId: ownerId, text, createdAt: new Date().toISOString(), readBy: [ownerId], status: "draft", draftReason: `Reconnect · ${plan.title}`, attachment: { type: "plan", ref: plan.id } };
  conv.messages.push(m);
  plan.status = "drafted";
  plan.conversationId = conv.id;
  plan.draftMessageId = m.id;
  savePlan(plan);
  return { plan, messageId: m.id, conversationId: conv.id, text, mode: trace.mode };
}

/** The owner's send: the draft becomes a real message and an invite-only Facebook Event attached to it. */
export function sendPlan(ownerId: ID, planId: string, text?: string) {
  const plan = getPlan(planId);
  if (!plan || plan.ownerId !== ownerId) throw Object.assign(new Error("Plan not found"), { status: 404 });
  const conv = plan.conversationId ? db().conversations.find((c) => c.id === plan.conversationId) : undefined;
  if (!conv) throw Object.assign(new Error("Draft it first"), { status: 409 });
  const i = conv.messages.findIndex((m) => m.id === plan.draftMessageId);
  const m = i >= 0 ? conv.messages[i] : undefined;
  if (!m || m.status !== "draft") throw Object.assign(new Error("Already sent"), { status: 409 });
  if (text?.trim()) m.text = text.trim();
  m.status = "sent";
  m.createdAt = new Date().toISOString();
  conv.messages.splice(i, 1);
  conv.messages.push(m);
  // the Event is the plan's home
  const start = new Date(plan.start + "T18:00:00");
  const end = new Date(plan.end + (plan.end === plan.start ? "T22:00:00" : "T17:00:00"));
  const invited = plan.people.map((p) => p.id);
  const e: FBEvent = {
    id: newId("e"), title: plan.title.charAt(0).toUpperCase() + plan.title.slice(1), cover: photoUrl(`reconnect-${plan.city}-${plan.shape}`, 1200, 600),
    startsAt: plan.event?.startsAt ?? start.toISOString(), endsAt: end.toISOString(), location: plan.event?.location ?? `${plan.cityName}${plan.hostId ? ` · ${first(plan.hostId)}'s` : ""}`, hostId: ownerId,
    description: `${plan.pitch}\n\n${plan.reasons.map((r) => `· ${r}`).join("\n")}\n\nAbout $${plan.cost.each} each (${plan.cost.note}). Planned in Reconnect; nothing is final until everyone's in.`,
    going: [ownerId], interested: [], invited, category: "Reconnect", price: plan.cost.each ? `About $${plan.cost.each} each` : "Free", city: plan.city,
  };
  db().events.unshift(e);
  plan.fbEventId = e.id;
  plan.status = "sent";
  savePlan(plan);
  const me = getUser(ownerId)!;
  for (const id of conv.participantIds) if (id !== ownerId) notify(id, { actorId: ownerId, type: "reconnect", text: `**${me.name}** wants to see you ${fmtRange(plan.start, plan.end)} · ${plan.title}`, href: `/messages/${conv.id}` });
  return { ok: true, message: m, conversationId: conv.id, eventId: e.id, plan };
}

/** A recipient's yes: they're going on the Event, the owner is told, and the plan remembers who's in. */
export function joinPlan(userId: ID, planId: string, on = true) {
  const plan = getPlan(planId);
  if (!plan || plan.status === "proposed") throw Object.assign(new Error("Plan not found"), { status: 404 });
  const person = plan.people.find((p) => p.id === userId);
  if (!person) throw Object.assign(new Error("Not invited"), { status: 403 });
  person.joinedAt = on ? new Date().toISOString() : undefined;
  if (plan.fbEventId) rsvp(plan.fbEventId, userId, on ? "going" : "none");
  if (on) notify(plan.ownerId, { actorId: userId, type: "reconnect", text: `**${getUser(userId)!.name}** is in for ${plan.title}`, href: `/reconnect/plan/${plan.id}` });
  savePlan(plan);
  return plan;
}

/** The owner's final yes, only once somebody else said yes. */
export function confirmPlan(ownerId: ID, planId: string, on = true) {
  const plan = getPlan(planId);
  if (!plan || plan.ownerId !== ownerId) throw Object.assign(new Error("Plan not found"), { status: 404 });
  if (on && !plan.people.some((p) => p.joinedAt)) throw Object.assign(new Error("Nobody has said yes yet"), { status: 409 });
  plan.confirmedAt = on ? new Date().toISOString() : undefined;
  plan.status = on ? "confirmed" : "sent";
  savePlan(plan);
  return plan;
}

/** What a viewer may see of a plan: owners see everything; invitees see it once it's sent, without the owner's cost fallback. */
export function viewPlan(viewerId: ID, plan: Plan) {
  const owner = plan.ownerId === viewerId;
  if (!owner && plan.status === "proposed") return null;
  if (!owner && !plan.people.some((p) => p.id === viewerId) && !(plan.conversationId && db().conversations.find((c) => c.id === plan.conversationId)?.participantIds.includes(viewerId))) return null;
  const o = getUser(plan.ownerId)!;
  return { ...plan, owner: { id: o.id, name: o.name, avatar: o.avatar }, role: owner ? "owner" : "invited", me: plan.people.find((p) => p.id === viewerId), sources: owner ? plan.sources : plan.sources.filter((s) => s.kind === "price" || s.kind === "rsvp" || s.kind === "ride"), people: plan.people.map((p) => (owner ? p : { ...p, days: [], summary: p.id === viewerId ? p.summary : "", availability: p.id === viewerId ? p.availability : ("unknown" as const) })) };
}
