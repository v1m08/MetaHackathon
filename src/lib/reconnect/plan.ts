// The gathering agent: the travel Discover loop pointed at a PERSON (or a crew) instead of a destination.
// Muse decides which shape fits (a visit to their city, a hangout here, an event one of you is already going to,
// or a call) and writes the words. Code supplies everything it may use (who, which weekends, who said what about
// being free, what things cost) and re-checks every id, date and dollar before anything renders.
import { cityById } from "@/data/cities";
import { weekendDates, weekendLabel } from "@/data/travel";
import { ai, type ToolDef } from "@/lib/ai";
import { db, getUser } from "@/server/db";
import type { ID } from "@/types";
import { inferAvailabilityTool, datesBetween, rideTouches } from "@/lib/travel/tools";
import { inferMany, quickStatus } from "@/lib/travel/availability";
import { twoPrices, type LodgingMode, type TransportMode } from "@/lib/travel/pricing";
import { canSeeEvent, canSeeUser, connection } from "@/lib/travel/visibility";
import { driftFor } from "./drift";
import { sharedEvidence } from "./evidence";
import { reconnectStore, savePlan, type Plan, type PlanPerson, type PlanRun, type PlanShape } from "./store";

/** Seeded, not model-written: a night out with friends in any of our cities. Shown on the card as a line. */
export const HANGOUT_USD = 28;
export const CALL_USD = 0;

const first = (id: ID) => getUser(id)?.name.split(" ")[0] ?? id;
const fmtRange = (start: string, end: string) => {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const mo = (d: Date) => d.toLocaleString("en-US", { month: "short" });
  if (start === end) return `${mo(s)} ${s.getDate()}`;
  return mo(s) === mo(e) ? `${mo(s)} ${s.getDate()}–${e.getDate()}` : `${mo(s)} ${s.getDate()} – ${mo(e)} ${e.getDate()}`;
};
const cityName = (id?: string) => cityById(id ?? "")?.name ?? id ?? "?";

export interface PlanTarget { personIds: ID[]; crewId?: string; crewName?: string }

/** Everything the agent may know, in one call: the people, the next weekends with quick availability, events and rides. */
function contextFor(viewerId: ID, target: PlanTarget) {
  const me = getUser(viewerId)!;
  const people = target.personIds.map((id) => {
    const u = getUser(id)!;
    const d = driftFor(viewerId, id);
    const posts = db().posts.filter((p) => p.authorId === id && !p.groupId && Date.now() - new Date(p.createdAt).getTime() < 45 * 86_400_000).slice(0, 4).map((p) => p.text.slice(0, 160));
    const shared = sharedEvidence(viewerId, id).slice(0, 5).map((e) => e.text.slice(0, 120));
    return { id, name: u.name, city: u.city, cityName: cityName(u.city), connection: connection(viewerId, id)?.label, hasCar: !!u.hasCar, daysSinceRealContact: d.daysSince, state: d.state, recentPosts: posts, sharedHistory: shared };
  });
  const weekends = Array.from({ length: 6 }, (_, i) => {
    const ds = weekendDates(i + 1);
    const per = target.personIds.map((id) => ({ id, quick: quickStatus(viewerId, id, ds[0], ds[2]) }));
    const meBusy = db().events.some((e) => e.going.includes(viewerId) && e.city && e.city !== me.city && ds.includes(e.startsAt.slice(0, 10)));
    return { n: i + 1, start: ds[0], end: ds[2], label: weekendLabel(i + 1), youBusy: meBusy, people: per };
  });
  const cities = new Set([me.city, ...people.map((p) => p.city)].filter(Boolean) as string[]);
  const horizon = Date.now() + 60 * 86_400_000;
  const events = db()
    .events.filter((e) => canSeeEvent(viewerId, e) && new Date(e.startsAt).getTime() > Date.now() && new Date(e.startsAt).getTime() < horizon && (!e.city || cities.has(e.city)))
    .map((e) => {
      const targetsGoing = target.personIds.filter((id) => e.going.includes(id));
      const targetsInterested = target.personIds.filter((id) => e.interested.includes(id));
      const friendsGoing = e.going.filter((id) => me.friendIds.includes(id) && !targetsGoing.includes(id)).map(first);
      return { id: e.id, title: e.title, city: e.city, cityName: cityName(e.city), startsAt: e.startsAt, location: e.location, price: e.price, youGoing: e.going.includes(viewerId), targetsGoing: targetsGoing.map(first), targetsInterested: targetsInterested.map(first), friendsGoing: friendsGoing.slice(0, 5) };
    })
    .filter((e) => e.targetsGoing.length || e.targetsInterested.length || e.friendsGoing.length >= 2 || e.youGoing)
    .slice(0, 12);
  const rides = db()
    .rides.filter((r) => r.seatsOpen > 0 && r.driverId !== viewerId && canSeeUser(viewerId, getUser(r.driverId)!) && cities.has(r.toCity) && new Date(r.departAt).getTime() > Date.now())
    .map((r) => ({ id: r.id, driver: getUser(r.driverId)!.name, fromCity: r.fromCity, toCity: r.toCity, departAt: r.departAt, returnAt: r.returnAt, seatsOpen: r.seatsOpen, gasSplitUsd: r.costShareUsd }));
  return { you: { id: me.id, name: me.name, city: me.city, cityName: cityName(me.city), hasCar: !!me.hasCar }, crew: target.crewName, people, weekends, events, rides, today: new Date().toISOString().slice(0, 10) };
}

const getContextTool = (viewerId: ID, target: PlanTarget): ToolDef<Record<string, never>> => ({
  name: "get_context",
  description: "Everything about this reconnection in one call: the people (city, how you know them, what they posted lately, your shared history), the next 6 weekends with quick availability, events in your cities, rides with seats. Start here.",
  parameters: { type: "object", properties: {} },
  run: () => contextFor(viewerId, target),
});

const estimateTool: ToolDef<{ shape: PlanShape; city: string; nights?: number; transport?: TransportMode; lodging?: LodgingMode; rideId?: string; eventId?: string }> = {
  name: "estimate_cost",
  description: "What a plan costs per person, from seeded prices. visit = travel to their city (nights, transport, lodging). hangout = a night out in one city. event = the event's ticket. call = free. Always call this; never write numbers yourself.",
  parameters: { type: "object", properties: { shape: { type: "string", enum: ["visit", "hangout", "event", "call"] }, city: { type: "string" }, nights: { type: "integer" }, transport: { type: "string", enum: ["ride", "own-car", "bus", "flight"] }, lodging: { type: "string", enum: ["host", "hostel", "hotel"] }, rideId: { type: "string" }, eventId: { type: "string" } }, required: ["shape", "city"] },
  run: (a, { userId }) => costFor(userId, a),
};

export function costFor(viewerId: ID, a: { shape: PlanShape; city: string; nights?: number; transport?: TransportMode; lodging?: LodgingMode; rideId?: string; eventId?: string }) {
  const me = getUser(viewerId)!;
  if (!cityById(a.city)) return { error: `unknown city ${a.city}` };
  if (a.shape === "call") return { each: CALL_USD, lines: [{ label: "a call", usd: 0 }], note: "free" };
  const ev = a.eventId ? db().events.find((e) => e.id === a.eventId) : undefined;
  const ticket = ev?.price ? Number((ev.price.match(/\$\s?(\d+)/) ?? [])[1] ?? 0) : 0;
  if (a.shape === "hangout" || (a.shape === "event" && a.city === me.city)) {
    const lines = [...(ev ? [{ label: `${ev.title.slice(0, 40)} (${ev.price ?? "free"})`, usd: ticket }] : []), { label: "a night out, seeded estimate", usd: HANGOUT_USD }];
    return { each: lines.reduce((n, l) => n + l.usd, 0), lines, note: "in town, no travel" };
  }
  // visit, or an event in another city
  const ride = a.rideId ? db().rides.find((r) => r.id === a.rideId) : undefined;
  const miles = twoPrices({ fromCity: me.city!, toCity: a.city, nights: 1, transport: "bus", lodging: "hostel" }).miles;
  const transport: TransportMode = ride ? "ride" : a.transport ?? (me.hasCar ? "own-car" : miles > 600 ? "flight" : "bus");
  const nights = Math.max(0, Math.min(7, a.nights ?? 2));
  const lodging: LodgingMode = nights === 0 ? "host" : a.lodging ?? "host";
  const p = twoPrices({ fromCity: me.city!, toCity: a.city, nights, transport, lodging, carOccupants: ride ? 2 + ride.riderIds.length : 1, withLocal: true, rideShareUsd: ride?.costShareUsd });
  const lines = [...p.ifYes.lines, ...(ticket ? [{ label: `${ev!.title.slice(0, 40)} ticket`, usd: ticket }] : [])];
  return { each: lines.reduce((n, l) => n + l.usd, 0), lines, ifNo: p.otherwise, miles: p.miles, driveHours: p.driveHours, note: `${nights} night${nights === 1 ? "" : "s"}, ${lodging === "host" ? "staying with them if they say yes" : lodging}, by ${transport === "ride" ? "a friend's car" : transport}` };
}

export const PROPOSE_PLANS_SCHEMA = {
  type: "object",
  properties: {
    plans: {
      type: "array", maxItems: 3,
      items: {
        type: "object",
        properties: {
          shape: { type: "string", enum: ["visit", "hangout", "event", "call"] },
          title: { type: "string", description: "Short and specific, lowercase-leaning: 'chicago weekend with nadia and arjun'" },
          pitch: { type: "string", description: "Two sentences in the house voice on why THIS plan, grounded in what they posted or your shared history." },
          start: { type: "string", description: "YYYY-MM-DD" },
          end: { type: "string", description: "YYYY-MM-DD (same as start for a call or a night out)" },
          city: { type: "string", description: "city id where it happens" },
          personIds: { type: "array", items: { type: "string" }, description: "who is in it (the target people, plus others from get_context)" },
          eventId: { type: "string" }, rideId: { type: "string" }, hostId: { type: "string", description: "for a visit: the friend you'd stay with" },
          nights: { type: "integer" }, transport: { type: "string", enum: ["ride", "own-car", "bus", "flight"] },
          reasons: { type: "array", items: { type: "string" }, description: "2–4 short bullets naming real people, posts, events or rides." },
        },
        required: ["shape", "title", "pitch", "start", "end", "city", "personIds", "reasons"],
      },
    },
    declineReason: { type: "string" },
  },
  required: ["plans"],
};
export interface ProposedPlan { shape: PlanShape; title: string; pitch: string; start: string; end: string; city: string; personIds: string[]; eventId?: string; rideId?: string; hostId?: string; nights?: number; transport?: TransportMode; reasons: string[] }
export interface PlanProposal { plans: ProposedPlan[]; declineReason?: string }

const SYSTEM = `You plan ways for a person to actually see a friend (or a crew) they've drifted from, inside a Facebook-style app. You never pick a destination for its own sake: every plan exists because of these specific people, what they posted, where they live, what they're already going to, and who's driving.

Work in this order, few round trips:
1. get_context once.
2. Pick 2–3 plans of DIFFERENT shapes where they make sense: a visit to their city (when they live elsewhere), a hangout in town (same city, or an event there), an event one of you is already going to / interested in, and a call as the low-effort option. Prefer weekends where nobody is quick-busy and the user is not busy. If get_context shows a ride with open seats to that city, use it (rideId + transport "ride"). For a visit, hostId = the friend you'd stay with.
3. infer_availability(userIds, start, end) ONCE for the target people on your top weekend (it reads their RSVPs, posts, and the user's own chats with them). "busy" rules that weekend out; "unknown" is fine, the app will ask.
4. estimate_cost for each plan, all in one turn. Never add numbers yourself and never write dollar amounts in words you return.
5. propose_plans exactly once, every id from tool results, plans in the order you'd suggest them. If nothing honest exists, propose an empty list with a one-line declineReason.
Voice: a sharp friend texting, lowercase-leaning, concrete. Reasons name a real post, event, ride or line someone wrote. Never say anyone "will host" or "is coming": nobody has said yes yet. Never mention mood, health, loneliness, or how long it's been as a guilt line.`;

export async function planGathering(viewerId: ID, target: PlanTarget, onStep?: (s: PlanRun["steps"][number]) => void): Promise<PlanRun> {
  const me = getUser(viewerId);
  if (!me) throw new Error("unknown user");
  const personIds = [...new Set(target.personIds)].filter((id) => id !== viewerId && connection(viewerId, id));
  if (!personIds.length) throw Object.assign(new Error("nobody to plan with"), { status: 400 });
  const t = { ...target, personIds };
  const t0 = Date.now();
  const steps: PlanRun["steps"] = [];
  const push = (kind: string, text: string, detail?: string) => {
    const s = { i: steps.length, at: Date.now() - t0, kind, text, detail };
    steps.push(s);
    onStep?.(s);
  };
  let proposal: PlanProposal | undefined;
  const proposeTool: ToolDef<PlanProposal> = { name: "propose_plans", description: "Submit the final 2–3 plans (or a decline). Call exactly once, at the end.", parameters: PROPOSE_PLANS_SCHEMA, run: (p) => { proposal = p; return { ok: true, received: p.plans?.length ?? 0 }; } };
  const who = t.crewName ? `${t.crewName} (${personIds.map(first).join(", ")})` : personIds.map(first).join(" and ");
  push("info", `Finding a way to see ${who}`);
  const prompt = `I want to actually see ${who} again. My user id is "${viewerId}", I live in ${cityName(me.city)} (${me.city}), ${me.hasCar ? "I have a car" : "no car"}. Today is ${new Date().toISOString().slice(0, 10)}. Find 2–3 real options.`;
  let mode = "live";
  let costUsd = 0;
  try {
    const res = await ai.tools(prompt, {
      task: "reconnect.plan", userId: viewerId, system: SYSTEM, maxSteps: 7, maxTokens: 2000, temperature: 0.4, stopOnTool: "propose_plans",
      tools: [getContextTool(viewerId, t) as ToolDef, inferAvailabilityTool as ToolDef, estimateTool as ToolDef, proposeTool as unknown as ToolDef],
      onStep: (s) => {
        const a = (s.args ?? {}) as Record<string, unknown>;
        const r = (s.result ?? {}) as Record<string, unknown>;
        if (s.type === "model") push("model", s.result === "final answer" ? "Writing it up" : "Deciding what to look at", `${s.latencyMs} ms`);
        else if (s.type === "tool_call") {
          if (s.name === "get_context") push("tool", `Reading who ${who.split(" (")[0]} ${personIds.length > 1 ? "are" : "is"}: cities, what they posted, your shared history, the next 6 weekends, events and rides`);
          else if (s.name === "infer_availability") push("tool", `Reading what ${(a.userIds as string[] | undefined)?.map(first).join(", ")} said about ${fmtRange(String(a.start), String(a.end))}: RSVPs, posts, your chats`);
          else if (s.name === "estimate_cost") push("tool", `Pricing a ${a.shape} in ${cityName(String(a.city))}`);
          else if (s.name === "propose_plans") push("tool", `Putting together ${Array.isArray(a.plans) ? a.plans.length : "the"} plan${Array.isArray(a.plans) && a.plans.length === 1 ? "" : "s"}`);
        } else if (s.type === "tool_result") {
          if (r.error) push("result", `That didn't work: ${String(r.error).slice(0, 80)}`);
          else if (s.name === "get_context") push("result", `${(r.people as unknown[]).length} ${personIds.length > 1 ? "people" : "person"} · ${(r.events as unknown[]).length} event${(r.events as unknown[]).length === 1 ? "" : "s"} · ${(r.rides as unknown[]).length} ride${(r.rides as unknown[]).length === 1 ? "" : "s"} with seats · 6 weekends`);
          else if (s.name === "infer_availability") {
            const ps = (r.people ?? []) as { name: string; status: string; summary: string }[];
            push("result", ps.map((p) => `${p.name.split(" ")[0]}: ${p.status.replace("_", " ")}`).join(" · ") || "no signals", ps.filter((p) => p.status !== "unknown").map((p) => `${p.name.split(" ")[0]}: ${p.summary}`).join(" · "));
          } else if (s.name === "estimate_cost") push("result", r.each === undefined ? "priced" : `about $${r.each} each${r.note ? ` · ${r.note}` : ""}`);
        }
      },
      mock: () => "(mock)",
    });
    mode = res.trace.mode;
    costUsd = res.trace.costUsd ?? 0;
    if (res.trace.fallback) push("info", res.trace.fallback === "budget" ? "Budget guard: live calls paused, showing a mock plan" : "Muse unavailable, showing a mock plan");
  } catch (err) {
    push("error", (err as Error).message);
    throw err;
  }
  if (!proposal && mode === "mock") proposal = mockProposal(viewerId, t);
  if (!proposal) proposal = { plans: [], declineReason: "the agent finished without proposing a plan" };
  if (!Array.isArray(proposal.plans)) proposal = { plans: [], declineReason: "the agent's proposal was malformed" };
  push("info", "Checking every person, date, event, ride and dollar in code");
  const plans: Plan[] = [];
  for (const p of proposal.plans.slice(0, 3)) {
    const v = await validatePlan(viewerId, t, p, { mode, costUsd: 0 });
    if (v) plans.push(v);
  }
  const repairs = plans.flatMap((p) => p.repairs);
  if (repairs.length) push("info", `Fixed ${repairs.length} thing${repairs.length === 1 ? "" : "s"} the model got wrong`, repairs.slice(0, 3).join(" · "));
  plans.forEach(savePlan);
  const run: PlanRun = { id: `prun_${Date.now().toString(36)}`, ownerId: viewerId, target: t, plans, declineReason: plans.length ? undefined : proposal.declineReason ?? "nothing honest fits right now", steps, mode, costUsd, latencyMs: Date.now() - t0, createdAt: new Date().toISOString() };
  reconnectStore().runs.unshift(run);
  push("done", plans.length ? `${plans.length} way${plans.length === 1 ? "" : "s"} to see ${who.split(" (")[0]}` : "No plan this time", `${((Date.now() - t0) / 1000).toFixed(1)}s · ${mode}${costUsd ? ` · $${costUsd.toFixed(3)}` : ""}`);
  return run;
}

/** Code's pass over a proposed plan: people must be visible, dates in the future, ids real, costs recomputed, availability attached with quotes. */
export async function validatePlan(viewerId: ID, target: PlanTarget, p: ProposedPlan, meta: { mode: string; costUsd: number }): Promise<Plan | null> {
  const me = getUser(viewerId)!;
  const repairs: string[] = [];
  const sources: Plan["sources"] = [];
  const city = cityById(p.city) ?? cityById(getUser(target.personIds[0])?.city ?? "") ?? cityById(me.city!);
  if (!city) return null;
  if (city.id !== p.city) repairs.push(`city ${p.city} unknown; used ${city.id}`);
  const todayStr = new Date().toISOString().slice(0, 10);
  let start = /^\d{4}-\d{2}-\d{2}$/.test(p.start) ? p.start : "";
  let end = /^\d{4}-\d{2}-\d{2}$/.test(p.end) ? p.end : start;
  if (!start || start < todayStr) { const ds = weekendDates(1); start = ds[0]; end = ds[2]; repairs.push("dates were missing or in the past; used the next weekend"); }
  if (end < start) end = start;
  if ((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000 > 7) { end = datesBetween(start, end)[7] ?? start; repairs.push("plan trimmed to a week"); }
  const shapes: PlanShape[] = ["visit", "hangout", "event", "call"];
  let shape: PlanShape = shapes.includes(p.shape) ? p.shape : "hangout";
  if (shape === "visit" && city.id === me.city) { shape = "hangout"; repairs.push("a visit to your own city is a hangout"); }
  if (shape === "call") end = start;
  // people: targets always, others only if visible
  const ids = [...new Set([...(p.personIds ?? []), ...target.personIds])].filter((id) => id !== viewerId);
  const kept: ID[] = [];
  for (const id of ids) {
    const u = getUser(id);
    if (!u || !canSeeUser(viewerId, u)) { repairs.push(`dropped ${id}: not in your network`); continue; }
    kept.push(id);
  }
  if (!kept.length) return null;
  const avail = await inferMany(viewerId, kept, start, end, city.id);
  const people: PlanPerson[] = kept.map((id) => {
    const u = getUser(id)!;
    const a = avail.find((x) => x.personId === id)!;
    for (const d of a.days) if (d.status !== "unknown" && d.quote) sources.push({ claim: `${first(id)} ${d.status === "busy" ? "busy" : "around"} ${fmtRange(d.date, d.date)}`, source: `${d.source?.kind === "rsvp" ? "RSVP" : d.source?.kind === "chat" ? "your chat" : d.source?.kind === "reply" ? "their reply to you" : "their post"}: “${d.quote}”`, kind: d.source?.kind === "rsvp" ? "rsvp" : d.source?.kind === "post" ? "post" : "chat", id: d.source?.id });
    return { id, name: u.name, avatar: u.avatar, connection: connection(viewerId, id)?.label ?? "friends", city: u.city, availability: a.overall, days: a.days, summary: a.summary };
  });
  const targetsBusy = target.personIds.filter((id) => people.find((x) => x.id === id)?.availability === "busy");
  if (targetsBusy.length === target.personIds.length) repairs.push(`${targetsBusy.map(first).join(", ")} ${targetsBusy.length === 1 ? "looks" : "look"} busy then; kept the plan but flagged it`);
  // event
  let event: Plan["event"];
  if (p.eventId) {
    const e = db().events.find((x) => x.id === p.eventId);
    if (!e || !canSeeEvent(viewerId, e)) repairs.push(`dropped event ${p.eventId}: not found`);
    else {
      event = { id: e.id, title: e.title, startsAt: e.startsAt, location: e.location, price: e.price };
      const day = e.startsAt.slice(0, 10);
      if (day < start || day > end) { start = day; end = day > end ? day : end; repairs.push(`dates moved to the event's day`); }
      const going = kept.filter((id) => e.going.includes(id) || e.interested.includes(id));
      if (going.length) sources.push({ claim: `${going.map(first).join(", ")} ${going.length === 1 ? "is" : "are"} going or interested`, source: `RSVP on ${e.title}`, kind: "rsvp", id: e.id });
    }
  }
  if (shape === "event" && !event) { shape = city.id === me.city ? "hangout" : "visit"; repairs.push("event shape without a real event; reshaped"); }
  // an RSVP to the plan's own event is the best availability signal there is: code marks that day likely free
  if (event) for (const person of people) {
    const e = db().events.find((x) => x.id === event!.id)!;
    if (person.availability === "unknown" && e.going.includes(person.id)) {
      person.availability = "likely_free";
      person.summary = `RSVP'd going to ${e.title.split(":")[0]}`;
      person.days = person.days.map((d) => (d.date === e.startsAt.slice(0, 10) ? { ...d, status: "likely_free", reason: "RSVP'd going", quote: e.title, source: { kind: "rsvp", id: e.id }, confidence: "high" } : d));
    }
  }
  // ride
  let ride: Plan["ride"];
  if (p.rideId) {
    const r = db().rides.find((x) => x.id === p.rideId);
    if (!r || r.seatsOpen <= 0 || !canSeeUser(viewerId, getUser(r.driverId)!) || !rideTouches(r.departAt, r.returnAt, start, end) || r.toCity !== city.id) repairs.push(`dropped ride ${p.rideId}: no seat, wrong dates or wrong city`);
    else { ride = { id: r.id, driverId: r.driverId, driverName: getUser(r.driverId)!.name, seatsOpen: r.seatsOpen, departAt: r.departAt }; sources.push({ claim: `${first(r.driverId)} is driving with ${r.seatsOpen} seat${r.seatsOpen === 1 ? "" : "s"}`, source: r.note ?? "a ride they posted", kind: "ride", id: r.id }); }
  }
  if (!ride && shape === "visit") {
    const r = db().rides.find((x) => x.toCity === city.id && x.fromCity === me.city && x.seatsOpen > 0 && me.friendIds.includes(x.driverId) && rideTouches(x.departAt, x.returnAt, start, end));
    if (r) { ride = { id: r.id, driverId: r.driverId, driverName: getUser(r.driverId)!.name, seatsOpen: r.seatsOpen, departAt: r.departAt }; repairs.push(`attached ${first(r.driverId)}'s ride: a friend is driving there with a seat`); sources.push({ claim: `${first(r.driverId)} is driving with ${r.seatsOpen} seat${r.seatsOpen === 1 ? "" : "s"}`, source: r.note ?? "a ride they posted", kind: "ride", id: r.id }); }
  }
  // host
  let hostId: ID | undefined;
  const outOfTown = city.id !== me.city;
  if (outOfTown) {
    const cand = p.hostId && kept.includes(p.hostId) && getUser(p.hostId)?.city === city.id ? p.hostId : kept.find((id) => getUser(id)?.city === city.id);
    if (cand) hostId = cand;
    if (p.hostId && hostId !== p.hostId) repairs.push(`host ${p.hostId} doesn't live in ${city.name}; ${hostId ? `asking ${first(hostId)} instead` : "no host"}`);
  }
  // cost, in code
  const nights = outOfTown ? Math.max(1, Math.min(7, p.nights ?? Math.max(1, datesBetween(start, end).length - 1))) : 0;
  const c = costFor(viewerId, { shape, city: city.id, nights, transport: p.transport, lodging: hostId ? "host" : "hostel", rideId: ride?.id, eventId: event?.id }) as { each: number; lines: { label: string; usd: number }[]; ifNo?: Plan["cost"]["ifNo"]; note: string; error?: string };
  if (c.error) return null;
  for (const l of c.lines) sources.push({ claim: `$${l.usd} ${l.label}`, source: "seeded price table, computed in code", kind: "price" });
  // words: strip model-written money
  const MONEY = /\$\s?\d|\b\d+\s?(dollars|bucks)\b/i;
  const reasons = (p.reasons ?? []).filter((r) => { if (MONEY.test(r)) repairs.push("dropped a reason with a model-written price"); return !MONEY.test(r); }).slice(0, 4);
  const pitch = (p.pitch ?? "").split(/(?<=[.!?])\s+/).filter((x) => !MONEY.test(x)).join(" ").trim();
  sources.push({ claim: "title, pitch and reasons", source: `written by Muse (${meta.mode}); every id and number above was re-checked in code`, kind: "model" });
  const plan: Plan = {
    id: `plan_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, ownerId: viewerId, target, shape,
    title: (p.title?.trim() || `${shape} with ${kept.map(first).join(" and ")}`).replace(/\$\s?\d+/g, "").trim(), pitch, reasons,
    start, end, city: city.id, cityName: city.name, people, event, ride, hostId,
    cost: { each: c.each, lines: c.lines, ifNo: c.ifNo, note: c.note }, sources, repairs, status: "proposed", mode: meta.mode, costUsd: meta.costUsd, createdAt: new Date().toISOString(),
  };
  return plan;
}

/** Mock mode: one honest code-written plan per shape that applies. Labelled mock upstream. */
function mockProposal(viewerId: ID, target: PlanTarget): PlanProposal {
  const me = getUser(viewerId)!;
  const ds = weekendDates(1);
  const t = getUser(target.personIds[0])!;
  const plans: ProposedPlan[] = [];
  if (t.city && t.city !== me.city) plans.push({ shape: "visit", title: `(mock) ${cityName(t.city).toLowerCase()} with ${first(t.id)}`, pitch: `(mock) ${first(t.id)} lives in ${cityName(t.city)}.`, start: ds[0], end: ds[2], city: t.city, personIds: target.personIds, hostId: t.id, nights: 2, reasons: [`${t.name} lives there`] });
  else plans.push({ shape: "hangout", title: `(mock) a night with ${first(t.id)}`, pitch: `(mock) same city.`, start: ds[1], end: ds[1], city: me.city!, personIds: target.personIds, reasons: [`${t.name} is in ${cityName(me.city)}`] });
  plans.push({ shape: "call", title: `(mock) a call with ${first(t.id)}`, pitch: "(mock) low effort.", start: ds[2], end: ds[2], city: me.city!, personIds: target.personIds, reasons: ["twenty minutes"] });
  return { plans };
}

export const plansFor = (viewerId: ID) => [...reconnectStore().plans.values()].filter((p) => p.ownerId === viewerId || (p.status !== "proposed" && p.people.some((x) => x.id === viewerId))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
