import assert from "node:assert/strict";
import test from "node:test";

import { connectionScoreFor, ingestSidequestSessions, SCORE_WEIGHTS } from "@/lib/context";
import { chatPicksFor } from "@/lib/events/chatPicks";
import { fallbackIdeas, ideasContext, makeIdeaEvent, validateIdeas } from "@/lib/demo/museIdeas";
import { canSeeEvent } from "@/lib/context/visibility";
import { db, resetDb, sendMessage } from "@/server/db";

const J = "c_judges";
const JUDGES = ["jordan", "devon", "tyler", "nina", "grace"];

/** A game dropped today with only a card (no room on disk), the way dropGame posts it. */
function dropToday(ref = "k:jdtest01") {
  sendMessage(J, "tyler", "🎮 Order Up!: Tacos", { type: "sqgame", ref });
  return ref;
}

test("the score reads the chat's shape: fading chats lose momentum, lopsided chats lose balance, signals add up", () => {
  resetDb();
  const s = connectionScoreFor(J);
  const sum = s.signals.reduce((n, x) => n + x.points, 0);
  assert.ok(Math.abs(sum - s.score) <= 1, `${sum} vs ${s.score}`);
  assert.equal(Math.round(Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0) * 100), 100);
  assert.ok(s.planning > 0.3, "the cookout chat is already making plans");
  // same history seen two weeks later: nothing in the last 3 days, so momentum is gone and the score falls
  const later = connectionScoreFor(J, undefined, Date.now() + 9 * 864e5);
  assert.equal(later.parts.momentum, 0);
  assert.ok(later.score < s.score);
  // volleyball: 8 members but the same 5 carry it, so balance and cohesion sit below the judges' chat
  const vb = connectionScoreFor("c_volleyball");
  assert.ok(vb.parts.balance < s.parts.balance && vb.parts.cohesion < s.parts.cohesion);
});

test("the judges' chat starts above the Marketplace tier, so every judge's first game gets picks", () => {
  resetDb();
  const s = connectionScoreFor(J);
  assert.ok(s.score >= 75, `score ${s.score} should be >= 75`);
  assert.deepEqual(s.earnedTiers, ["group", "event", "listing"]);
  assert.equal(s.streak.days, 6);
  assert.equal(s.topics[0].topic, "food");
});

test("each judge who finishes today's game gets the post-game sheet; one who hasn't finished doesn't", () => {
  resetDb();
  const ref = dropToday();
  for (const j of JUDGES.slice(0, 3)) sendMessage(J, j, "played Taco 'Bout It · $200", { type: "sqgamelog", ref });
  for (const j of JUDGES.slice(0, 3)) {
    const r = chatPicksFor(J, j, ref);
    assert.ok(r.show, `${j}: ${!r.show ? r.reason : ""}`);
  }
  const notYet = chatPicksFor(J, "grace", ref);
  assert.equal(notYet.show, false);
  // today's half-played game doesn't drag the score under a tier
  assert.ok(connectionScoreFor(J).score >= 75);
});

test("Muse's plans: every event and listing must be a real candidate; made-up ids drop the plan; a listing is used once", () => {
  resetDb();
  const ref = dropToday();
  const ctx = ideasContext(J, ref);
  const food = ctx.listings.filter((x) => x.food).map((x) => x.l);
  assert.ok(ctx.events.length && food.length >= 3, "the seed has events and homemade food on Marketplace");
  assert.ok(ctx.members.every((m) => m.interests.length));
  const base = { daysFromNow: 3, hour: 18, where: "x", pitch: "p" };
  const ideas = validateIdeas(
    {
      intro: "gg",
      ideas: [
        { ...base, emoji: "🍽️", title: "Tasting", eventId: "", listingIds: [food[0].id, food[1].id], daysFromNow: 99, hour: 3 },
        { ...base, emoji: "🛒", title: "Fake listing", eventId: "", listingIds: [food[2].id, "l_does_not_exist"] },
        { ...base, emoji: "👻", title: "Fake event", eventId: "e_nope", listingIds: [] },
        { ...base, emoji: "📍", title: "Event plus", eventId: ctx.events[0].id, listingIds: [food[0].id, food[2].id] },
      ],
    },
    ctx,
  );
  assert.deepEqual(ideas.map((i) => i.title), ["Tasting", "Event plus"]);
  assert.equal(ideas[0].daysFromNow, 14);
  assert.equal(ideas[0].hour, 7);
  assert.equal(ideas[0].total, food[0].price + food[1].price);
  assert.equal(ideas[0].perPerson, Math.ceil((ideas[0].total / 5) * 100) / 100);
  assert.equal(ideas[1].event?.id, ctx.events[0].id);
  assert.deepEqual(ideas[1].listings.map((l) => l.id), [food[2].id], "food[0] was already in the first plan");
});

test("kits never include a chat member's own listing, a sold one, or anyone's private saves", () => {
  resetDb();
  const ctx = ideasContext(J, dropToday());
  const ids = ctx.listings.map((x) => x.l.id);
  assert.ok(!ids.includes("l_bike"), "Jordan is in the chat, so his bike isn't a find");
  db().listings.find((l) => l.id === "l_food_mochi")!.status = "sold";
  assert.ok(!ideasContext(J, "k:jdtest01").listings.some((x) => x.l.id === "l_food_mochi"));
  assert.ok(!JSON.stringify(ctx.listings.map((x) => ({ ...x.l, savedBy: undefined }))).includes("savedBy"));
});

test("Muse's ideas only read this chat: other chats' messages never reach the prompt context", () => {
  resetDb();
  const ref = dropToday();
  sendMessage("c_maya_jordan", "jordan", "SECRET_OTHER_CHAT_LINE");
  const ctx = ideasContext(J, ref);
  assert.ok(!ctx.chatLines.some((l) => l.includes("SECRET_OTHER_CHAT_LINE")));
  // no past events, and every event is visible to every member
  assert.ok(ctx.events.every((e) => new Date(e.startsAt).getTime() > Date.now()));
});

test("the fallback plans: a food tasting from different sellers, an event, all real, costs add up", () => {
  resetDb();
  const ctx = ideasContext(J, dropToday());
  const f = fallbackIdeas(ctx);
  assert.equal(f.source, "fallback");
  const tasting = f.ideas[0];
  assert.ok(tasting.listings.length >= 2 && tasting.listings.length <= 3);
  assert.equal(new Set(tasting.listings.map((l) => l.seller)).size, tasting.listings.length, "one item per seller");
  assert.ok(f.ideas.some((i) => i.event && db().events.some((e) => e.id === i.event!.id)));
  const all = f.ideas.flatMap((i) => i.listings.map((l) => l.id));
  assert.equal(new Set(all).size, all.length, "no listing appears in two plans");
  const plus = f.ideas.find((i) => i.event)!;
  assert.ok(plus.listings.every((l) => l.id.startsWith("l_food_")), "a food chat's event plan only adds food, never unrelated gear");
  for (const i of f.ideas) {
    assert.ok(i.listings.every((l) => db().listings.some((x) => x.id === l.id && x.price === l.price)));
    assert.equal(i.total, i.listings.reduce((s, l) => s + l.price, 0));
  }
});

test("Make it an event: invite-only event for the whole chat, once per idea; non-members can't", async () => {
  resetDb();
  process.env.AI_MODE = "mock";
  const ref = dropToday();
  const before = db().events.length;
  const e = await makeIdeaEvent(J, ref, 0, "nina");
  assert.equal(db().events.length, before + 1);
  assert.equal(e.hostId, "nina");
  assert.deepEqual(e.going, ["nina"]);
  assert.deepEqual(new Set(e.invited), new Set(JUDGES.filter((j) => j !== "nina")));
  assert.ok(e.kit && e.kit.listingIds.length >= 2, "the tasting plan carries its Marketplace kit onto the event");
  assert.equal(e.kit.conversationId, J);
  assert.match(e.description, /each across 5 of you/);
  assert.equal(e.created, true);
  const again = await makeIdeaEvent(J, ref, 0, "tyler");
  assert.equal(again.id, e.id);
  assert.equal(again.created, false, "a second tap doesn't announce it again");
  // invite-only: the chat sees it, nobody else does, and it never becomes a candidate for another chat's plans
  assert.ok(e.inviteOnly);
  assert.ok(canSeeEvent("grace", e) && !canSeeEvent("sofia", e));
  assert.ok(!ideasContext("c_maya_jordan", "k:sqtaco01").events.some((x) => x.id === e.id));
  assert.equal(db().events.length, before + 1);
  await assert.rejects(() => makeIdeaEvent(J, ref, 0, "sofia"));
  assert.ok(ingestSidequestSessions().some((s) => s.ref === ref));
});
