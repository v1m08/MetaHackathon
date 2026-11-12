// Nothing the model says reaches the screen unchecked. Every person, event, ride, post and reel id in a proposal
// is validated against the store AND against what this viewer can see; anything that fails is dropped or repaired.
// Costs are recomputed here from seeded prices, so the two numbers on a card are never model arithmetic.
import { cityById, milesBetween } from "@/data/cities";
import { cardFor, db, getUser } from "@/server/db";
import type { FBEvent, ID, Ride } from "@/types";
import { twoPrices, type CostBreakdown, type LodgingMode, type TransportMode } from "./pricing";
import { cityMediaFor, datesBetween, type ProposedTrip } from "./tools";
import { canSeeEvent, canSeePost, canSeeReel, canSeeUser, connection } from "./visibility";
import { quickStatus } from "./availability";

export interface TripPerson {
  id: ID;
  name: string;
  avatar: string;
  connection: string;
  degree: 1 | 2;
  via?: { id: ID; name: string };
  openToHosting: boolean;
  hostingNote?: string;
  hasCar: boolean;
  /** From inferred/quick availability for the trip's dates; "busy" is the only value that blocks a host. */
  availability: "confirmed" | "likely_free" | "busy" | "unknown";
  freeThatWeekend: boolean;
}
export interface Trip {
  id: string;
  viewerId: ID;
  city: string;
  cityName: string;
  state: string;
  start: string;
  end: string;
  nights: number;
  budget: number;
  title: string;
  pitch: string;
  reasons: string[];
  host?: TripPerson;
  ride?: { id: string; driver: TripPerson; fromCity: string; toCity: string; departAt: string; returnAt: string; seatsOpen: number; note?: string };
  event?: { id: string; title: string; startsAt: string; location: string; price?: string; goingYouKnow: { id: ID; name: string; avatar: string; connection: string }[] };
  people: TripPerson[];
  evidence: { kind: "post" | "reel"; id: string; authorId: ID; author: string; image: string; caption: string }[];
  prices: { ifYes: CostBreakdown; otherwise: CostBreakdown; solo: CostBreakdown; miles: number; driveHours: number; transportIfYes: TransportMode; lodgingIfYes: LodgingMode; conditions: string[] };
  fitsBudget: boolean;
  /** What validation changed, for the Inspector and the eval. */
  repairs: string[];
  createdAt: string;
}

const tripId = () => `trip_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function tripPerson(viewerId: ID, id: ID, dates: string[], context?: string): TripPerson | null {
  const u = getUser(id);
  if (!u || !canSeeUser(viewerId, u)) return null;
  const c = connection(viewerId, id);
  if (!c) return null;
  const via = c.via ? getUser(c.via) : undefined;
  const availability = dates.length ? quickStatus(viewerId, id, dates[0], dates[dates.length - 1], context) : "unknown";
  return { id: u.id, name: u.name, avatar: u.avatar, connection: c.label, degree: c.degree, via: via ? { id: via.id, name: via.name } : undefined, openToHosting: !!u.openToHosting, hostingNote: u.openToHosting ? u.hostingNote : undefined, hasCar: !!u.hasCar, availability, freeThatWeekend: availability !== "busy" };
}

function overlaps(r: Ride, start: string, end: string) {
  const dep = r.departAt.slice(0, 10);
  const ret = r.returnAt.slice(0, 10);
  // allow leaving a day early / returning a day late
  const s = new Date(start + "T00:00:00");
  s.setDate(s.getDate() - 1);
  const e = new Date(end + "T00:00:00");
  e.setDate(e.getDate() + 1);
  return dep >= s.toISOString().slice(0, 10) && ret <= e.toISOString().slice(0, 10);
}

export function validateTrip(viewerId: ID, p: ProposedTrip, ctx: { start: string; end: string; budget: number }): Trip | null {
  const me = getUser(viewerId);
  const city = cityById(p.city);
  const repairs: string[] = [];
  /** lowercase first names / ids of people removed, so reasons that cite them can be scrubbed */
  const droppedNames: string[] = [];
  const dropPerson = (id: string) => {
    droppedNames.push(id.toLowerCase());
    const n = getUser(id)?.name.split(" ")[0].toLowerCase();
    if (n) droppedNames.push(n);
  };
  if (!me || !city || city.id === me.city) return null;
  const dates = datesBetween(ctx.start, ctx.end);
  let nights = Math.max(1, Math.min(7, Math.round(p.nights || dates.length - 1)));

  // host: must exist, be visible, live there, have opted in, and be free
  let host: TripPerson | undefined;
  if (p.hostId) {
    const u = getUser(p.hostId);
    const tp = tripPerson(viewerId, p.hostId, dates, city.id);
    if (!u || !tp) repairs.push(`dropped host ${p.hostId}: not in your network`);
    else if (u.city !== city.id) repairs.push(`dropped host ${u.name}: lives in ${u.city}, not ${city.id}`);
    else if (!u.openToHosting) repairs.push(`dropped host ${u.name}: has not turned on "open to hosting"`);
    else if (!tp.freeThatWeekend) repairs.push(`dropped host ${u.name}: busy that weekend (from what you can see)`);
    else host = tp;
    if (!host) dropPerson(p.hostId);
  }
  // ride
  let ride: Trip["ride"];
  if (p.rideId) {
    const r = db().rides.find((x) => x.id === p.rideId);
    const driver = r ? tripPerson(viewerId, r.driverId, dates, city.id) : null;
    if (!r || !driver) repairs.push(`dropped ride ${p.rideId}: unknown or driver not in your network`);
    else if (r.toCity !== city.id) repairs.push(`dropped ride ${r.id}: goes to ${r.toCity}`);
    else if (r.fromCity !== me.city) repairs.push(`dropped ride ${r.id}: leaves from ${r.fromCity}, not your city`);
    else if (r.seatsOpen <= 0) repairs.push(`dropped ride ${r.id}: no seats open`);
    else if (!overlaps(r, ctx.start, ctx.end)) repairs.push(`dropped ride ${r.id}: wrong dates`);
    else {
      ride = { id: r.id, driver, fromCity: r.fromCity, toCity: r.toCity, departAt: r.departAt, returnAt: r.returnAt, seatsOpen: r.seatsOpen, note: r.note };
      if (r.departAt.slice(0, 10) === r.returnAt.slice(0, 10)) {
        nights = 0; // day trip: back the same night, nothing to sleep in
        repairs.push("day trip: no lodging charged");
      }
    }
  }
  // no ride proposed, but a friend IS driving there that weekend with a seat: attach it (a friend's seat is the point)
  if (!ride && !p.rideId && !me.hasCar) {
    const cands = db().rides.filter((r) => r.toCity === city.id && r.fromCity === me.city && r.seatsOpen > 0 && r.driverId !== viewerId && overlaps(r, ctx.start, ctx.end) && canSeeUser(viewerId, getUser(r.driverId)!) && tripPerson(viewerId, r.driverId, dates, city.id)?.freeThatWeekend);
    const best = cands.sort((a, b) => (connection(viewerId, a.driverId)?.degree ?? 3) - (connection(viewerId, b.driverId)?.degree ?? 3) || b.seatsOpen - a.seatsOpen)[0];
    const driver = best ? tripPerson(viewerId, best.driverId, dates, city.id) : null;
    if (best && driver) {
      ride = { id: best.id, driver, fromCity: best.fromCity, toCity: best.toCity, departAt: best.departAt, returnAt: best.returnAt, seatsOpen: best.seatsOpen, note: best.note };
      repairs.push(`attached ${driver.name.split(" ")[0]}'s ride: a seat was open and the model priced it by bus`);
    }
  }
  // event
  let event: Trip["event"];
  if (p.eventId) {
    const e: FBEvent | undefined = db().events.find((x) => x.id === p.eventId);
    if (!e || !canSeeEvent(viewerId, e)) repairs.push(`dropped event ${p.eventId}: unknown or not visible`);
    else if (e.city !== city.id) repairs.push(`dropped event ${e.title}: in ${e.city}`);
    else if (!dates.includes(e.startsAt.slice(0, 10))) repairs.push(`dropped event ${e.title}: not that weekend`);
    else event = { id: e.id, title: e.title, startsAt: e.startsAt, location: e.location, price: e.price, goingYouKnow: e.going.filter((id) => id !== viewerId && canSeeUser(viewerId, getUser(id)!)).map((id) => ({ ...cardFor(id), connection: connection(viewerId, id)?.label ?? "" })) };
  }
  // a ride sets the real dates: you leave when the driver leaves and come back when they do
  let start = ctx.start;
  let end = ctx.end;
  if (ride) {
    const dep = ride.departAt.slice(0, 10);
    const ret = ride.returnAt.slice(0, 10);
    if (dep > start || ret < end) {
      start = dep > start ? dep : start;
      end = ret < end ? ret : end;
      const n = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000);
      if (nights !== 0) nights = Math.max(1, n);
      repairs.push(`dates follow ${ride.driver.name.split(" ")[0]}'s car: ${start} → ${end}`);
    }
  }
  // other people there
  const people: TripPerson[] = [];
  for (const id of new Set([...(p.peopleIds ?? []), ...(event?.goingYouKnow.map((g) => g.id) ?? [])])) {
    if (id === host?.id || id === ride?.driver.id) continue;
    const u = getUser(id);
    const tp = tripPerson(viewerId, id, dates, city.id);
    if (!u || !tp) {
      repairs.push(`dropped person ${id}: not in your network`);
      dropPerson(id);
      continue;
    }
    if (u.city !== city.id && !event?.goingYouKnow.some((g) => g.id === id)) {
      repairs.push(`dropped person ${u.name}: not in ${city.id}`);
      dropPerson(id);
      continue;
    }
    people.push(tp);
  }
  people.sort((a, b) => a.degree - b.degree);
  // evidence
  const evidence: Trip["evidence"] = [];
  for (const ev0 of p.evidence ?? []) {
    // repair the kind from the id prefix (models mislabel posts as reels)
    const ev = ev0.id.startsWith("r_") ? { ...ev0, kind: "reel" as const } : ev0.id.startsWith("p_") ? { ...ev0, kind: "post" as const } : ev0;
    if (ev.kind === "post") {
      const post = db().posts.find((x) => x.id === ev.id);
      if (post && post.city === city.id && canSeePost(viewerId, post) && post.images?.length) evidence.push({ kind: "post", id: post.id, authorId: post.authorId, author: getUser(post.authorId)!.name, image: post.images[0], caption: post.text });
      else repairs.push(`dropped evidence post ${ev.id}`);
    } else {
      const reel = db().reels.find((x) => x.id === ev.id);
      if (reel && reel.city === city.id && canSeeReel(viewerId, reel)) evidence.push({ kind: "reel", id: reel.id, authorId: reel.authorId, author: getUser(reel.authorId)!.name, image: reel.image, caption: reel.caption });
      else repairs.push(`dropped evidence reel ${ev.id}`);
    }
  }
  if (!evidence.length) {
    // repair: attach the viewer's visible media from that city
    for (const m of cityMediaFor(viewerId, city.id, 4)) evidence.push({ kind: m.kind, id: m.id, authorId: m.authorId, author: m.author, image: m.image, caption: m.caption });
  }
  if (!host && !ride && !event && !people.length) return null;

  // reasons: drop any that name a person we removed (unless someone kept shares that first name)
  if (p.rideId && !ride) {
    const r = db().rides.find((x) => x.id === p.rideId);
    if (r) dropPerson(r.driverId);
  }
  const keptNames = new Set([host, ride?.driver, ...people, ...(event?.goingYouKnow ?? [])].filter(Boolean).map((x) => x!.name.split(" ")[0].toLowerCase()));
  const scrub = droppedNames.filter((n) => !keptNames.has(n));
  const MONEY = /\$\s?\d|\b\d+\s?(dollars|bucks)\b/i;
  const reasons = (p.reasons ?? []).filter((r) => !scrub.some((n) => new RegExp(`\\b${n}\\b`, "i").test(r))).filter((r) => {
    // model-written dollar figures can disagree with the card; drop those reasons rather than show two numbers
    if (MONEY.test(r)) repairs.push(`dropped a reason with a model-written price: "${r.slice(0, 60)}"`);
    return !MONEY.test(r);
  }).slice(0, 5);
  const pitchSentences = (p.pitch ?? "").split(/(?<=[.!?])\s+/);
  const namesDropped = (x: string) => scrub.some((n) => new RegExp(`\\b${n}\\b`, "i").test(x));
  const pitch = pitchSentences.filter((x) => !MONEY.test(x) && !namesDropped(x)).join(" ").trim() || (pitchSentences[0] ?? "");
  if (pitch !== (p.pitch ?? "").trim()) repairs.push("removed a model-written price from the pitch");

  // prices, in code
  const miles = milesBetween(cityById(me.city!)!, city);
  const transportIfYes: TransportMode = ride ? "ride" : me.hasCar ? "own-car" : miles > 600 ? "flight" : "bus";
  const lodgingIfYes: LodgingMode = nights === 0 ? "host" : host ? "host" : "hostel";
  const occupants = ride ? 2 + ride.seatsOpen - 1 + 0 : 1;
  const rideRec = ride ? db().rides.find((r) => r.id === ride!.id) : undefined;
  const prices = twoPrices({ fromCity: me.city!, toCity: city.id, nights, transport: transportIfYes, lodging: lodgingIfYes, carOccupants: rideRec ? Math.max(2, 1 + rideRec.riderIds.length + 1) : occupants, withLocal: !!host || people.length > 0, rideShareUsd: rideRec?.costShareUsd });
  const conditions = [host ? `${host.name.split(" ")[0]} says yes to hosting` : "", ride ? `${ride.driver.name.split(" ")[0]} has a seat` : ""].filter(Boolean);
  const fits = prices.ifYes.total <= ctx.budget;
  const CLAIM = /\b(under|within|inside|fits?|on|right at) (your |the )?budget\b|\bunder what you said\b|\bcheapest\b/i;
  const reasonsFinal = fits ? reasons : reasons.filter((r) => !CLAIM.test(r));
  const pitchFinal = fits ? pitch : pitch.split(/(?<=[.!?])\s+/).filter((x) => !CLAIM.test(x)).join(" ").trim() || pitch;
  if (!fits && (reasonsFinal.length !== reasons.length || pitchFinal !== pitch)) repairs.push("removed an 'under budget' claim: the priced trip is over budget");

  return {
    id: tripId(), viewerId, city: city.id, cityName: city.name, state: city.state, start, end, nights, budget: ctx.budget,
    title: (p.title?.trim() || `${city.name.toLowerCase()} with ${(host ?? ride?.driver ?? people[0])?.name.split(" ")[0] ?? "your people"}`).replace(/\$\s?\d+/g, "").replace(/\s{2,}/g, " ").trim(), pitch: pitchFinal, reasons: reasonsFinal, host, ride, event, people, evidence,
    prices: { ...prices, transportIfYes, lodgingIfYes, conditions },
    fitsBudget: fits, repairs, createdAt: new Date().toISOString(),
  };
}

export function rankTrips(trips: Trip[]) {
  const score = (t: Trip) => (t.host?.degree === 1 ? 0 : t.host ? 1 : 2) * 1000 + (t.fitsBudget ? 0 : 500) + t.prices.ifYes.total;
  return [...trips].sort((a, b) => score(a) - score(b));
}
