import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { GET as contextRoute } from "@/app/api/context/route";
import { GET as trayRoute } from "@/app/api/context/tray/route";
import { GET as eventsRoute } from "@/app/api/events/route";
import { GET as groupsRoute } from "@/app/api/groups/route";
import { GET as marketplaceRoute } from "@/app/api/marketplace/route";
import { affinityFor, blindSpotTopicsFor, ingestSidequestSessions, sharedMatchesFor, socialMatchFor, traySuggestionsFor, userContextFor } from "@/lib/context";
import { db, getGroup, resetDb, sendMessage } from "@/server/db";
import type { Conversation, ID } from "@/types";

const MJ = "c_maya_jordan";
const VB = "c_volleyball";

function addChat(id: ID, participantIds: ID[]): Conversation {
  const c: Conversation = { id, participantIds, isGroup: participantIds.length > 2, messages: [] };
  db().conversations.push(c);
  return c;
}

test("ingests seeded Order Up! and Deep Cuts sessions, room caches, and same-answer mind-melds", () => {
  resetDb();
  const sessions = ingestSidequestSessions();
  assert.ok(sessions.length >= 4, `expected seeded Sidequest sessions, got ${sessions.length}`);

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

test("playing a new Deep Cuts or Order Up! game live updates affinity, closeness, and NEW discovered topics", () => {
  resetDb();
  const beforeAff = affinityFor("maya");
  assert.equal(beforeAff.observations.cycling, 0, "Maya has 0 cycling games initially");

  // Maya and Jordan play Deep Cuts: Road cycling in their shared chat.
  sendMessage(MJ, "maya", "🎮 Deep Cuts: Road cycling", { type: "sqgame", ref: "sqcycl99" });
  sendMessage(MJ, "maya", "played Peloton Legends · 620 km", { type: "sqgamelog", ref: "sqcycl99" });
  sendMessage(MJ, "jordan", "played Peloton Legends · 580 km · #2 of 2", { type: "sqgamelog", ref: "sqcycl99" });

  const afterAff = affinityFor("maya");
  assert.ok(afterAff.observations.cycling >= 1 && afterAff.score.cycling > 0.3, "cycling affinity rises immediately");

  const ctx = userContextFor("maya")!;
  const cycEntry = ctx.after.learnedTopics.find((t) => t.topic === "cycling")!;
  assert.ok(cycEntry && cycEntry.newlyDiscovered, "cycling is marked as a NEW discovered interest not on Maya's static bio");

  const cycMatch = socialMatchFor("maya", ["cycling"]);
  assert.match(cycMatch.fitLabel ?? "", /Matches your games with Jordan · cycling/);
  assert.equal(cycMatch.shareTarget?.conversationId, MJ);
});

test("privacy: cross-chat Sidequest games never leak into another chat's friend match badges", () => {
  resetDb();

  // Jordan plays Deep Cuts: Road cycling inside Zilker Sunday (c_volleyball, which Maya is NOT in).
  sendMessage(VB, "jordan", "🎮 Deep Cuts: Road cycling", { type: "sqgame", ref: "sqvbcyc1" });
  sendMessage(VB, "jordan", "played Hill Climb · 440 km", { type: "sqgamelog", ref: "sqvbcyc1" });
  sendMessage(VB, "devon", "played Hill Climb · 410 km", { type: "sqgamelog", ref: "sqvbcyc1" });

  // Maya separately plays cycling with Omar (not Jordan).
  const omarChat = addChat("c_t_maya_omar", ["maya", "omar"]);
  sendMessage(omarChat.id, "maya", "🎮 Order Up!: Cyclist espresso stop", { type: "sqgame", ref: "k:sqomcyc2" });
  sendMessage(omarChat.id, "maya", "played Espresso Peloton · $180", { type: "sqgamelog", ref: "k:sqomcyc2" });

  // Maya must NEVER see "Matches your games with Jordan" on cycling!
  const m = socialMatchFor("maya", ["cycling"]);
  assert.ok(!(m.fitLabel ?? "").includes("Jordan"), `cross-chat leak detected: ${m.fitLabel}`);

  // Unfinished / one-sided game in c_maya_jordan: Jordan plays alone, Maya hasn't played yet -> still no shared match!
  sendMessage(MJ, "jordan", "🎮 Deep Cuts: Road cycling", { type: "sqgame", ref: "sqmjone1" });
  sendMessage(MJ, "jordan", "played Hill Climb · 500 km", { type: "sqgamelog", ref: "sqmjone1" });
  assert.ok(!(socialMatchFor("maya", ["cycling"]).fitLabel ?? "").includes("Jordan"), "one-sided game does not claim mutual match");
});

test("traySuggestionsFor & blindSpotTopicsFor enforce audience intersection and exclude private saves and non-members", () => {
  resetDb();

  // Non-member of c_volleyball (Maya) gets 404.
  assert.throws(() => traySuggestionsFor(VB, "maya", "deepcuts"), (e: unknown) => (e as { status?: number }).status === 404);

  // Private saves exist for Maya, and Maya belongs to private group g_apartments (Jordan does not).
  assert.ok(db().listings.some((l) => l.savedBy.includes("maya")));
  assert.ok(getGroup("g_apartments")!.privacy === "private" && getGroup("g_apartments")!.memberIds.includes("maya") && !getGroup("g_apartments")!.memberIds.includes("jordan"));

  const mjTray = traySuggestionsFor(MJ, "maya", "orderup");
  assert.ok(mjTray.forChat.length >= 1 && mjTray.discover.length >= 1);
  assert.ok(![...mjTray.forChat, ...mjTray.discover].some((x) => /Apartment|saved/i.test(x.reason)), "no unshared private group or private save in tray reasons");

  const spots = blindSpotTopicsFor(["maya", "jordan"]);
  assert.ok(spots.length >= 3);
  assert.notEqual(spots[0], "food", "already-played food topic is not ranked as top blind spot");
});

test("API routes (/api/context, /api/context/tray, /api/events, /api/groups, /api/marketplace) return Sidequest-ranked results", async () => {
  resetDb();
  const req = (url: string, user = "maya") => new NextRequest(url, { headers: { "x-user-id": user } });

  const cRes = await contextRoute(req("http://localhost/api/context?for=maya"), { params: Promise.resolve({}) });
  assert.equal(cRes.status, 200);
  const cJson = await cRes.json();
  assert.equal(cJson.profile.user.id, "maya");
  assert.ok(cJson.profile.after.gamesPlayedCount >= 2);
  assert.ok(cJson.profile.after.closenessGraph.some((m: { name: string }) => m.name.includes("Jordan")));

  const tRes = await trayRoute(req("http://localhost/api/context/tray?conversationId=c_maya_jordan&game=deepcuts"), { params: Promise.resolve({}) });
  assert.equal(tRes.status, 200);
  const tJson = await tRes.json();
  assert.ok(tJson.forChat.length >= 1);

  const evRes = await eventsRoute(req("http://localhost/api/events"), { params: Promise.resolve({}) });
  const events = await evRes.json();
  assert.ok(events.some((e: { fitLabel?: string; shareTarget?: { conversationId: string } }) => e.fitLabel?.includes("Jordan") && e.shareTarget?.conversationId === MJ));

  const grRes = await groupsRoute(req("http://localhost/api/groups", "jordan"), { params: Promise.resolve({}) });
  const groups = await grRes.json();
  assert.ok(groups.some((g: { fit?: number }) => (g.fit ?? 0) > 0.15));

  const mpRes = await marketplaceRoute(req("http://localhost/api/marketplace"), { params: Promise.resolve({}) });
  const listings = await mpRes.json();
  assert.ok((listings[0].fit ?? 0) >= (listings.at(-1).fit ?? 0), "Marketplace sorted by Sidequest context fit");
  assert.ok(listings.some((l: { fitLabel?: string }) => l.fitLabel?.includes("Jordan")));
});
