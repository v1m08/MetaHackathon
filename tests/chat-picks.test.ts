import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { GET as chatPicksGet, POST as chatPicksPost } from "@/app/api/conversations/[id]/chat-picks/route";
import { connectionScoreFor } from "@/lib/context";
import { chatPicksFor, markChatPicksShown } from "@/lib/events/chatPicks";
import { db, resetDb, sendMessage } from "@/server/db";
import type { ID } from "@/types";

const MJ = "c_maya_jordan";
const VB = "c_volleyball";

const req = (url: string, user: ID, init: { method?: string; body?: string } = {}) =>
  new NextRequest(url, { ...init, headers: { "x-user-id": user, "content-type": "application/json" } });

test("40-59 Group tier: surfaces a matching Group even before the 60 Event tier is earned", () => {
  resetDb();
  // Remove one member from g_cheapeats so c_volleyball isn't 100% saturated on food groups, or check a food group pick
  db().groups.push({
    id: "g_test_tacos",
    name: "East Austin Taco Trucks",
    cover: "",
    description: "Late-night taco trucks and birria spots.",
    privacy: "public",
    memberIds: ["jordan", "sofia"],
    adminIds: ["jordan"],
    tags: ["Food", "Austin"],
    createdAt: new Date().toISOString(),
  });

  const cs = connectionScoreFor(VB);
  assert.ok(cs.earnedTiers.includes("group") && !cs.earnedTiers.includes("event"), `expected Group-only tier, got ${cs.score}`);

  const r = chatPicksFor(VB, "devon", "k:sqburg03");
  assert.equal(r.show, true);
  if (!r.show) return;
  assert.deepEqual(r.items.map((i) => i.kind), ["group"], "only Group tier is unlocked, so only a Group card shows");
  assert.equal(r.items[0].kind === "group" && r.items[0].id, "g_test_tacos");
});

test("75+ close chat (Maya & Jordan) surfaces Event + Group + Marketplace (including food Marketplace items!)", () => {
  resetDb();
  // Simulate teammate's food Marketplace listing + unjoined Food group:
  db().listings.push({
    id: "l_test_pizza_oven",
    sellerId: "omar",
    title: "Ooni Koda 12 Pizza Oven + Cast-Iron Skillet",
    price: 165,
    images: ["https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800"],
    description: "Makes crispy neapolitan pizza and birria quesadillas in 90 seconds.",
    category: "Home & Kitchen",
    location: "East Austin",
    createdAt: new Date().toISOString(),
    condition: "Like new",
    status: "available",
    savedBy: ["zoe"],
  });
  db().groups.push({
    id: "g_test_supper",
    name: "ATX Supper Clubs & Night Markets",
    cover: "",
    description: "Pop-ups, ramen nights, and backyard dinners.",
    privacy: "public",
    memberIds: ["maya", "priya"], // Maya in, Jordan not yet -> Invite Jordan!
    adminIds: ["priya"],
    tags: ["Food", "Austin"],
    createdAt: new Date().toISOString(),
  });

  // Maya & Jordan finish a food game today:
  sendMessage(MJ, "maya", "🎮 Order Up!: Tacos", { type: "sqgame", ref: "k:sqmjtac9" });
  sendMessage(MJ, "maya", "played Taco 'Bout It · $210", { type: "sqgamelog", ref: "k:sqmjtac9" });
  sendMessage(MJ, "jordan", "played Taco 'Bout It · $225", { type: "sqgamelog", ref: "k:sqmjtac9" });

  const r = chatPicksFor(MJ, "maya", "k:sqmjtac9");
  assert.equal(r.show, true);
  if (!r.show) return;
  const kinds = r.items.map((i) => i.kind).sort();
  assert.deepEqual(kinds, ["event", "group", "listing"], "surfaces all 3 Facebook inventory types together at 75+");

  const listing = r.items.find((i) => i.kind === "listing")!;
  assert.equal(listing.id, "l_test_pizza_oven", "food/kitchen Marketplace listing matches Order Up!: Tacos");

  const grp = r.items.find((i) => i.kind === "group")!;
  assert.equal(grp.id, "g_test_supper");
  assert.match(grp.why, /Invite Jordan/);
});

test("privacy & seller rules: private Marketplace savedBy never alters fit, and seller's own listing is excluded", () => {
  resetDb();
  // Even without extra seed items, Maya & Jordan at 75+ after Indie Bands (`sqmusc04`) match `l_dj` (music) + `g_runclub` (Maya in, Jordan not, Maya+Jordan profile/chat) + event:
  const r1 = chatPicksFor(MJ, "maya", "sqmusc04");
  assert.equal(r1.show, true);
  if (!r1.show) return;
  const dj1 = r1.items.find((i) => i.kind === "listing");
  assert.equal(dj1?.id, "l_dj", "matches Sam's Pioneer DJ controller from Indie Bands game");
  assert.ok(!r1.items.some((i) => i.kind === "listing" && i.id === "l_bike"), "never suggests Jordan's own listing to Jordan's chat");

  // Mutating private savedBy on l_dj must NOT change fit or why text for Maya:
  const djListing = db().listings.find((l) => l.id === "l_dj")!;
  djListing.savedBy = ["jordan", "priya", "ethan", "omar"];
  const r2 = chatPicksFor(MJ, "maya", "sqmusc04");
  assert.equal(r2.show, true);
  if (!r2.show) return;
  assert.deepEqual(r2.items.find((i) => i.kind === "listing"), dj1, "private savedBy never leaks into Marketplace picks");
});

test("chat-picks route enforces membership and once-a-day cadence", async () => {
  resetDb();
  const url = `http://localhost/api/conversations/${MJ}/chat-picks?ref=sqmusc04`;
  const params = { params: Promise.resolve({ id: MJ }) };

  const firstGet = await (await chatPicksGet(req(url, "maya"), params)).json();
  assert.equal(firstGet.show, true);

  await chatPicksPost(req(url, "maya", { method: "POST", body: JSON.stringify({ ref: "sqmusc04" }) }), params);
  const afterShown = await (await chatPicksGet(req(url, "maya"), params)).json();
  assert.equal(afterShown.show, false);

  markChatPicksShown(MJ, "jordan", "sqmusc04");
  assert.equal((await chatPicksGet(req(url, "ethan"), params)).status, 404);
});
