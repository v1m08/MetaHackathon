// The Discover agent: a real Muse tool-calling loop over the viewer's network. The model decides which tools to
// call and what to propose; code decides what is allowed to render (validate.ts) and what things cost (pricing.ts).
import { cityById } from "@/data/cities";
import { ai, type TraceStep } from "@/lib/ai";
import { getUser } from "@/server/db";
import type { ID } from "@/types";
import { findDiscoverRecording, forceReplay, replaySteps } from "./replay";
import { recordRun, saveTrips, type DiscoverRun, type StreamStep } from "./store";
import { cityName, discoverTools, PROPOSE_SCHEMA, visiblePeople, type Proposal } from "./tools";
import { rankTrips, validateTrip, type Trip } from "./validate";

export interface DiscoverInput {
  start: string; // YYYY-MM-DD
  end: string;
  budget: number;
  hint?: string;
}

const fmtRange = (start: string, end: string) => {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const mo = (d: Date) => d.toLocaleString("en-US", { month: "short" });
  return mo(s) === mo(e) ? `${mo(s)} ${s.getDate()}–${e.getDate()}` : `${mo(s)} ${s.getDate()} – ${mo(e)} ${e.getDate()}`;
};
const names = (list: unknown, max = 3) => {
  const arr = Array.isArray(list) ? (list as { name?: string }[]) : [];
  const n = arr.map((x) => x.name?.split(" ")[0]).filter(Boolean) as string[];
  return n.length <= max ? n.join(", ") : `${n.slice(0, max).join(", ")} +${n.length - max}`;
};

/** Turn a raw tool step into the line a judge reads on screen. */
export function describeStep(s: TraceStep, prev?: TraceStep): Omit<StreamStep, "i" | "at"> | null {
  const a = (s.args ?? {}) as Record<string, unknown>;
  const r = (s.result ?? {}) as Record<string, unknown>;
  if (s.type === "model") return { kind: "model", text: s.result === "final answer" ? "Writing up what I found" : "Deciding what to look at next", detail: `${s.latencyMs} ms` };
  if (s.type === "tool_call") {
    switch (s.name) {
      case "get_my_travel_profile": return { kind: "tool", tool: s.name, text: "Reading your profile, saved Reels and busy dates" };
      case "scan_network": return { kind: "tool", tool: s.name, text: `Mapping your whole network: who lives where, who hosts, who's driving ${fmtRange(String(a.start), String(a.end))}` };
      case "find_people_by_city": return { kind: "tool", tool: s.name, text: a.city ? `Checking who you know in ${cityName(String(a.city))}` : "Mapping your network across every city" };
      case "get_travel_events_and_rides": return { kind: "tool", tool: s.name, text: `Looking for events and rides ${fmtRange(String(a.start), String(a.end))}` };
      case "infer_availability": return { kind: "tool", tool: s.name, text: `Reading what ${(a.userIds as string[] | undefined)?.map((id) => getUser(id)?.name.split(" ")[0] ?? id).slice(0, 4).join(", ")} said about ${fmtRange(String(a.start), String(a.end))}: RSVPs, posts, your chats with them`, ids: a.userIds as string[] };
      case "estimate_trip_cost": return { kind: "tool", tool: s.name, text: `Pricing ${cityName(String(a.toCity))}: ${a.nights} night${a.nights === 1 ? "" : "s"}, ${a.lodging === "host" ? "staying with a friend" : a.lodging}, by ${a.transport === "ride" ? "a friend's car" : a.transport}` };
      case "get_city_media": return { kind: "tool", tool: s.name, text: `Reading your friends' photos and Reels from ${cityName(String(a.city))}` };
      case "propose_trips": {
        const n = Array.isArray(a.trips) ? a.trips.length : undefined;
        return { kind: "tool", tool: s.name, text: n === undefined ? "Putting the trips together" : `Putting together ${n} trip${n === 1 ? "" : "s"}` };
      }
    }
    return { kind: "tool", tool: s.name, text: `Using ${s.name}` };
  }
  if (s.type === "tool_result") {
    if (r.error) return { kind: "result", tool: s.name, text: `That didn't work: ${String(r.error).slice(0, 80)}` };
    switch (s.name) {
      case "get_my_travel_profile": return { kind: "result", tool: s.name, text: `You're ${r.tasteSummary}${r.hasCar ? "" : ", no car"}` };
      case "scan_network": {
        const cities = (r.cities ?? []) as { city: string; people: { id: string; freeThatWeekend: boolean; openToHosting: boolean }[]; hostsOpen: number }[];
        const people = cities.flatMap((c) => c.people);
        const hostsFree = people.filter((p) => p.openToHosting && p.freeThatWeekend).length;
        const ev = (r.events ?? []) as { id: string; title: string; cityName: string }[];
        const rides = (r.rides ?? []) as { id: string; toCityName: string; seatsOpen: number }[];
        const prof = (r.profile ?? {}) as { tasteSummary?: string; hasCar?: boolean };
        return { kind: "result", tool: s.name, text: `${people.length} people in ${cities.length} cities · ${hostsFree} hosts free that weekend · ${ev.length} event${ev.length === 1 ? "" : "s"} · ${rides.length} ride${rides.length === 1 ? "" : "s"} with seats`, detail: `you're ${prof.tasteSummary ?? ""}${prof.hasCar ? "" : ", no car"}${ev.length ? " · " + ev.map((e) => `${e.title} (${e.cityName})`).slice(0, 3).join(" · ") : ""}${rides.length ? " · " + rides.map((x) => `→ ${x.toCityName}, ${x.seatsOpen} seats`).slice(0, 3).join(" · ") : ""}`, ids: [...people.map((p) => p.id), ...ev.map((e) => e.id), ...rides.map((x) => x.id)] };
      }
      case "find_people_by_city": {
        const cities = (r.cities ?? []) as { city: string; people: { id: string }[]; hostsOpen: number }[];
        const people = cities.reduce((n, c) => n + c.people.length, 0);
        const hosts = cities.reduce((n, c) => n + c.hostsOpen, 0);
        return { kind: "result", tool: s.name, text: `${people} people in ${cities.length} cities, ${hosts} open to hosting`, ids: cities.flatMap((c) => c.people.map((p) => p.id)) };
      }
      case "get_travel_events_and_rides": {
        const ev = (r.events ?? []) as { id: string; title: string; cityName: string }[];
        const rides = (r.rides ?? []) as { id: string; toCityName: string; seatsOpen: number }[];
        return { kind: "result", tool: s.name, text: `${ev.length} event${ev.length === 1 ? "" : "s"} your people are going to, ${rides.length} ride${rides.length === 1 ? "" : "s"} with open seats`, detail: [...ev.map((e) => `${e.title} (${e.cityName})`), ...rides.map((x) => `→ ${x.toCityName}, ${x.seatsOpen} seats`)].slice(0, 6).join(" · "), ids: [...ev.map((e) => e.id), ...rides.map((x) => x.id)] };
      }
      case "infer_availability": {
        const people = (r.people ?? []) as { id: string; name: string; status: string; summary: string }[];
        const by = (st: string) => people.filter((p) => p.status === st);
        const parts = [by("confirmed").length ? `${names(by("confirmed"))} confirmed` : "", by("likely_free").length ? `${names(by("likely_free"))} likely free` : "", by("busy").length ? `${names(by("busy"))} busy` : "", by("unknown").length ? `${names(by("unknown"))} unknown (we'll ask)` : ""].filter(Boolean);
        return { kind: "result", tool: s.name, text: parts.join(" · ") || "no signals", detail: people.filter((p) => p.status !== "unknown").map((p) => `${p.name.split(" ")[0]}: ${p.summary}`).slice(0, 4).join(" · "), ids: people.map((p) => p.id) };
      }
      case "estimate_trip_cost": return { kind: "result", tool: s.name, text: `about $${r.ifYes} if they say yes, about $${r.otherwise} otherwise`, detail: `${r.miles} mi · ${r.driveHours}h drive · hotel + solo would be $${r.soloHotelTrip}` };
      case "get_city_media": {
        const items = (r.items ?? []) as { author: string; kind: string }[];
        const by = new Map<string, number>();
        items.forEach((i) => by.set(i.author.split(" ")[0], (by.get(i.author.split(" ")[0]) ?? 0) + 1));
        return { kind: "result", tool: s.name, text: `Read ${items.length} photo${items.length === 1 ? "" : "s"} from ${cityName(String(r.city))}`, detail: [...by].map(([n, c]) => `${c} of ${n}'s`).slice(0, 4).join(", ") };
      }
      case "propose_trips": return null;
    }
    return { kind: "result", tool: s.name, text: "Done" };
  }
  void prev;
  return null;
}

const SYSTEM = `You are the travel agent inside a Facebook-style app. The user gives a weekend and a budget, never a destination. You find trips that exist ONLY because of people they know: a friend open to hosting, a friend driving there with a seat, an event their people are going to, friends' photos from the place.

Work in exactly this order, few round trips:
1. scan_network(start, end) once. People carry openDoor (what they offer, and openToYou = whether their door is open to this user) and a quick availability (busy/unknown from RSVPs).
2. Pick 2–3 candidate cities. Prefer: a ride with open seats leaving from the user's city, an event their people are going to, a direct friend whose door is open to the user. Close ties beat friends-of-friends; a friend-of-friend is allowed only with the named "via" mutual, and you must say so. Never pick a host whose openDoor.openToYou is false.
3. infer_availability(userIds, start, end) ONCE for your candidate hosts and drivers (up to 8 ids). It reads their RSVPs, posts and the user's chats with them. "busy" rules them out; "unknown" is fine (the app will ask them).
4. estimate_trip_cost for each candidate, all in ONE turn (several calls at once). Use transport "ride" when a ride exists, "own-car" if the user has a car, else bus under ~600 miles, flight above. lodging "host" only when the host has openToHosting=true, openDoor.openToYou=true AND is not busy. Never add numbers yourself.
5. get_city_media for your top 1–2 cities, in one turn, so the pitch mentions something a friend actually posted.
6. propose_trips exactly once, 2–3 trips in different cities, each with every id taken from tool results. Say plainly if a trip is over budget; if NOTHING fits the budget, propose only the single closest option and say by how much it misses, or decline. A trip must rest on at least one person: a free host who opted in, a driver with a seat, or a friend going to an event there. If none of those exist anywhere in the network for this weekend, do NOT invent a hostel-only trip: propose an empty list with an honest declineReason that says what was missing (e.g. "nobody you know who's open to hosting is free Dec 4–6, and no one's driving anywhere").
Say "open to hosting" or "has hosting on", never "is hosting" or "will host": nobody has said yes yet; the price line handles the "if". Never write dollar amounts, totals or "$X over" in title, pitch or reasons: the card shows the exact prices computed by estimate_trip_cost, and any number you write will be removed. Describe the money in words instead ("cheapest option in your network", "a bit over what you said").
Voice for title/pitch/reasons: a sharp friend texting, lowercase-leaning, concrete, 3–4 short reasons, no marketing words.`;

export async function discover(userId: ID, input: DiscoverInput, onStep?: (s: StreamStep) => void): Promise<DiscoverRun> {
  const me = getUser(userId);
  if (!me) throw new Error("unknown user");
  const t0 = Date.now();
  const steps: StreamStep[] = [];
  const push = (s: Omit<StreamStep, "i" | "at">) => {
    const full: StreamStep = { ...s, i: steps.length, at: Date.now() - t0 };
    steps.push(full);
    onStep?.(full);
  };
  let proposal: Proposal | undefined;
  const nights = Math.max(1, Math.round((new Date(input.end).getTime() - new Date(input.start).getTime()) / 86_400_000));
  const prompt = `I'm free ${fmtRange(input.start, input.end)} (${input.start} to ${input.end}, ${nights} night${nights === 1 ? "" : "s"}) and I can spend about $${input.budget} total. Where can my people take me?${input.hint ? ` Also: ${input.hint}` : ""}\nMy user id is "${userId}" and I live in ${cityName(me.city)} (${me.city}). Today is ${new Date().toISOString().slice(0, 10)}.`;

  push({ kind: "info", text: `Starting from ${cityName(me.city)}, ${fmtRange(input.start, input.end)}, about $${input.budget}` });
  let rawSteps: TraceStep[] = [];
  let mode = "live";
  let costUsd = 0;
  let model = "";

  /** Replay a recorded real run: same steps and pacing, trips re-validated against the current store. */
  const replay = async (why: string): Promise<DiscoverRun | null> => {
    const rec = findDiscoverRecording(userId, input.start, input.budget);
    if (!rec) return null;
    push({ kind: "info", text: why, detail: `recorded ${new Date(rec.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" })} · ${rec.viewerId} · ${fmtRange(rec.input.start, rec.input.end)} · $${rec.input.budget}` });
    await replaySteps(rec.steps.filter((s) => s.kind !== "info" || !/^Starting from/.test(s.text)), (s) => push({ ...s }));
    const proposalFromRec: Proposal = { trips: rec.trips.map((t) => ({ city: t.city, title: t.title, pitch: t.pitch, hostId: t.host?.id, rideId: t.ride?.id, eventId: t.event?.id, peopleIds: t.people.map((p) => p.id), evidence: t.evidence.map((e) => ({ kind: e.kind, id: e.id })), nights: t.nights, reasons: t.reasons })), declineReason: rec.declineReason };
    const validated = rankTrips(proposalFromRec.trips.map((p) => validateTrip(userId, p, input)).filter((t): t is Trip => !!t)).slice(0, 3);
    saveTrips(validated);
    const run: DiscoverRun = { id: `run_${Date.now().toString(36)}`, viewerId: userId, input, steps, rawSteps: rec.rawSteps ?? [], trips: validated, declineReason: validated.length ? undefined : rec.declineReason ?? "nothing in the recording survived validation", mode: "replay", costUsd: 0, latencyMs: Date.now() - t0, model: rec.model, createdAt: new Date().toISOString() };
    push({ kind: "done", text: validated.length ? `${validated.length} trip${validated.length === 1 ? "" : "s"} (replayed from a real run)` : "No trip this time", detail: `${(run.latencyMs / 1000).toFixed(1)}s · replay` });
    recordRun(run);
    return run;
  };
  if (forceReplay()) {
    const r = await replay("Replay mode is on: replaying a recorded Muse run");
    if (r) return r;
  }
  try {
    const res = await ai.tools(prompt, {
      task: "travel.discover",
      userId,
      tools: discoverTools((p) => (proposal = p)),
      system: SYSTEM,
      maxSteps: 9,
      maxTokens: 2200,
      temperature: 0.4,
      stopOnTool: "propose_trips",
      onStep: (s) => {
        const d = describeStep(s);
        if (d) push(d);
      },
      mock: () => "(mock)",
    });
    rawSteps = res.steps;
    mode = res.trace.mode;
    costUsd = res.trace.costUsd ?? 0;
    model = res.trace.model;
    if (res.trace.fallback) {
      const r = await replay(res.trace.fallback === "budget" ? "Budget guard: live calls paused, replaying a recorded run" : "Muse didn't answer, replaying a recorded run");
      if (r) return r;
      push({ kind: "info", text: res.trace.fallback === "budget" ? "Budget guard: live calls paused, showing a mock run" : "Muse unavailable, showing a mock run" });
    }
  } catch (err) {
    push({ kind: "error", text: (err as Error).message });
    throw err;
  }

  // Mock mode never calls propose_trips: build a code-only proposal from the store so the UI still works.
  if (!proposal && mode === "mock") proposal = mockProposal(userId, input);
  if (!proposal) proposal = { trips: [], declineReason: "the agent finished without proposing a trip" };
  if (!Array.isArray(proposal.trips)) {
    // The model emitted its proposal as broken text (unescaped quotes, truncation). One structured repair call.
    push({ kind: "info", text: "The proposal came back as broken text; asking Muse to restate it as valid JSON" });
    try {
      const { data, trace } = await ai.json<Proposal>(`Restate this trip proposal as valid JSON matching the schema. Keep every id, number and sentence exactly as written; do not add or remove trips.\n\n${String(proposal.trips).slice(0, 12000)}`, { task: "travel.discover.repair", userId, schema: PROPOSE_SCHEMA, maxTokens: 2500, temperature: 0, mock: () => ({ trips: [], declineReason: "mock repair" }) });
      costUsd += trace.costUsd ?? 0;
      proposal = Array.isArray(data?.trips) ? data : { trips: [], declineReason: "the agent's proposal was malformed" };
    } catch {
      proposal = { trips: [], declineReason: "the agent's proposal was malformed" };
    }
  }

  push({ kind: "info", text: `Checking every person, ride, event and photo against what you can actually see` });
  const validated = rankTrips(proposal.trips.map((p) => validateTrip(userId, p, input)).filter((t): t is Trip => !!t)).slice(0, 3);
  const repairs = validated.flatMap((t) => t.repairs);
  if (repairs.length) push({ kind: "info", text: `Fixed ${repairs.length} thing${repairs.length === 1 ? "" : "s"} the model got wrong`, detail: repairs.slice(0, 3).join(" · ") });
  saveTrips(validated);
  const run: DiscoverRun = { id: `run_${Date.now().toString(36)}`, viewerId: userId, input, steps, rawSteps, proposal, trips: validated, declineReason: validated.length ? undefined : proposal.declineReason ?? "nobody in your network is open to hosting there that weekend within your budget", mode, costUsd, latencyMs: Date.now() - t0, model, createdAt: new Date().toISOString() };
  push({ kind: "done", text: validated.length ? `${validated.length} trip${validated.length === 1 ? "" : "s"} that only exist because of your people` : "No trip this time", detail: `${(run.latencyMs / 1000).toFixed(1)}s · ${mode}${costUsd ? ` · $${costUsd.toFixed(3)}` : ""}` });
  recordRun(run);
  return run;
}

/** Code-only proposal for mock mode: hosts first, then rides, honest and boring. Labelled mock upstream. */
function mockProposal(userId: ID, input: DiscoverInput): Proposal {
  const me = getUser(userId)!;
  const people = visiblePeople(userId).filter((u) => u.city && u.city !== me.city);
  const hosts = people.filter((u) => u.openToHosting);
  const byCity = new Map<string, typeof hosts>();
  hosts.forEach((h) => byCity.set(h.city!, [...(byCity.get(h.city!) ?? []), h]));
  const trips = [...byCity.entries()].slice(0, 3).map(([city, hs]) => {
    const host = hs.sort((a, b) => (me.friendIds.includes(a.id) ? 0 : 1) - (me.friendIds.includes(b.id) ? 0 : 1))[0];
    return { city, title: `${cityById(city)?.name.toLowerCase()} with ${host.name.split(" ")[0]}`, pitch: `(mock) ${host.name.split(" ")[0]} is open to hosting in ${cityById(city)?.name}.`, hostId: host.id, nights: 2, reasons: [`${host.name} has hosting turned on`], peopleIds: people.filter((p) => p.city === city && p.id !== host.id).slice(0, 3).map((p) => p.id) };
  });
  void input;
  return { trips, declineReason: trips.length ? undefined : "nobody in your network is open to hosting" };
}
