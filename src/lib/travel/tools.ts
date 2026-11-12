// Travel agent tools. EVERY tool takes the viewer (ctx.userId) and returns only what that viewer can already see
// in the app (friends, friends-of-friends through a named mutual, public content, their own groups).
// Privacy is enforced here and re-checked by validate.ts, never by prompt instructions.
import { cities, cityById } from "@/data/cities";
import { mediaIdForUrl, mediaIndex } from "@/data/travel";
import type { ToolDef } from "@/lib/ai";
import { db, getUser } from "@/server/db";
import type { ID, User } from "@/types";
import { costBreakdown, twoPrices, type LodgingMode, type TransportMode } from "./pricing";
import { tasteFor } from "./taste";
import { canSeeEvent, canSeePost, canSeeReel, canSeeUser, connection } from "./visibility";

export const cityName = (id?: string) => cityById(id ?? "")?.name ?? id ?? "?";
const first = (u?: User) => u?.name.split(" ")[0] ?? "?";
const inRange = (iso: string, start: string, end: string) => {
  const d = iso.slice(0, 10);
  return d >= start && d <= end;
};
export const datesBetween = (start: string, end: string) => {
  const out: string[] = [];
  const d = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  for (; d <= e; d.setDate(d.getDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
};

/** Compact, viewer-scoped person record for the model. */
export function personFor(viewerId: ID, u: User) {
  const c = connection(viewerId, u.id);
  return {
    id: u.id,
    name: u.name,
    city: u.city,
    connection: c ? c.label : "not connected",
    degree: c?.degree ?? 0,
    via: c?.via ? first(getUser(c.via)) : undefined,
    openToHosting: !!u.openToHosting,
    hostingNote: u.openToHosting ? u.hostingNote : undefined,
    hasCar: !!u.hasCar,
    busyDates: u.busyDates ?? [],
    interests: u.interests.slice(0, 4),
  };
}
/** Everyone the viewer can see, excluding themselves. */
export const visiblePeople = (viewerId: ID) => db().users.filter((u) => u.id !== viewerId && canSeeUser(viewerId, u));

export const getMyTravelProfile: ToolDef<Record<string, never>> = {
  name: "get_my_travel_profile",
  description: "The user's home city, whether they have a car, dates they are busy, and their taste (built from saved Reels, likes and interests).",
  parameters: { type: "object", properties: {} },
  run: (_a, { userId }) => {
    const me = getUser(userId);
    if (!me) return { error: "no such user" };
    const t = tasteFor(userId);
    return { id: me.id, name: me.name, homeCity: me.city, hasCar: !!me.hasCar, busyDates: me.busyDates ?? [], interests: me.interests, taste: t.top, tasteSummary: t.summary, savedReels: t.savedReelCaptions, friendCount: me.friendIds.length };
  },
};

export const findPeopleByCity: ToolDef<{ city?: string }> = {
  name: "find_people_by_city",
  description: "People in the user's network (friends, and friends-of-friends through a named mutual) who live in other cities, with hosting status, car, busy dates and how the user knows them. Omit city to see every city at once.",
  parameters: { type: "object", properties: { city: { type: "string", description: "City id such as 'nashville'. Omit for all cities." } } },
  run: ({ city }, { userId }) => {
    const me = getUser(userId);
    const people = visiblePeople(userId).filter((u) => u.city && u.city !== me?.city && (!city || u.city === city));
    const byCity: Record<string, ReturnType<typeof personFor>[]> = {};
    for (const u of people) (byCity[u.city!] ??= []).push(personFor(userId, u));
    for (const list of Object.values(byCity)) list.sort((a, b) => a.degree - b.degree || Number(b.openToHosting) - Number(a.openToHosting));
    return { homeCity: me?.city, cities: Object.entries(byCity).map(([id, list]) => ({ city: id, cityName: cityName(id), people: list, hostsOpen: list.filter((p) => p.openToHosting).length })) };
  },
};

export const getTravelEventsAndRides: ToolDef<{ start: string; end: string }> = {
  name: "get_travel_events_and_rides",
  description: "Events in other cities during a date range that people in the user's network are going to, and rides (friends driving with open seats) leaving in that window.",
  parameters: { type: "object", properties: { start: { type: "string", description: "YYYY-MM-DD" }, end: { type: "string", description: "YYYY-MM-DD" } }, required: ["start", "end"] },
  run: ({ start, end }, { userId }) => {
    const me = getUser(userId);
    const events = db()
      .events.filter((e) => e.city && e.city !== me?.city && canSeeEvent(userId, e) && inRange(e.startsAt, start, end))
      .map((e) => {
        const going = e.going.filter((id) => canSeeUser(userId, getUser(id)!) || id === userId).map((id) => ({ id, name: getUser(id)!.name, connection: connection(userId, id)?.label ?? "you" }));
        return { id: e.id, title: e.title, city: e.city, cityName: cityName(e.city), startsAt: e.startsAt, location: e.location, price: e.price, going, meInterested: e.interested.includes(userId) };
      });
    const rides = db()
      .rides.filter((r) => r.seatsOpen > 0 && canSeeUser(userId, getUser(r.driverId)!) && inRange(r.departAt, start, end) === inRange(r.departAt, start, end) && (inRange(r.departAt, start, end) || inRange(r.returnAt, start, end)))
      .map((r) => ({ id: r.id, driver: personFor(userId, getUser(r.driverId)!), fromCity: r.fromCity, toCity: r.toCity, toCityName: cityName(r.toCity), departAt: r.departAt, returnAt: r.returnAt, seatsOpen: r.seatsOpen, riders: r.riderIds.filter((id) => canSeeUser(userId, getUser(id)!)).map((id) => getUser(id)!.name), eventId: r.eventId, note: r.note, leavesFromMyCity: r.fromCity === me?.city }));
    return { range: { start, end }, events, rides };
  },
};

export const checkAvailability: ToolDef<{ userIds: string[]; start: string; end: string }> = {
  name: "check_availability",
  description: "Whether specific people (and the user) are free on each date in a range, from their busy dates.",
  parameters: { type: "object", properties: { userIds: { type: "array", items: { type: "string" } }, start: { type: "string" }, end: { type: "string" } }, required: ["userIds", "start", "end"] },
  run: ({ userIds, start, end }, { userId }) => {
    const dates = datesBetween(start, end);
    const ids = [...new Set([userId, ...(userIds ?? [])])].filter((id) => {
      const u = getUser(id);
      return u && (id === userId || canSeeUser(userId, u));
    });
    return {
      dates,
      people: ids.map((id) => {
        const u = getUser(id)!;
        const busy = dates.filter((d) => u.busyDates?.includes(d));
        return { id, name: u.name, busyOn: busy, free: busy.length === 0 };
      }),
    };
  },
};

export const estimateTripCost: ToolDef<{ toCity: string; nights: number; transport: TransportMode; lodging: LodgingMode; carOccupants?: number; withLocal?: boolean }> = {
  name: "estimate_trip_cost",
  description: "Cost of a trip from the user's home city, computed from seeded prices. Returns BOTH totals: if the host/ride say yes, and the fallback (hostel + bus/flight). Always use this; never add up prices yourself.",
  parameters: {
    type: "object",
    properties: {
      toCity: { type: "string", description: "city id" },
      nights: { type: "integer" },
      transport: { type: "string", enum: ["ride", "own-car", "bus", "flight"], description: "ride = seat in a friend's car" },
      lodging: { type: "string", enum: ["host", "hostel", "hotel"] },
      carOccupants: { type: "integer", description: "people in the car including the driver, for ride/own-car" },
      withLocal: { type: "boolean", description: "a local friend will show cheap spots" },
    },
    required: ["toCity", "nights", "transport", "lodging"],
  },
  run: (a, { userId }) => {
    const me = getUser(userId);
    if (!cityById(a.toCity)) return { error: `unknown city ${a.toCity}. Valid: ${cities.map((c) => c.id).join(", ")}` };
    const p = twoPrices({ fromCity: me?.city ?? "austin", toCity: a.toCity, nights: Math.max(0, Math.min(7, a.nights)), transport: a.transport, lodging: a.lodging, carOccupants: a.carOccupants, withLocal: a.withLocal });
    return { toCity: a.toCity, miles: p.miles, driveHours: p.driveHours, ifYes: p.ifYes.total, ifYesLines: p.ifYes.lines, otherwise: p.otherwise.total, otherwiseLines: p.otherwise.lines, soloHotelTrip: p.solo.total };
  },
};

/** Posts and Reels from a city by people the viewer can see, with the Muse image notes attached. */
export function cityMediaFor(viewerId: ID, city: string, limit = 30) {
  const posts = db()
    .posts.filter((p) => p.city === city && p.images?.length && canSeePost(viewerId, p))
    .map((p) => {
      const mid = mediaIdForUrl(p.images![0]);
      const note = mid ? mediaIndex[mid] : undefined;
      const author = getUser(p.authorId)!;
      return { kind: "post" as const, id: p.id, mediaId: mid, authorId: author.id, author: author.name, connection: connection(viewerId, author.id)?.label ?? (author.id === viewerId ? "you" : "public"), when: p.createdAt.slice(0, 10), caption: p.text, image: p.images![0], note: note ? { description: note.description, tags: note.tags, food: note.food, activities: note.activities, vibe: note.vibe, goodFor: note.goodFor, timeOfDay: note.timeOfDay } : undefined, comments: p.comments.slice(0, 3).map((c) => `${first(getUser(c.authorId))}: ${c.text}`) };
    });
  const reels = db()
    .reels.filter((r) => r.city === city && canSeeReel(viewerId, r))
    .map((r) => {
      const mid = mediaIdForUrl(r.image);
      const note = mid ? mediaIndex[mid] : undefined;
      const author = getUser(r.authorId)!;
      return { kind: "reel" as const, id: r.id, mediaId: mid, authorId: author.id, author: author.name, connection: connection(viewerId, author.id)?.label ?? (author.id === viewerId ? "you" : "public"), when: r.createdAt.slice(0, 10), caption: r.caption, image: r.image, savedByMe: r.savedBy.includes(viewerId), note: note ? { description: note.description, tags: note.tags, food: note.food, activities: note.activities, vibe: note.vibe, goodFor: note.goodFor, timeOfDay: note.timeOfDay } : undefined, comments: [] as string[] };
    });
  return [...posts, ...reels].sort((a, b) => b.when.localeCompare(a.when)).slice(0, limit);
}

export const getCityMedia: ToolDef<{ city: string; limit?: number }> = {
  name: "get_city_media",
  description: "Friends' posts, photos and Reels from a city, each with what Muse saw in the photo (tags, food, activities, vibe). Only content the user can already see.",
  parameters: { type: "object", properties: { city: { type: "string" }, limit: { type: "integer" } }, required: ["city"] },
  run: ({ city, limit }, { userId }) => {
    const items = cityMediaFor(userId, city, limit ?? 25);
    return { city, cityName: cityName(city), count: items.length, items };
  },
};

/** One round trip for the whole picture: profile + network by city + events/rides + who's free. */
export const scanNetwork: ToolDef<{ start: string; end: string }> = {
  name: "scan_network",
  description: "Everything in one call for a date range: the user's profile and taste, every person they can see in other cities (hosting, car, free that weekend, connection), events their people are going to, and rides with open seats. Start here.",
  parameters: { type: "object", properties: { start: { type: "string", description: "YYYY-MM-DD" }, end: { type: "string", description: "YYYY-MM-DD" } }, required: ["start", "end"] },
  run: async (a, ctx) => {
    const dates = datesBetween(a.start, a.end);
    const profile = await getMyTravelProfile.run({} as Record<string, never>, ctx);
    const net = (await findPeopleByCity.run({}, ctx)) as { homeCity?: string; cities: { city: string; cityName: string; people: ReturnType<typeof personFor>[]; hostsOpen: number }[] };
    const cities = net.cities.map((c) => ({
      ...c,
      people: c.people.map((p) => ({ ...p, freeThatWeekend: !dates.some((d) => p.busyDates.includes(d)), busyDates: undefined })),
    }));
    const ev = (await getTravelEventsAndRides.run({ start: a.start, end: a.end }, ctx)) as { range: unknown; events: unknown[]; rides: unknown[] };
    return { dates, profile, cities, events: ev.events, rides: ev.rides };
  },
};

/** Final answer of the Discover agent. Args are validated by validate.ts; the run() only records them. */
export const PROPOSE_SCHEMA = {
  type: "object",
  properties: {
    trips: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          city: { type: "string", description: "city id" },
          title: { type: "string", description: "Short, specific, lowercase-leaning, e.g. 'nashville with kai for leah's songwriter round'" },
          pitch: { type: "string", description: "Two sentences in the house voice on why THIS trip exists because of THESE people." },
          hostId: { type: "string", description: "A person in that city with openToHosting true, or omit." },
          rideId: { type: "string", description: "A ride id with open seats going there, or omit." },
          eventId: { type: "string", description: "An event there that weekend, or omit." },
          peopleIds: { type: "array", items: { type: "string" }, description: "Other people in that city worth seeing." },
          evidence: { type: "array", items: { type: "object", properties: { kind: { type: "string", enum: ["post", "reel"] }, id: { type: "string" } }, required: ["kind", "id"] }, description: "Posts/Reels that informed this (ids from get_city_media)." },
          nights: { type: "integer" },
          reasons: { type: "array", items: { type: "string" }, description: "3-5 short bullets, each naming a real person, event or ride and why it matters." },
        },
        required: ["city", "title", "pitch", "nights", "reasons"],
      },
    },
    declineReason: { type: "string", description: "If no trip works: one honest sentence why (e.g. nobody open to hosting is free that weekend within budget)." },
  },
  required: ["trips"],
};
export type ProposedTrip = { city: string; title: string; pitch: string; hostId?: string; rideId?: string; eventId?: string; peopleIds?: string[]; evidence?: { kind: "post" | "reel"; id: string }[]; nights: number; reasons: string[] };
export type Proposal = { trips: ProposedTrip[]; declineReason?: string };

export function proposeTripsTool(capture: (p: Proposal) => void): ToolDef<Proposal> {
  return {
    name: "propose_trips",
    description: "Submit the final 2-3 trips (or a decline). Call exactly once, at the end. Every id must come from earlier tool results.",
    parameters: PROPOSE_SCHEMA,
    run: (p) => {
      capture(p);
      return { ok: true, received: p.trips?.length ?? 0 };
    },
  };
}

export const discoverTools = (capture: (p: Proposal) => void): ToolDef[] => [scanNetwork as ToolDef, findPeopleByCity as ToolDef, checkAvailability as ToolDef, estimateTripCost as ToolDef, getCityMedia as ToolDef, proposeTripsTool(capture) as ToolDef];
/** Every travel tool, for tests and the Inspector. */
export const allTravelTools: ToolDef[] = [getMyTravelProfile as ToolDef, findPeopleByCity as ToolDef, getTravelEventsAndRides as ToolDef, checkAvailability as ToolDef, estimateTripCost as ToolDef, getCityMedia as ToolDef, scanNetwork as ToolDef];

// Re-export for other modules
export { costBreakdown };
