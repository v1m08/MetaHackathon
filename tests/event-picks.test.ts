import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { GET as picksRoute, POST as shownRoute } from "@/app/api/conversations/[id]/event-picks/route";
import { connectionScoreFor, THRESHOLDS } from "@/lib/context";
import { EVENT_FIT_MIN, eventPicksFor, markEventPicksShown, MAX_PICKS, type EventPicksResult } from "@/lib/events/forChat";
import { db, getUser, resetDb, sendMessage } from "@/server/db";
import type { FBEvent, ID } from "@/types";

const EP = "c_ethan_priya";
const VB = "c_volleyball";
const RAMEN = "k:sqramn02";
const DAY = 864e5;

const shown = (r: EventPicksResult) => {
  assert.ok(r.show, `expected a popup, got: ${r.show ? "" : r.reason}`);
  return r;
};
const hidden = (r: EventPicksResult) => {
  assert.ok(!r.show, "expected no popup");
  return r.reason;
};
const tick = () => new Promise((r) => setTimeout(r, 3));

/** Adds a minimal upcoming event; nobody going unless told. */
function addEvent(e: Partial<FBEvent> & { id: string; category: string }): FBEvent {
  const ev: FBEvent = { title: e.id, cover: "", startsAt: new Date(Date.now() + 2 * DAY).toISOString(), location: "Austin", description: "", going: [], interested: [], ...e };
  db().events.push(ev);
  return ev;
}

/** Plays a new game in `conversationId`: the first finisher posts the card, then each finishes. */
async function play(conversationId: ID, ref: string, card: string, finishers: ID[], banter: ID[] = []) {
  sendMessage(conversationId, finishers[0], card, { type: "sqgame", ref });
  for (const u of finishers) {
    await tick();
    sendMessage(conversationId, u, `played ${card.split(": ")[1]} · 100`, { type: "sqgamelog", ref });
    if (banter.includes(u)) {
      await tick();
      sendMessage(conversationId, u, "gg that was close");
    }
  }
}

const req = (url: string, user: ID, init: { method?: string; body?: string } = {}) => new NextRequest(url, { ...init, headers: { "x-user-id": user, "content-type": "application/json" } });

// ---------- benchmarks ----------

test("Ethan + Priya (Event tier earned) get a popup after Ramen; the volleyball chat (Group tier only) doesn't", () => {
  resetDb();
  assert.ok(connectionScoreFor(EP).earnedTiers.includes("event"));
  const r = shown(eventPicksFor(EP, "ethan", RAMEN));
  assert.ok(!("score" in r) && !/\d/.test(r.muse), "the chat's score never reaches the client");
  assert.equal(r.withName, "Priya");
  assert.equal(r.picks.length, MAX_PICKS);
  assert.equal(MAX_PICKS, 1, "one suggestion");
  assert.ok(r.picks[0].fit >= EVENT_FIT_MIN);

  assert.ok(!connectionScoreFor(VB).earnedTiers.includes("event"));
  const reason = hidden(eventPicksFor(VB, "devon", "k:sqburg03"));
  assert.match(reason, /event tier not earned \(score below the Event tier\)/);
  assert.ok(!/\d/.test(reason), "the reason doesn't leak the score either");
});

test("no popup for a game you haven't finished, or when nothing relates to the chat", () => {
  resetDb();
  sendMessage(EP, "priya", "🎮 Order Up!: Tacos", { type: "sqgame", ref: "k:eptaco1" });
  sendMessage(EP, "priya", "played Taco 'Bout It · $190", { type: "sqgamelog", ref: "k:eptaco1" });
  assert.match(hidden(eventPicksFor(EP, "ethan", "k:eptaco1")), /haven't finished/);

  // Only an anime night is left: food is the game and the chat's topic, film is on Priya's profile but not Ethan's.
  db().events = db().events.filter((e) => e.id === "e_anime_night");
  assert.match(hidden(eventPicksFor(EP, "ethan", RAMEN)), /no upcoming event relates/);
});

test("the unlock moment: the finish that earns the Event tier says so (without showing the score)", async () => {
  resetDb();
  const ref = "k:vbtaco9";
  const order = ["devon", "nina", "marcus", "tyler", "grace", "ethan", "sam"];
  let unlock: Extract<EventPicksResult, { show: true }> | undefined;
  let before = 0;
  sendMessage(VB, order[0], "🎮 Order Up!: Tacos", { type: "sqgame", ref });
  for (const u of order) {
    await tick();
    before = connectionScoreFor(VB).score;
    sendMessage(VB, u, "played Taco 'Bout It · $180", { type: "sqgamelog", ref });
    const r = eventPicksFor(VB, u, ref);
    if (r.show) {
      unlock = r;
      break;
    }
    assert.match(r.reason, /event tier not earned/);
  }
  assert.ok(unlock, "turnout plus today's streak lifts the group past 60");
  assert.equal(unlock.unlocked, true);
  const after = connectionScoreFor(VB).score;
  assert.ok(before < THRESHOLDS.event && after >= THRESHOLDS.event, `${before} → ${after}`);
  assert.match(unlock.muse, /just unlocked events/);
  assert.ok(!/\d+ ?→|\bhit \d/.test(unlock.muse));
  assert.ok(unlock.streak.days >= 3, "a majority finishing today extends the streak");
});

test("an unlock sticks once a member has seen it, even if the score dips under 60", () => {
  resetDb();
  assert.ok(!hidden(eventPicksFor(VB, "jordan", "k:sqburg03")).includes("already"));
  markEventPicksShown(VB, "devon", "k:sqburg03");
  const r = shown(eventPicksFor(VB, "jordan", "k:sqburg03"));
  assert.equal(r.unlocked, false, "only the first popup in a chat is the unlock moment");
});

// ---------- fit ----------

test("an event relates through both profiles in a 1:1 (both must list it), not one profile alone", () => {
  resetDb();
  addEvent({ id: "x_hike", title: "Greenbelt Hike", category: "Outdoors" }); // Ethan and Priya both list the outdoors
  addEvent({ id: "x_film", title: "Indie Film Night", category: "Film" }); // only Priya lists film
  const r = shown(eventPicksFor(EP, "ethan", RAMEN));
  const hike = r.picks.find((p) => p.id === "x_hike") ?? shown(eventPicksFor(EP, "priya", RAMEN)).picks.find((p) => p.id === "x_hike");
  assert.ok(hike, "the hike fits through both profiles");
  assert.match(hike.why, /both list the outdoors/);
  assert.ok(!r.picks.some((p) => p.id === "x_film"));
});

test("in a group, a profile interest needs at least half the members", () => {
  resetDb();
  markEventPicksShown(VB, "devon", "k:sqburg03"); // Event tier unlocked for the chat
  const friends = getUser("jordan")!.friendIds.slice(0, 3);
  addEvent({ id: "x_sports", title: "Rec League Night", category: "Sports", going: friends }); // 5 of 8 list sports
  addEvent({ id: "x_film", title: "Film Club", category: "Film", going: friends }); // 2 of 8 list film
  const r = shown(eventPicksFor(VB, "jordan", "k:sqburg03"));
  const sports = r.picks.find((p) => p.id === "x_sports");
  assert.ok(sports, "most of the group lists sports");
  assert.match(sports.why, /Most of you list pickup sports/);
  assert.ok(!r.picks.some((p) => p.id === "x_film"));
});

test("never past events, events you're going to or hosting, or ones a member can't see", () => {
  resetDb();
  const ethanOnly = { id: "g_secret", name: "Secret Supper Club", privacy: "private", memberIds: ["ethan"] } as unknown as ReturnType<typeof db>["groups"][number];
  db().groups.push(ethanOnly);
  addEvent({ id: "x_past", category: "Food & Drink", startsAt: new Date(Date.now() - DAY).toISOString() });
  addEvent({ id: "x_mine", category: "Food & Drink", hostId: "ethan" });
  addEvent({ id: "x_going", category: "Food & Drink", going: ["ethan"] });
  addEvent({ id: "x_private", category: "Food & Drink", hostGroupId: "g_secret" });
  const r = shown(eventPicksFor(EP, "ethan", RAMEN));
  const ids = r.picks.map((p) => p.id);
  for (const bad of ["x_past", "x_mine", "x_going", "x_private"]) assert.ok(!ids.includes(bad), `${bad} excluded`);
  for (const p of r.picks) {
    const e = db().events.find((x) => x.id === p.id)!;
    assert.ok(!e.going.includes("ethan") && e.hostId !== "ethan" && new Date(e.startsAt).getTime() > Date.now());
  }
});

test("suggests the one event closest to everyone's profiles, over a closer game match", () => {
  resetDb();
  // The Taco Pop-Up fits the Ramen game best, but neither Ethan nor Priya lists food. Both list the outdoors.
  const r = shown(eventPicksFor(EP, "ethan", RAMEN));
  assert.deepEqual(r.picks.map((p) => p.id), ["e_trail_cleanup"]);
  assert.match(r.picks[0].why, /^You both list the outdoors · Fits your food game$/);
});

test("saturation: when the other member is already going, Send is hidden and the why line names them", () => {
  resetDb();
  addEvent({ id: "x_climb", title: "Bouldering Meetup", category: "Outdoors", going: ["priya"] });
  const [pick] = shown(eventPicksFor(EP, "ethan", RAMEN)).picks;
  assert.equal(pick.id, "x_climb", "both list the outdoors, so it's the closest match");
  assert.equal(pick.canSend, false);
  assert.match(pick.why, /You both list the outdoors · Priya is going/);
});

// ---------- cadence ----------

test("once per game per person and once per chat per day; other members still get theirs; reset clears it", async () => {
  resetDb();
  shown(eventPicksFor(EP, "ethan", RAMEN));
  markEventPicksShown(EP, "ethan", RAMEN);
  assert.match(hidden(eventPicksFor(EP, "ethan", RAMEN)), /already shown for this game/);

  await play(EP, "sqeptaco", "🎮 Deep Cuts: Tacos", ["ethan", "priya"]);
  assert.match(hidden(eventPicksFor(EP, "ethan", "sqeptaco")), /already shown in this chat today/);
  shown(eventPicksFor(EP, "priya", RAMEN));

  resetDb();
  shown(eventPicksFor(EP, "ethan", RAMEN));
});

// ---------- privacy ----------

test("a friend's games in another chat don't change the picks", async () => {
  resetDb();
  const before = shown(eventPicksFor(EP, "ethan", RAMEN));
  await play("c_priya_aisha", "sqpaclimb", "🎮 Deep Cuts: Rock climbing", ["priya", "aisha"], ["priya"]);
  const after = shown(eventPicksFor(EP, "ethan", RAMEN));
  assert.deepEqual(after, before);
});

// ---------- route ----------

test("route: GET checks without side effects, POST records it as shown, non-members get 404", async () => {
  resetDb();
  const url = `http://localhost/api/conversations/${EP}/event-picks?ref=${encodeURIComponent(RAMEN)}`;
  const params = { params: Promise.resolve({ id: EP }) };
  for (let i = 0; i < 2; i++) {
    const r = await (await picksRoute(req(url, "ethan"), params)).json();
    assert.equal(r.show, true, "a double-run GET (React dev) still shows");
  }
  await shownRoute(req(url, "ethan", { method: "POST", body: JSON.stringify({ ref: RAMEN }) }), params);
  assert.equal((await (await picksRoute(req(url, "ethan"), params)).json()).show, false);
  assert.equal((await picksRoute(req(url, "maya"), params)).status, 404);
});
