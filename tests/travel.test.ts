// Tool layer, visibility rules and cost math. Runs against the real seed through the same modules the app uses.
//   npm test   (node --import tsx --test, so "@/..." imports resolve)
import assert from "node:assert/strict";
import test from "node:test";

import { cityById, milesBetween } from "@/data/cities";
import { costBreakdown, twoPrices } from "@/lib/travel/pricing";
import { allTravelTools, cityMediaFor, datesBetween, findPeopleByCity, getCityMedia, getTravelEventsAndRides, personFor } from "@/lib/travel/tools";
import { rankTrips, validateTrip } from "@/lib/travel/validate";
import { canSeePost, canSeeReel, canSeeUser, connection, mutuals } from "@/lib/travel/visibility";
import { db, getUser, resetDb } from "@/server/db";
import { travelStore } from "@/lib/travel/store";

resetDb();
const d = db();
const weekend = (() => {
  const r = d.rides.find((x) => x.id === "ride_owen_dal")!;
  const start = r.departAt.slice(0, 10);
  const e = new Date(start + "T12:00:00");
  e.setDate(e.getDate() + 1);
  return { start, end: e.toISOString().slice(0, 10) };
})();

test("seed shape: 60+ people, 8+ cities, hosting is sparse and opt-in", () => {
  assert.ok(d.users.length >= 60, `users ${d.users.length}`);
  const cities = new Set(d.users.map((u) => u.city));
  assert.ok(cities.size >= 8, `cities ${cities.size}`);
  const hosts = d.users.filter((u) => u.openToHosting);
  assert.ok(hosts.length > 10 && hosts.length < d.users.length / 2, `hosts ${hosts.length}`);
  assert.ok(d.rides.length >= 5 && d.events.filter((e) => e.city && e.city !== "austin").length >= 10);
  assert.ok(d.posts.filter((p) => p.city && p.images?.length).length >= 40, "city photos");
});

test("visibility: friends, friends-of-friends via a mutual, and nobody else", () => {
  // maya ↔ kai are friends; maya ↔ ruben only via jordan; maya ↔ finn is 3rd degree (finn-sam, sam not maya's friend)
  assert.equal(canSeeUser("maya", getUser("kai")!), true);
  assert.equal(canSeeUser("maya", getUser("ruben")!), true);
  assert.deepEqual(mutuals("maya", "ruben"), ["jordan"]);
  assert.equal(canSeeUser("maya", getUser("finn")!), false, "finn is three hops away");
  assert.equal(connection("maya", "finn"), null);
  assert.equal(connection("maya", "ruben")?.degree, 2);
  assert.equal(connection("maya", "ruben")?.via, "jordan");
});

test("visibility: restricted profiles and friends-only posts are hidden from non-friends", () => {
  const ruben = getUser("ruben")!; // privacy: friends
  const rubenPosts = d.posts.filter((p) => p.authorId === ruben.id && p.city);
  assert.ok(rubenPosts.length > 0, "ruben posted");
  for (const p of rubenPosts) {
    assert.equal(canSeePost("jordan", p), true, "his friend jordan sees it");
    assert.equal(canSeePost("maya", p), false, "maya (friend-of-friend) does not");
  }
  const rubenReels = d.reels.filter((r) => r.authorId === ruben.id);
  for (const r of rubenReels) assert.equal(canSeeReel("maya", r), false);
  // and the tool layer honours it: nothing of ruben's in maya's Nashville media, but it IS in jordan's
  assert.equal(cityMediaFor("maya", "nashville", 100).some((m) => m.authorId === "ruben"), false);
  assert.equal(cityMediaFor("jordan", "nashville", 100).some((m) => m.authorId === "ruben"), true);
});

test("every travel tool scopes to the viewer", async () => {
  for (const t of allTravelTools) assert.equal(t.run.length, 2, `${t.name} takes (args, ctx)`);
  const net = (await findPeopleByCity.run({}, { userId: "maya" })) as { cities: { people: { id: string }[] }[] };
  const ids = net.cities.flatMap((c) => c.people.map((p) => p.id));
  assert.ok(!ids.includes("finn"), "finn must not appear for maya");
  assert.ok(ids.includes("kai") && ids.includes("ruben"));
  const zoeNet = (await findPeopleByCity.run({}, { userId: "zoe" })) as { cities: { people: { id: string }[] }[] };
  assert.ok(zoeNet.cities.flatMap((c) => c.people.map((p) => p.id)).includes("mei"), "zoe sees mei (her friend)");
  const ev = (await getTravelEventsAndRides.run(weekend, { userId: "maya" })) as { rides: { id: string }[] };
  assert.ok(ev.rides.some((r) => r.id === "ride_owen_dal"), "owen's dallas ride is in maya's window");
  const media = (await getCityMedia.run({ city: "nashville" }, { userId: "maya" })) as { items: { authorId: string }[] };
  assert.ok(media.items.every((m) => m.authorId !== "ruben"));
  const pf = personFor("maya", getUser("simone")!);
  assert.equal(pf.via, "Aisha");
});

test("validation drops invented and invisible ids and keeps the rest", () => {
  const ctx = { ...weekend, budget: 120 };
  const t = validateTrip("maya", { city: "dallas", title: "dallas", pitch: "x", hostId: "cole", rideId: "ride_owen_dal", eventId: "e_dal_vintage", peopleIds: ["harper", "finn", "nobody_here", "kai"], evidence: [{ kind: "post", id: "p_doesnotexist" }], nights: 2, reasons: ["cole is hosting", "finn is driving"] }, ctx)!;
  assert.ok(t, "trip survives");
  assert.equal(t.host?.id, "cole");
  assert.equal(t.ride?.id, "ride_owen_dal");
  assert.equal(t.event?.id, "e_dal_vintage");
  assert.deepEqual(t.people.map((p) => p.id).filter((id) => ["finn", "nobody_here", "kai"].includes(id)), [], "invisible / wrong-city people dropped");
  assert.ok(t.repairs.some((r) => r.includes("finn")) && t.repairs.some((r) => r.includes("nobody_here")));
  assert.ok(t.evidence.length > 0 && t.evidence.every((e) => e.id !== "p_doesnotexist"), "evidence repaired from visible media");
  assert.ok(!t.reasons.some((r) => r.includes("finn")), "reasons naming a dropped person are removed");
});

test("validation: a host who did not opt in, or is busy, is never shown as a host", () => {
  const ctx = { ...weekend, budget: 200 };
  const notOptedIn = validateTrip("maya", { city: "nashville", title: "n", pitch: "", hostId: "tess", peopleIds: ["leah"], nights: 2, reasons: [] }, ctx);
  assert.equal(notOptedIn?.host, undefined);
  assert.ok(notOptedIn?.repairs.some((r) => r.includes("open to hosting")));
  // and a trip with nothing real left is dropped entirely
  assert.equal(validateTrip("maya", { city: "nashville", title: "n", pitch: "", hostId: "tess", nights: 2, reasons: [] }, ctx), null);
  // availability is inferred, not seeded: with nothing inferred yet, kai is "unknown" and stays a host (the app asks)
  const unknown = validateTrip("maya", { city: "nashville", title: "n", pitch: "", hostId: "kai", peopleIds: ["leah"], nights: 2, reasons: [] }, ctx);
  assert.equal(unknown?.host?.availability, "unknown");
  // once an inference (from kai's own chat line) says busy, the host is dropped
  const dates = datesBetween(weekend.start, weekend.end);
  travelStore().availability.set(`maya|kai|${weekend.start}`, { personId: "kai", requesterId: "maya", dates, days: dates.map((date) => ({ date, status: "busy" as const, reason: "in Fort Worth", confidence: "high" as const })), overall: "busy", summary: "busy", mode: "test", costUsd: 0, signalCount: 1, computedAt: "", key: "" });
  const busy = validateTrip("maya", { city: "nashville", title: "n", pitch: "", hostId: "kai", peopleIds: ["leah"], nights: 2, reasons: [] }, ctx);
  assert.equal(busy?.host, undefined);
  assert.ok(busy?.repairs.some((r) => r.includes("busy")));
  travelStore().availability.clear();
  // a friends-only post by a non-friend cannot be evidence
  const rubenPost = d.posts.find((p) => p.authorId === "ruben" && p.city === "nashville" && p.images?.length)!;
  const t = validateTrip("maya", { city: "nashville", title: "n", pitch: "", peopleIds: ["leah"], evidence: [{ kind: "post", id: rubenPost.id }], nights: 2, reasons: [] }, ctx)!;
  assert.ok(t.evidence.every((e) => e.id !== rubenPost.id), "privacy violation caught");
  assert.ok(t.repairs.some((r) => r.includes(rubenPost.id)));
});

test("cost math is deterministic, in code, and the two prices make sense", () => {
  const p = twoPrices({ fromCity: "austin", toCity: "dallas", nights: 2, transport: "ride", lodging: "host", carOccupants: 3, withLocal: true });
  assert.ok(p.ifYes.total < p.otherwise.total && p.otherwise.total < p.solo.total, `${p.ifYes.total} < ${p.otherwise.total} < ${p.solo.total}`);
  assert.equal(p.ifYes.lines.find((l) => l.label.startsWith("staying with"))!.usd, 0);
  for (const b of [p.ifYes, p.otherwise, p.solo]) assert.equal(b.total, b.lines.reduce((n, l) => n + l.usd, 0), "total equals the sum of its lines exactly");
  const far = twoPrices({ fromCity: "austin", toCity: "new-york", nights: 2, transport: "flight", lodging: "host", withLocal: true });
  assert.equal(far.otherwise.transport, "flight", "far trips fall back to a flight, not a bus");
  assert.equal(milesBetween(cityById("austin")!, cityById("san-antonio")!) < 120, true);
  assert.throws(() => costBreakdown({ fromCity: "austin", toCity: "atlantis", nights: 1, transport: "bus", lodging: "hostel" }));
});

test("ella's network has nobody open to hosting out of town (the graceful-decline case)", async () => {
  const net = (await findPeopleByCity.run({}, { userId: "ella" })) as { cities: { people: { openToHosting: boolean }[] }[] };
  assert.equal(net.cities.flatMap((c) => c.people).filter((p) => p.openToHosting).length, 0);
});

test("ranking: direct-friend hosts first, then any host, then budget fit", () => {
  const ctx = { ...weekend, budget: 120 };
  const fof = validateTrip("maya", { city: "nashville", title: "fof", pitch: "", hostId: "ruben", nights: 2, reasons: [] }, ctx)!; // ruben: degree 2, hosting on, not busy
  const direct = validateTrip("maya", { city: "dallas", title: "direct", pitch: "", hostId: "cole", nights: 2, reasons: [] }, ctx)!;
  assert.equal(fof.host?.degree, 2);
  assert.equal(direct.host?.degree, 1);
  assert.equal(rankTrips([fof, direct])[0].id, direct.id);
  assert.deepEqual(datesBetween("2026-12-11", "2026-12-13"), ["2026-12-11", "2026-12-12", "2026-12-13"]);
});
