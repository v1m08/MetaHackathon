import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { GET as contextRoute } from "@/app/api/context/route";
import { GET as trayRoute } from "@/app/api/context/tray/route";
import { GET as eventsRoute } from "@/app/api/events/route";
import { GET as groupsRoute } from "@/app/api/groups/route";
import { GET as marketplaceRoute } from "@/app/api/marketplace/route";
import {
  affinityFor,
  blindSpotTopicsFor,
  chatTopicsFor,
  clearFeedbackSignals,
  connectionScoreFor,
  ingestSidequestSessions,
  recordFeedbackSignal,
  sharedMatchesFor,
  socialMatchCache,
  socialMatchFor,
  streakInfoFor,
  traySuggestionsFor,
  userContextFor,
} from "@/lib/context";
import { db, getGroup, resetDb, sendMessage } from "@/server/db";
import type { Conversation, ID } from "@/types";

const MJ = "c_maya_jordan";
const VB = "c_volleyball";
const DAY = 864e5;

function resetAll() {
  clearFeedbackSignals();
  resetDb();
}
function addChat(id: ID, participantIds: ID[]): Conversation {
  const c: Conversation = { id, participantIds, isGroup: participantIds.length > 2, messages: [] };
  db().conversations.push(c);
  return c;
}
function addSessionAt(convId: ID, ref: string, interest: string, creator: ID, finishers: ID[], daysAgo: number) {
  const c = db().conversations.find((x) => x.id === convId)!;
  const t0 = Date.now() - daysAgo * DAY;
  c.messages.push({
    id: `m_${ref}_card`,
    senderId: creator,
    text: `🎮 Order Up!: ${interest}`,
    createdAt: new Date(t0).toISOString(),
    attachment: { type: "sqgame", ref },
    readBy: [...c.participantIds],
  });
  finishers.forEach((u, i) => {
    c.messages.push({
      id: `m_${ref}_${u}`,
      senderId: u,
      text: `played ${interest} · $${180 + i * 10}`,
      createdAt: new Date(t0 + (i + 1) * 60_000).toISOString(),
      attachment: { type: "sqgamelog", ref },
      readBy: [...c.participantIds],
    });
  });
}

test("ingests seeded Order Up! and Deep Cuts sessions, room caches, and same-answer mind-melds", () => {
  resetAll();
  const sessions = ingestSidequestSessions();
  assert.ok(sessions.length >= 5, `expected seeded Sidequest sessions, got ${sessions.length}`);

  const indie = sessions.find((s) => s.ref === "sqmusc04")!;
  assert.equal(indie.gameKind, "deepcuts");
  assert.ok(indie.topics.includes("music"));
  assert.ok(indie.players.has("maya") && indie.players.has("jordan"));
  assert.ok((indie.sameAnswers.get("jordan|maya") ?? 0) >= 2, "detects Deep Cuts prompts where Maya & Jordan typed the exact same band");

  const tacos = sessions.find((s) => s.ref === "k:sqtaco01")!;
  assert.equal(tacos.gameKind, "orderup");
  assert.ok(tacos.topics.includes("food"));
  assert.ok((tacos.players.get("jordan")?.plays ?? 0) >= 2, "reads replay count from Order Up! cache");
});

test("Austin-timezone streaks: seeded 3-day milestone, 7-day automatic freeze over 1 missed day, and evening hourglass", () => {
  resetAll();
  const mjStreak = streakInfoFor(MJ);
  assert.equal(mjStreak.days, 3, "Maya & Jordan have a 3-day seeded streak");
  assert.equal(mjStreak.milestone, 3, "3-day milestone fires");

  // 7-day freeze: played 1, 2, [missed 3], 4 days ago -> freeze holds over day 3, total = 3 days, 1 freeze used.
  const trio = addChat("c_t_freeze", ["maya", "jordan", "sam"]);
  addSessionAt(trio.id, "k:fz1", "Tacos", "maya", ["maya", "jordan"], 1);
  addSessionAt(trio.id, "k:fz2", "Ramen", "sam", ["sam", "jordan"], 2);
  // day 3 missed!
  addSessionAt(trio.id, "k:fz4", "Burgers", "maya", ["maya", "sam"], 4);
  const fz = streakInfoFor(trio.id);
  assert.equal(fz.days, 3, "freeze bridges single missed day without inflating count");
  assert.equal(fz.freezes.length, 1);

  // Evening hourglass: game started on an evening, only 1 of 3 finished, checked at 7:30pm Austin time.
  const nowEvening = new Date("2026-11-20T01:30:00.000Z").getTime(); // 7:30pm CST (America/Chicago)
  trio.messages.push({
    id: "m_hg_card",
    senderId: "maya",
    text: "🎮 Deep Cuts: Coffee",
    createdAt: new Date(nowEvening - 1800e3).toISOString(),
    attachment: { type: "sqgame", ref: "sqhg01" },
  });
  trio.messages.push({
    id: "m_hg_1",
    senderId: "maya",
    text: "played Coffee · 400 pts",
    createdAt: new Date(nowEvening - 900e3).toISOString(),
    attachment: { type: "sqgamelog", ref: "sqhg01" },
  });
  const hg = streakInfoFor(trio.id, ingestSidequestSessions(), nowEvening);
  assert.equal(hg.hourglass, true, "hourglass warns after 6pm when today's game isn't locked in by a majority");
});

test("anti-hijack agreement (mean * coverage * (1 - SD)) + 40/60/75 connection thresholds", () => {
  resetAll();
  const group8 = addChat("c_t_group8", ["devon", "tyler", "marcus", "nina", "grace", "ethan", "sam", "jordan"]);
  // One loud member (tyler) spams 4 cycling games solo; nobody else plays.
  for (let i = 1; i <= 4; i++) addSessionAt(group8.id, `k:solo${i}`, "Road cycling", "tyler", ["tyler"], i);
  const soloTopics = chatTopicsFor(group8.id);
  const cycSolo = soloTopics.find((t) => t.topic === "cycling")!;
  assert.equal(cycSolo.settled, false, "1 of 8 spamming solo never settles a group topic");
  assert.ok(cycSolo.coverage <= 0.15, `expected low coverage, got ${cycSolo.coverage}`);
  assert.deepEqual(connectionScoreFor(group8.id).earnedTiers, [], "no tiers earned when no topic is settled");

  // Meanwhile Maya & Jordan (both played 3 days) earn group (40) and event (60) tiers!
  const mjConn = connectionScoreFor(MJ);
  assert.ok(mjConn.score >= 60, `expected Maya+Jordan connection >= 60, got ${mjConn.score}`);
  assert.ok(mjConn.earnedTiers.includes("group") && mjConn.earnedTiers.includes("event"));
});

test("multi-factor ranking: soonness, mutual friends going, saturation filter, and RSVP/Save feedback loop", () => {
  resetAll();
  const cache = socialMatchCache("maya");

  // Soonness + friends going: tomorrow with 4 Maya friends going outranks 20 days out with 0 friends going.
  const soonWithFriends = socialMatchFor("maya", ["music"], cache, {
    tier: "event",
    startsAt: new Date(Date.now() + 1 * DAY).toISOString(),
    alreadyInIds: ["sofia", "lucas", "zoe", "grace"],
  });
  const lateNoFriends = socialMatchFor("maya", ["music"], cache, {
    tier: "event",
    startsAt: new Date(Date.now() + 20 * DAY).toISOString(),
    alreadyInIds: [],
  });
  assert.ok(soonWithFriends.parts.friendsGoing > 0 && soonWithFriends.parts.soonness > lateNoFriends.parts.soonness);
  assert.ok(soonWithFriends.fit > lateNoFriends.fit, `${soonWithFriends.fit} > ${lateNoFriends.fit}`);
  assert.equal(soonWithFriends.shareTarget?.conversationId, MJ, "Jordan is not in alreadyInIds -> offer Send to Jordan");

  // Saturation filter: when Jordan IS already going, keep fitLabel but omit redundant Send to Jordan!
  const jordanAlreadyGoing = socialMatchFor("maya", ["music"], cache, {
    tier: "event",
    startsAt: new Date(Date.now() + 1 * DAY).toISOString(),
    alreadyInIds: ["jordan", "sofia"],
  });
  assert.match(jordanAlreadyGoing.fitLabel ?? "", /Matches your games with Jordan/);
  assert.equal(jordanAlreadyGoing.shareTarget, undefined, "no Send to Jordan when Jordan is already RSVPed going");

  // Feedback loop: RSVPing to a climbing/outdoors event lifts Maya's outdoors affinity.
  const beforeOutdoors = affinityFor("maya").score.outdoors;
  recordFeedbackSignal("maya", "event", "e_test_climb", "outdoors", "in");
  assert.ok(affinityFor("maya").score.outdoors > beforeOutdoors + 0.3, "RSVP feedback boosts topic affinity");
});

test("playing a new Deep Cuts or Order Up! game live updates affinity, closeness, and NEW discovered topics", () => {
  resetAll();
  assert.equal(affinityFor("maya").observations.cycling, 0);

  sendMessage(MJ, "maya", "🎮 Deep Cuts: Road cycling", { type: "sqgame", ref: "sqcycl99" });
  sendMessage(MJ, "maya", "played Peloton Legends · 620 km", { type: "sqgamelog", ref: "sqcycl99" });
  sendMessage(MJ, "jordan", "played Peloton Legends · 580 km · #2 of 2", { type: "sqgamelog", ref: "sqcycl99" });

  // Also test Ghost Run (r:) and Sketch Off (s:) ingestion:
  sendMessage(MJ, "jordan", "🎮 Ghost Run: Rock climbing", { type: "sqgame", ref: "r:sqrun01" });
  sendMessage(MJ, "jordan", "played Crag Dash · 22.4s", { type: "sqgamelog", ref: "r:sqrun01" });
  sendMessage(MJ, "maya", "played Crag Dash · 21.8s · took the lead", { type: "sqgamelog", ref: "r:sqrun01" });

  sendMessage(MJ, "maya", "🎮 Sketch Off: Anime", { type: "sqgame", ref: "s:sqsk01" });
  sendMessage(MJ, "maya", "played Pixel Studio · 340 pts", { type: "sqgamelog", ref: "s:sqsk01" });
  sendMessage(MJ, "jordan", "played Pixel Studio · 290 pts", { type: "sqgamelog", ref: "s:sqsk01" });

  const ctx = userContextFor("maya")!;
  const cycEntry = ctx.after.learnedTopics.find((t) => t.topic === "cycling")!;
  assert.ok(cycEntry && cycEntry.newlyDiscovered);
  assert.ok(ctx.after.recentGames.some((g) => g.gameKind === "ghostrun" && g.gameLabel === "Ghost Run"));
  assert.ok(ctx.after.recentGames.some((g) => g.gameKind === "sketchoff" && g.gameLabel === "Sketch Off"));
  assert.match(socialMatchFor("maya", ["cycling"]).fitLabel ?? "", /Matches your games with Jordan · cycling/);
  assert.match(socialMatchFor("maya", ["film"]).fitLabel ?? "", /Matches your games with Jordan · movies & anime/);
});

test("privacy: cross-chat Sidequest games, private saves, and non-member trays never leak", () => {
  resetAll();

  // Jordan plays cycling in c_volleyball (Maya not in chat); Maya plays cycling with Omar.
  sendMessage(VB, "jordan", "🎮 Deep Cuts: Road cycling", { type: "sqgame", ref: "sqvbcyc1" });
  sendMessage(VB, "jordan", "played Hill Climb · 440 km", { type: "sqgamelog", ref: "sqvbcyc1" });
  sendMessage(VB, "devon", "played Hill Climb · 410 km", { type: "sqgamelog", ref: "sqvbcyc1" });
  const omarChat = addChat("c_t_maya_omar", ["maya", "omar"]);
  sendMessage(omarChat.id, "maya", "🎮 Order Up!: Cyclist espresso stop", { type: "sqgame", ref: "k:sqomcyc2" });
  sendMessage(omarChat.id, "maya", "played Espresso Peloton · $180", { type: "sqgamelog", ref: "k:sqomcyc2" });

  assert.ok(!(socialMatchFor("maya", ["cycling"]).fitLabel ?? "").includes("Jordan"), "zero cross-chat leak");
  assert.throws(() => traySuggestionsFor(VB, "maya", "deepcuts"), (e: unknown) => (e as { status?: number }).status === 404);
  assert.ok(getGroup("g_apartments")!.privacy === "private" && !getGroup("g_apartments")!.memberIds.includes("jordan"));
  const mjTray = traySuggestionsFor(MJ, "maya", "orderup");
  assert.ok(![...mjTray.forChat, ...mjTray.discover].some((x) => /Apartment|saved/i.test(x.reason)));
  assert.ok(blindSpotTopicsFor(["maya", "jordan"]).length >= 3);
});

test("API routes (/api/context, /api/context/tray, /api/events, /api/groups, /api/marketplace) return scored results", async () => {
  resetAll();
  const req = (url: string, user = "maya") => new NextRequest(url, { headers: { "x-user-id": user } });

  const cRes = await contextRoute(req("http://localhost/api/context?for=maya"), { params: Promise.resolve({}) });
  assert.equal(cRes.status, 200);
  const cJson = await cRes.json();
  assert.ok(cJson.profile.after.closenessGraph[0].streakDays >= 3);

  assert.equal((await trayRoute(req("http://localhost/api/context/tray?conversationId=c_maya_jordan&game=deepcuts"), { params: Promise.resolve({}) })).status, 200);

  const events = await (await eventsRoute(req("http://localhost/api/events"), { params: Promise.resolve({}) })).json();
  // Dove Springs / Trail Cleanup has Maya going, Jordan NOT going -> offers Send to Jordan; Jordan's Taco Pop-Up has Jordan already going -> no redundant Send to Jordan!
  const popUp = events.find((e: { id: string }) => e.id === "e_taco_popup");
  const cleanup = events.find((e: { id: string }) => e.id === "e_trail_cleanup");
  assert.equal(popUp.shareTarget, undefined, "Jordan already going to his own pop-up");
  assert.equal(cleanup.shareTarget?.conversationId, MJ, "Jordan not yet going -> offer Send to Jordan");

  const groups = await (await groupsRoute(req("http://localhost/api/groups", "jordan"), { params: Promise.resolve({}) })).json();
  assert.ok(groups.some((g: { fit?: number }) => (g.fit ?? 0) > 0.15));

  const listings = await (await marketplaceRoute(req("http://localhost/api/marketplace"), { params: Promise.resolve({}) })).json();
  assert.ok((listings[0].fit ?? 0) >= (listings.at(-1).fit ?? 0));
  assert.ok(sharedMatchesFor("maya").length >= 1);
});
