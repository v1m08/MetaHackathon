// Chat Games: taxonomy, engagement, stances, affinity, chat scores, results, context privacy, selection, the seed,
// and then the feature end to end in code: draft validation, the daily drop, playing, what a viewer may see,
// unlock ranking, the unlock itself, the feedback loop, and reset.
// No live model: AI_MODE is forced to mock below, so generation runs on the template drafts built from store data.
//   npm test
process.env.AI_MODE = "mock";
import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { POST as resetRoute } from "@/app/api/admin/reset/route";
import { ai } from "@/lib/ai";
import { dropNow, ensureDaily } from "@/lib/play/daily";
import { generateGame, MIN_ROUNDS, mockDraft, validateDraft, type Draft } from "@/lib/play/generate";
import { act, chatView, checkChoice, setMuted, viewGame } from "@/lib/play/play";
import { checkWhy, fitFor, maybeUnlock, rankInventory, respondUnlock, unlockFacts, viewUnlock } from "@/lib/play/recommend";
import { quotable } from "@/lib/play/select";

import { seedGames } from "@/data/play";
import { buildContext, quoteIn } from "@/lib/play/context";
import { answerOf, performance, roundResults } from "@/lib/play/results";
import { localHour, prevDay } from "@/lib/play/day";
import { affinityFor, chatScore, chatTopics, confident, engagement, peerStances, prior, stances, streakDays, streakInfo, THRESHOLDS } from "@/lib/play/score";
import { feasible, selectGame } from "@/lib/play/select";
import { completedBy, dayKey, FORMATS, gamesIn, logEvent, playStore, resetPlayStore, saveGame, setAnswer, unlocksIn, type Choice, type Format, type Option, type PlayGame, type Round, type Unlock, type UnlockTier } from "@/lib/play/store";
import { isTopic, topicsOfEvent, topicsOfGroup, topicsOfListing, type TopicId } from "@/lib/play/taxonomy";
import { canSeePost } from "@/lib/play/visibility";
import { conversationsFor, createPost, db, getConversation, getEvent, getGroup, getListing, getOrCreateDM, getUser, notificationsFor, resetDb, rsvp, sendMessage, unreadCount } from "@/server/db";
import type { Conversation, ID } from "@/types";

const DAY = 864e5, HOUR = 3600e3, MIN = 60e3;
const VB = "c_volleyball";
const CREW = ["devon", "tyler", "marcus", "nina", "grace", "ethan", "sam", "jordan"];
const iso = (t: number) => new Date(t).toISOString();

/** A clean database and an EMPTY play store (no seeded history). */
function clean() { resetDb(); resetPlayStore({ seed: false }); }
function chat(id: ID, participantIds: ID[]): Conversation {
  const c: Conversation = { id, participantIds, isGroup: participantIds.length > 2, messages: [] };
  db().conversations.push(c);
  return c;
}
const opt = (id: string, topic?: TopicId, userId?: ID): Option => ({ id, label: id, topic, userId });
const round = (id: string, kind: Round["kind"], options: Option[], answer?: string): Round => ({ id, kind, prompt: `prompt ${id}`, options, answer, evidenceIds: [] });
let n = 0;
/** A game dropped `daysAgo` days back (0 = today, created an hour ago). */
function game(conversationId: ID, format: Format, topic: TopicId, rounds: Round[], daysAgo = 0, extra: Partial<PlayGame> = {}): PlayGame {
  const createdAt = iso(Date.now() - daysAgo * DAY - HOUR);
  return saveGame({ id: `g_t${n++}`, conversationId, date: dayKey(new Date(Date.now() - daysAgo * DAY)), format, topic, title: "t", premise: "p", rounds, evidence: [], mode: "mock", costUsd: 0, dropped: [], createdAt, ...extra });
}
/** Answer the given rounds and (unless `finish: false`) complete, `afterMs` after the drop. */
function play(g: PlayGame, userId: ID, answers: Record<string, Choice>, o: { afterMs?: number; finish?: boolean; react?: boolean } = {}) {
  const at = iso(new Date(g.createdAt).getTime() + (o.afterMs ?? 0));
  for (const [roundId, choice] of Object.entries(answers)) { setAnswer(g.id, userId, roundId, choice); logEvent({ gameId: g.id, conversationId: g.conversationId, userId, roundId, kind: "answer", choice, at }); }
  if (o.finish !== false) logEvent({ gameId: g.id, conversationId: g.conversationId, userId, kind: "complete", at });
  if (o.react) logEvent({ gameId: g.id, conversationId: g.conversationId, userId, kind: "react", choice: "🔥", at });
}
const near = (a: number, b: number, msg?: string) => assert.ok(Math.abs(a - b) < 1e-6, msg ?? `${a} ≉ ${b}`);

// ---------- taxonomy ----------
test("real events, groups and listings land on the topics a person would expect", () => {
  clean();
  assert.ok(topicsOfEvent(getEvent("e_volleyball_sunday")!).includes("sports"));
  assert.ok(topicsOfEvent(getEvent("e_pickleball_tourney")!).includes("sports"));
  assert.deepEqual(topicsOfEvent(getEvent("e_porch_lights")!), ["music"]);
  assert.deepEqual(topicsOfGroup(getGroup("g_cheapeats")!), ["food"]);
  assert.deepEqual(topicsOfGroup(getGroup("g_volleyball")!), ["sports"]);
  assert.ok(topicsOfGroup(getGroup("g_runclub")!).includes("running"));
  assert.ok(topicsOfListing(getListing("l_paddles")!).includes("sports"));
  assert.ok(topicsOfListing(getListing("l_dj")!).includes("music"));
  assert.deepEqual(topicsOfListing(getListing("l_bike")!), ["cycling"]);
  assert.ok(isTopic("food") && isTopic("sports"));
  assert.ok(!isTopic("tacos") && !isTopic(3) && !isTopic(undefined) && !isTopic(""));
});

// ---------- engagement ----------
test("engagement = 0.35 finished + 0.20 promptness + 0.20 depth + 0.25 social", () => {
  clean();
  const g = game(VB, "blend", "food", [round("r1", "pick", [opt("a", "food"), opt("b", "music")]), round("r2", "pick", [opt("a", "food"), opt("b", "music")])]);
  play(g, "devon", { r1: "a", r2: "a" }); // straight away, every round
  play(g, "tyler", { r1: "a", r2: "a" }, { afterMs: 12 * HOUR }); // twelve hours late
  play(g, "marcus", { r1: "a" }, { afterMs: 0 }); // finished, but skipped a round
  play(g, "grace", { r1: "a", r2: "b" }, { finish: false }); // answered, never finished
  play(g, "sam", { r1: "a", r2: "a" }, { react: true });

  const d = engagement(g, "devon");
  assert.deepEqual([d.completed, d.promptness, d.depth, d.social], [true, 1, 1, false]);
  near(d.value, 0.75);
  near(engagement(g, "tyler").promptness, Math.exp(-1));
  near(engagement(g, "tyler").value, 0.35 + 0.2 * Math.exp(-1) + 0.2);
  near(engagement(g, "marcus").depth, 0.5);
  near(engagement(g, "marcus").value, 0.35 + 0.2 + 0.1);
  const gr = engagement(g, "grace");
  assert.deepEqual([gr.completed, gr.promptness, gr.depth], [false, 0, 1]);
  near(gr.value, 0.2);
  assert.equal(engagement(g, "sam").social, true);
  near(engagement(g, "sam").value, 1);
  assert.equal(engagement(g, "nina").value, 0); // never opened it
});

test("a chat reply within 30 minutes of finishing is social; later, drafts and system lines are not", () => {
  clean();
  const c = getConversation(VB)!;
  const g = game(VB, "split", "food", [round("r1", "split", [opt("a", "food"), opt("b", "music")])], 1);
  const t0 = new Date(g.createdAt).getTime();
  for (const u of ["devon", "tyler", "marcus", "grace", "sam"]) play(g, u, { r1: { pick: "a", predict: "a" } });
  const say = (senderId: ID, afterMs: number, extra = {}) => c.messages.push({ id: `m_t_${senderId}`, senderId, text: "ok who picked b", createdAt: iso(t0 + afterMs), ...extra });
  say("devon", 29 * MIN);
  say("tyler", 31 * MIN);
  say("marcus", 5 * MIN, { status: "draft" });
  say("grace", 5 * MIN, { system: true });
  say("sam", -5 * MIN); // said before finishing
  assert.equal(engagement(g, "devon").social, true);
  near(engagement(g, "devon").value, 1);
  for (const u of ["tyler", "marcus", "grace", "sam"]) assert.equal(engagement(g, u).social, false, u);
});

// ---------- stance ----------
test("stances: split and blend picks, wager points; nothing from right/wrong rounds or rankings", () => {
  clean();
  const split = game(VB, "split", "sports", [round("r1", "split", [opt("a", "sports"), opt("b", "food")])]);
  assert.deepEqual(stances(split, { r1: { pick: "a", predict: "b" } }), [{ topic: "sports", w: 1 }, { topic: "food", w: -0.5 }]);
  const blend = game(VB, "blend", "food", [round("r1", "pick", [opt("a", "food"), opt("b", "music"), opt("c", "water"), opt("d")])]);
  assert.deepEqual(stances(blend, { r1: "b" }), [{ topic: "music", w: 1 }, { topic: "food", w: -0.25 }, { topic: "water", w: -0.25 }]);
  assert.deepEqual(stances(blend, { r1: "d" }), []); // an option with no topic says nothing, and neither does having played a food game
  const wager = game(VB, "wager", "music", [round("r1", "points", [opt("a", "music"), opt("b", "sports"), opt("c", "food")])]);
  assert.deepEqual(stances(wager, { r1: { a: 6, b: 4, c: 0 } }), [{ topic: "music", w: 1.5 * 0.6 }, { topic: "sports", w: 1.5 * 0.4 }]);
  assert.deepEqual(stances(wager, { r1: { a: 0, b: 0, c: 10 } }), [{ topic: "food", w: 1.5 }], "no points on the Wager's own topic: no credit for it");
  const receipts = game(VB, "receipts", "food", [round("r1", "pick", [opt("devon", "sports", "devon"), opt("nina", "food", "nina")], "nina")]);
  assert.deepEqual(stances(receipts, { r1: "devon" }), []); // guessing who said it is not a taste
  const lineup = game(VB, "lineup", "sports", [round("r1", "rank", [opt("devon", "sports", "devon"), opt("nina", "sports", "nina")])]);
  assert.deepEqual(stances(lineup, { r1: ["devon", "nina"] }), []);
  for (const g of [split, blend, wager, receipts, lineup]) { assert.deepEqual(stances(g, undefined), []); assert.deepEqual(stances(g, {}), []); }
});

test("peerStances: being ranked first by others in a Lineup counts a little for you, your own vote does not", () => {
  clean();
  const members = ["devon", "nina", "grace"].map((u) => opt(u, undefined, u));
  const g = game(VB, "lineup", "sports", [round("r1", "rank", members), round("r2", "rank", members)]);
  play(g, "devon", { r1: ["devon", "nina", "grace"], r2: ["nina", "devon", "grace"] });
  play(g, "tyler", { r1: ["nina", "devon", "grace"], r2: ["nina", "grace", "devon"] });
  // at most 0.3 a round, scaled by the share of the OTHER finished players who put you first
  assert.deepEqual(peerStances(g, "nina"), [{ topic: "sports", w: 0.15 }, { topic: "sports", w: 0.3 }]);
  assert.deepEqual(peerStances(g, "devon"), []); // only Devon put Devon first
  assert.deepEqual(peerStances(g, "grace"), []);
  play(g, "marcus", { r1: ["grace", "nina", "devon"], r2: ["grace", "nina", "devon"] }, { finish: false });
  assert.deepEqual(peerStances(g, "grace"), [], "a ranking its player hasn't finished counts for nobody");
  // Someone who never opened the game gets a small nudge from being ranked first, not near-maximum affinity.
  const base = prior("nina").sports;
  const a = affinityFor("nina");
  assert.ok(a.raw.sports - base > 0 && a.raw.sports - base <= 0.2 * 0.45 + 1e-9, `nina's raw sports moved by ${a.raw.sports - base}`);
  assert.ok(a.score.sports - Math.tanh(base / 1.5) < 0.1);
  const blend = game(VB, "blend", "sports", [round("r1", "pick", members)]);
  play(blend, "tyler", { r1: "nina" });
  assert.deepEqual(peerStances(blend, "nina"), []);
});

// ---------- affinity ----------
test("affinity starts from stated interests and grows with picks", () => {
  clean();
  assert.ok(prior("devon").sports >= 0.2, "volleyball is one of Devon's interests");
  assert.equal(prior("nina").sports, 0);
  assert.ok(prior("nina").home >= 0.4, "houseplants + propagation");
  assert.ok(Object.values(prior("sam")).every((v) => v >= 0 && v <= 0.6), "the prior is shrunk");
  assert.deepEqual(affinityFor("nina").raw, prior("nina"));
  assert.equal(affinityFor("nina").observations.sports, 0);

  const g = game(VB, "split", "sports", [round("r1", "split", [opt("a", "sports"), opt("b", "home")])]);
  play(g, "nina", { r1: { pick: "a", predict: "a" } });
  const a = affinityFor("nina");
  const e = engagement(g, "nina").value;
  assert.ok(a.raw.sports > 0.9 * e && a.raw.sports <= e, `raw sports ${a.raw.sports}`); // 1 pick × engagement × ~1 decay; nothing for just playing a sports game
  assert.ok(a.raw.home < prior("nina").home, "the side passed over drops");
  assert.equal(a.observations.sports, 1);
  assert.ok(a.score.sports > 0 && a.score.sports < 1);
  assert.deepEqual(affinityFor("grace").raw, prior("grace"), "someone who didn't play is untouched");
  // An answer counts only once its player has finished: a tap they can still change moves nothing.
  play(g, "tyler", { r1: { pick: "a", predict: "a" } }, { finish: false });
  assert.deepEqual(affinityFor("tyler").raw, prior("tyler"));
  assert.equal(affinityFor("tyler").observations.sports, 0);
  // Playing games that ask for no preference (Receipts) builds no affinity for their topic.
  const rc = game(VB, "receipts", "community", [round("r1", "pick", [opt("devon", undefined, "devon"), opt("nina", undefined, "nina")], "nina")]);
  play(rc, "grace", { r1: "nina" });
  assert.deepEqual(affinityFor("grace").raw, prior("grace"));
});

test("the taste prior is not saturated: a person's leading taste nears the cap, most topics stay well under it", () => {
  clean();
  const high = db().users.map((u) => Object.values(prior(u.id)).filter((v) => v >= 0.5).length);
  assert.ok(Math.max(...high) <= 4, `most topics at the cap for someone: ${Math.max(...high)}`);
  assert.ok(high.filter((n) => n <= 2).length >= high.length * 0.8, "for most people at most two topics start near the cap");
  const d = prior("devon");
  assert.ok(d.sports >= 0.2, "a stated interest still counts");
  assert.ok(Object.values(d).every((v) => v >= 0 && v <= 0.6));
  // Never played: no fit, so no "From your games" line on Events or Groups.
  for (const u of ["priya", "sofia", "aisha", "lucas"].filter((id) => getUser(id))) for (const e of db().events) assert.equal(fitFor(u, topicsOfEvent(e)).fit, 0, `${u} / ${e.id}`);
  logEvent({ conversationId: VB, userId: "devon", kind: "rsvp", topic: "food" });
  assert.ok(fitFor("devon", ["food"]).fit > 0.15, "real feedback gives a fit");
  assert.equal(fitFor("devon", ["sports"]).fit, 0, "a prior alone does not");
});

test("affinity decays with a 14-day half-life; rsvp / join / save / dismiss move it", () => {
  clean();
  const g = game(VB, "split", "sports", [round("r1", "split", [opt("a", "sports"), opt("b", "sports")])]);
  play(g, "nina", { r1: { pick: "a", predict: "a" } });
  const t = new Date(g.createdAt).getTime();
  const fresh = affinityFor("nina", t).raw.sports;
  near(affinityFor("nina", t + 14 * DAY).raw.sports, fresh / 2);
  near(affinityFor("nina", t + 28 * DAY).raw.sports, fresh / 4);

  clean();
  const at = iso(Date.now());
  const now = new Date(at).getTime();
  const base = prior("grace");
  logEvent({ conversationId: VB, userId: "grace", kind: "rsvp", topic: "sports", at });
  near(affinityFor("grace", now).raw.sports, base.sports + 2);
  logEvent({ conversationId: VB, userId: "grace", kind: "dismiss", topic: "music", at });
  near(affinityFor("grace", now).raw.music, base.music - 1);
  logEvent({ conversationId: VB, userId: "grace", kind: "join", topic: "gaming", at });
  logEvent({ conversationId: VB, userId: "grace", kind: "save", topic: "community", at });
  near(affinityFor("grace", now).raw.gaming, base.gaming + 1.5);
  near(affinityFor("grace", now).raw.community, base.community + 1);
  near(affinityFor("grace", now + 14 * DAY).raw.sports, base.sports + 1);
  assert.equal(affinityFor("grace", now).observations.sports, 1);
  assert.deepEqual(affinityFor("tyler", now).raw, prior("tyler"), "feedback is per person");
  const s = affinityFor("grace", now).score;
  assert.ok(Object.values(s).every((v) => v > -1 && v < 1));
});

// ---------- chat level ----------
test("a topic one member loves scores below a topic the whole chat mildly likes", () => {
  clean();
  // Nobody in this chat has a prior on "community"; "gaming" starts at 0 for six of the eight.
  for (let i = 0; i < 4; i++) logEvent({ conversationId: VB, userId: "sam", kind: "rsvp", topic: "community" });
  for (const u of CREW) logEvent({ conversationId: VB, userId: u, kind: "save", topic: "gaming" });
  const topics = chatTopics(VB);
  const loud = topics.find((t) => t.topic === "community")!;
  const shared = topics.find((t) => t.topic === "gaming")!;
  assert.ok(affinityFor("sam").score.community > 0.99, "Sam is all in");
  assert.ok(Math.max(...CREW.map((u) => affinityFor(u).score.gaming)) < affinityFor("sam").score.community, "nobody is as keen on the shared one");
  near(loud.coverage, 1 / 8);
  assert.equal(shared.coverage, 1);
  assert.ok(loud.agreement < shared.agreement);
  assert.ok(loud.mean > 0 && loud.score > 0);
  assert.ok(loud.score < shared.score / 10, `${loud.score} vs ${shared.score}`);
  near(shared.score, shared.mean * shared.coverage * shared.agreement);
  for (let i = 1; i < topics.length; i++) assert.ok(topics[i - 1].score >= topics[i].score, "sorted best first");
});

/** The UTC instant of an Austin wall time on calendar day `key` (tries both offsets, CST and CDT). */
function austin(key: string, h: number, m = 0): number {
  for (const off of [5, 6]) {
    const t = Date.parse(`${key}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`) + off * HOUR;
    if (dayKey(t) === key && localHour(t) === h) return t;
  }
  throw new Error(`no ${h}:${m} on ${key} in Austin`);
}
const daysBack = (n: number) => dayKey(Date.now() - n * DAY);
/** A game dropped at 9am Austin `daysAgo` days back (today: a minute ago), so finishes land on a known calendar day. */
function dayGame(conversationId: ID, daysAgo: number, format: Format = "blend") {
  const key = daysBack(daysAgo);
  const createdAt = iso(daysAgo === 0 ? Date.now() - MIN : austin(key, 9));
  return game(conversationId, format, "food", [round("r1", "pick", [opt("a", "food"), opt("b", "music")])], daysAgo, { date: key, createdAt });
}
/** `players` finish the game at an Austin wall time on its own day (or `dayShift` days later). */
function finishAt(g: PlayGame, players: ID[], h = 10, m = 0, dayShift = 0) {
  let key = g.date;
  for (let i = 0; i < dayShift; i++) key = new Date(Date.parse(`${key}T12:00:00Z`) + DAY).toISOString().slice(0, 10);
  const at = austin(key, h, m);
  for (const u of players) play(g, u, { r1: "a" }, { afterMs: at - new Date(g.createdAt).getTime() });
}
/** Played (5 of 8) or thin (3 of 8) days back from yesterday, oldest last. */
function history(days: ("ok" | "miss" | "none")[]) {
  days.forEach((d, i) => { if (d === "none") return; finishAt(dayGame(VB, i + 1), CREW.slice(0, d === "ok" ? 5 : 3)); });
}

test("dayKey: the Austin calendar day for timestamps (CST and CDT); a day string passes through; prevDay is DST-safe", () => {
  assert.equal(dayKey("2026-11-14"), "2026-11-14");
  assert.equal(dayKey("2026-11-15T05:30:00.000Z"), "2026-11-14", "11:30pm Austin (CST) is still the 14th");
  assert.equal(dayKey("2026-11-15T06:30:00.000Z"), "2026-11-15");
  assert.equal(dayKey("2026-07-04T04:30:00.000Z"), "2026-07-03", "11:30pm Austin (CDT) is still the 3rd");
  assert.equal(dayKey(Date.parse("2026-07-04T05:30:00.000Z")), "2026-07-04");
  assert.equal(prevDay("2026-03-09"), "2026-03-08", "across the spring-forward change");
  assert.equal(prevDay("2026-11-02"), "2026-11-01", "across the fall-back change");
  assert.equal(prevDay("2026-03-01"), "2026-02-28");
  assert.equal(prevDay("2027-01-01"), "2026-12-31");
});

test("streak: a majority must finish by Austin midnight; today unplayed neither adds nor breaks; catching up later doesn't rebuild", () => {
  clean();
  assert.equal(streakDays(VB), 0);
  history(["ok", "ok", "ok"]);
  assert.equal(streakDays(VB), 3);
  const today = dayGame(VB, 0);
  for (const u of CREW.slice(0, 2)) play(today, u, { r1: "a" });
  assert.equal(streakDays(VB), 3, "today not being played yet neither adds nor breaks");
  for (const u of CREW.slice(2, 5)) play(today, u, { r1: "a" });
  assert.equal(streakDays(VB), 4, "a majority finishing today adds it");

  // Exactly half is not a majority; a fifth finish the next morning doesn't make it a played day.
  clean();
  const thin = dayGame(VB, 1);
  finishAt(thin, CREW.slice(0, 4));
  finishAt(thin, ["jordan"], 0, 30, 1);
  assert.equal(completedBy(thin.id).size, 5);
  assert.equal(streakDays(VB), 0, "12:30am the next day is too late");

  // In a DM one person playing alone is not the chat playing.
  clean();
  const duo = chat("c_t_solo", ["maya", "jordan"]);
  for (const d of [3, 2, 1]) finishAt(dayGame(duo.id, d), ["maya"]);
  assert.equal(streakDays(duo.id), 0);
});

test("streak: a finish at 11:30pm Austin counts for that day, 12:30am the next doesn't", () => {
  clean();
  const late = dayGame(VB, 1);
  finishAt(late, CREW.slice(0, 4));
  finishAt(late, ["jordan"], 23, 30);
  assert.equal(streakDays(VB), 1);
  clean();
  const tooLate = dayGame(VB, 1);
  finishAt(tooLate, CREW.slice(0, 4));
  finishAt(tooLate, ["jordan"], 0, 30, 1);
  assert.equal(streakDays(VB), 0);
});

test("streak freeze: one missed day a week is forgiven and adds nothing; a second miss within 7 days or two in a row ends it", () => {
  clean();
  history(["ok", "miss", "ok", "ok"]);
  assert.equal(streakDays(VB), 3, "yesterday, then the freeze holds the thin day, then two more");
  assert.deepEqual(streakInfo(VB).freezes, [daysBack(2)]);

  clean();
  history(["ok", "miss", "ok", "ok", "miss", "ok"]);
  assert.equal(streakDays(VB), 3, "the second miss is inside the same 7 days: it ends there");

  clean();
  history(["ok", "miss", "miss", "ok"]);
  assert.equal(streakDays(VB), 1, "two misses in a row: one freeze can't cover both");
  assert.deepEqual(streakInfo(VB).freezes, [], "a freeze at the far end holds nothing");

  clean();
  history(["ok", "none", "ok"]);
  assert.equal(streakDays(VB), 2, "a day with no game at all is a miss the freeze can cover");

  clean();
  history(["ok", "miss", "ok", "ok", "ok", "ok", "ok", "ok", "miss", "ok"]);
  assert.equal(streakDays(VB), 8, "misses 7 days apart each get a freeze");
  assert.deepEqual(streakInfo(VB).freezes, [daysBack(2), daysBack(9)]);

  // Catching up on six unplayed days today can't rebuild them; late play still counts as participation.
  clean();
  const four = chat("c_t_four", ["devon", "sam", "tyler", "grace"]);
  const old = [6, 5, 4, 3, 2, 1].map((d) => dayGame(four.id, d));
  const before = chatScore(four.id).score;
  for (const g of old) for (const u of ["devon", "sam", "tyler"]) play(g, u, { r1: "a" }, { afterMs: Date.now() - new Date(g.createdAt).getTime() });
  assert.equal(streakDays(four.id), 0);
  assert.equal(chatScore(four.id).parts.streak, 0);
  assert.ok(chatScore(four.id).score > before);
});

test("streakInfo: today's meter (counts only), the evening hourglass, milestones at 3 / 7 / 14 / 30", () => {
  clean();
  history(["ok", "ok"]);
  const key = dayKey();
  const today = game(VB, "blend", "food", [round("r1", "pick", [opt("a", "food"), opt("b", "music")])], 0, { date: key, createdAt: iso(austin(key, 0, 1)) });
  for (const u of CREW.slice(0, 2)) play(today, u, { r1: "a" });
  const morning = streakInfo(VB, austin(key, 10));
  assert.deepEqual(morning.today, { hasGame: true, finished: 2, members: 8, needed: 5, lockedIn: false });
  assert.equal(morning.hourglass, false, "not before 6pm");
  assert.equal(morning.milestone, undefined);
  assert.equal(streakInfo(VB, austin(key, 20)).hourglass, true, "evening and not locked in: the streak is at risk");
  for (const u of CREW.slice(2, 5)) play(today, u, { r1: "a" });
  const locked = streakInfo(VB, austin(key, 20));
  assert.equal(locked.today.lockedIn, true);
  assert.equal(locked.hourglass, false);
  assert.equal(locked.days, 3);
  assert.equal(locked.milestone, 3, "three days in a row, today included");
  clean();
  history(["ok"]);
  assert.equal(streakInfo(VB).today.hasGame, false);
  assert.equal(streakInfo(VB).milestone, undefined);
});

test("chat score = 40% participation + 20% streak + 20% reciprocity + 20% confidence over 14 days", () => {
  clean();
  assert.deepEqual(THRESHOLDS, { group: 40, event: 60, listing: 75 });
  const none = chatScore(VB);
  assert.equal(none.score, 0, "a chat that never played scores nothing, whatever its members' tastes");
  assert.deepEqual(none.earned, []);
  assert.deepEqual(none.next, { tier: "group", at: 40 });

  const r = () => [round("r1", "pick", [opt("a", "food"), opt("b", "music")])];
  // A game that was dropped and never played scores nothing either: not participation, not "topic confidence".
  const unplayed = game(VB, "split", "food", [round("r1", "split", [opt("a", "food"), opt("b", "music")])], 3);
  const dropped = chatScore(VB);
  assert.equal(dropped.score, 0);
  assert.equal(dropped.parts.confidence, 0);
  assert.ok(dropped.topics.every((t) => t.games === 0 && t.observedBy === 0), "an unplayed game touches no topic");
  play(unplayed, "devon", { r1: { pick: "a", predict: "a" } }, { finish: false });
  assert.equal(chatScore(VB).score, 0, "an unfinished answer is not play");
  playStore().games.delete(unplayed.id);
  playStore().answers.delete(unplayed.id);
  playStore().events.length = 0;

  const g1 = game(VB, "blend", "food", r(), 1);
  CREW.slice(0, 5).forEach((u, i) => play(g1, u, { r1: "a" }, { react: i < 1 })); // 5 of 8, one of them reacted
  const g2 = game(VB, "blend", "food", r(), 2);
  CREW.slice(0, 6).forEach((u, i) => play(g2, u, { r1: "a" }, { react: i < 2 })); // 6 of 8, a third reacted
  game(VB, "blend", "food", r(), 20); // outside the window: ignored for participation
  const s = chatScore(VB);
  assert.equal(s.games, 2);
  assert.equal(s.streakDays, 2);
  near(s.parts.participation, (5 / 8 + 6 / 8) / 2);
  near(s.parts.streak, 2 / 7);
  near(s.parts.reciprocity, (1 / 5 + 2 / 6) / 2);
  assert.equal(s.topics[0].topic, "food");
  assert.deepEqual([s.topics[0].games, s.topics[0].observedBy], [2, 6]);
  near(s.parts.confidence, Math.min(1, s.topics[0].score / 0.4) * Math.min(1, 6 / 8 / 0.6));
  assert.equal(s.score, Math.round(100 * (0.4 * s.parts.participation + 0.2 * s.parts.streak + 0.2 * s.parts.reciprocity + 0.2 * s.parts.confidence)));
  assert.ok(s.score >= 40 && s.score < 60, `score ${s.score}`);
  assert.deepEqual(s.earned, ["group"]);
  assert.deepEqual(s.next, { tier: "event", at: 60 });

  // Confidence follows how much of the chat has played the top topic: one game, 2 of 8, is a quarter of the way to 60%.
  clean();
  const thin = game(VB, "blend", "food", r(), 1);
  for (const u of CREW.slice(0, 2)) play(thin, u, { r1: "a" });
  const t = chatScore(VB);
  near(t.parts.confidence, Math.min(1, t.topics.find((x) => x.observedBy > 0)!.score / 0.4) * (2 / 8 / 0.6));

  // Today's game can lift participation but never lower it: the bar doesn't fall when the day's game is dropped.
  clean();
  const y = game(VB, "blend", "food", r(), 1);
  for (const u of CREW.slice(0, 6)) play(y, u, { r1: "a" });
  const pre = chatScore(VB);
  const today = game(VB, "blend", "music", r(), 0);
  const post = chatScore(VB);
  assert.equal(post.score, pre.score, "dropping today's game changes nothing");
  near(post.parts.participation, 6 / 8);
  for (const u of CREW.slice(0, 3)) play(today, u, { r1: "b" });
  near(chatScore(VB).parts.participation, 6 / 8);
  for (const u of CREW.slice(3)) play(today, u, { r1: "b" });
  near(chatScore(VB).parts.participation, (6 / 8 + 1) / 2);
});

test("a tier is earned only when the score is there AND a topic is settled (2+ games, 60% of the chat)", () => {
  clean();
  const duo = chat("c_t_duo", ["maya", "jordan"]);
  const r = () => [round("r1", "pick", [opt("a", "food"), opt("b", "music")])];
  const g1 = game(duo.id, "blend", "food", r(), 1);
  play(g1, "maya", { r1: "a" }, { react: true });
  play(g1, "jordan", { r1: "a" }, { react: true });
  const one = chatScore(duo.id);
  assert.ok(one.score >= 60, `score ${one.score}`);
  assert.ok(!one.topics.some((t) => confident(t, 2)), "one game is not enough to call a topic");
  assert.deepEqual(one.earned, [], "high score, no settled topic: nothing unlocks");

  // A second game on other topics that only one of the two plays: still not settled for anyone.
  const g2 = game(duo.id, "blend", "art", [round("r1", "pick", [opt("a", "art"), opt("b", "film")])], 2);
  play(g2, "maya", { r1: "a" });
  assert.deepEqual(chatScore(duo.id).earned, []);

  const g3 = game(duo.id, "split", "food", [round("r1", "split", [opt("a", "food"), opt("b", "food")])], 3);
  play(g3, "maya", { r1: { pick: "a", predict: "a" } }, { react: true });
  play(g3, "jordan", { r1: { pick: "b", predict: "a" } }, { react: true });
  const two = chatScore(duo.id);
  const food = two.topics.find((t) => t.topic === "food")!;
  assert.ok(confident(food, 2) && food.games === 2 && food.observedBy === 2);
  assert.ok(two.earned.includes("group") && two.earned.includes("event"), `earned ${two.earned}`);
  assert.equal(two.earned.includes("listing"), two.score >= 75);
});

// ---------- results ----------
test("results and performance: pick and split rounds", () => {
  clean();
  const g = game(VB, "split", "food", [round("r1", "split", [opt("a", "food"), opt("b", "music")]), round("r2", "pick", [opt("a", "food"), opt("b", "music"), opt("c", "water")])]);
  play(g, "devon", { r1: { pick: "a", predict: "a" }, r2: "c" });
  play(g, "tyler", { r1: { pick: "a", predict: "b" }, r2: "c" });
  play(g, "nina", { r1: { pick: "b", predict: "a" }, r2: "a" });
  const [r1, r2] = roundResults(g);
  assert.deepEqual(r1.totals, { a: 2, b: 1 });
  assert.deepEqual(r1.who, { a: ["devon", "tyler"], b: ["nina"] });
  assert.deepEqual([r1.order[0], r1.voters, r1.answer], ["a", 3, undefined]);
  assert.deepEqual(r2.totals, { a: 1, b: 0, c: 2 });
  assert.equal(r2.order[0], "c");
  assert.equal(performance(g, "devon"), 1); // predicted the split, picked with the chat
  assert.equal(performance(g, "tyler"), 0.5); // predicted wrong, picked with the chat
  assert.equal(performance(g, "nina"), 0.5); // predicted right, picked alone
  assert.equal(performance(g, "grace"), null); // didn't play

  const solo = game(VB, "blend", "food", [round("r1", "pick", [opt("a", "food"), opt("b", "music")])]);
  play(solo, "devon", { r1: "a" });
  assert.equal(performance(solo, "devon"), null, "nothing to compare against with one voter");

  // Someone who tapped an answer and backed out (or is still mid-game) is not counted or named.
  play(g, "sam", { r1: { pick: "b", predict: "b" }, r2: "b" }, { finish: false });
  const [u1, u2] = roundResults(g);
  assert.deepEqual(u1.who, { a: ["devon", "tyler"], b: ["nina"] });
  assert.deepEqual([u1.voters, u2.totals.b], [3, 0]);
  logEvent({ gameId: g.id, conversationId: VB, userId: "sam", kind: "complete" });
  assert.deepEqual(roundResults(g)[0].who, { a: ["devon", "tyler"], b: ["nina", "sam"] }, "counted once they finish");
});

test("results and performance: rank (Borda) and points", () => {
  clean();
  const members = ["devon", "nina", "grace"].map((u) => opt(u, undefined, u));
  const lineup = game(VB, "lineup", "sports", [round("r1", "rank", members)]);
  play(lineup, "tyler", { r1: ["nina", "devon", "grace"] });
  play(lineup, "marcus", { r1: ["nina", "grace", "devon"] });
  play(lineup, "sam", { r1: ["grace", "devon", "nina"] });
  const [lr] = roundResults(lineup);
  assert.deepEqual(lr.totals, { devon: 2 + 1 + 2, nina: 3 + 3 + 1, grace: 1 + 2 + 3 });
  assert.deepEqual(lr.order, ["nina", "grace", "devon"]);
  assert.equal(performance(lineup, "marcus"), 1); // matched the chat's order exactly
  near(performance(lineup, "tyler")!, 1 - 2 / 4); // two neighbours swapped
  assert.equal(performance(lineup, "sam"), 0); // as far from the consensus as three items allow (distance 4 of max 4)

  const wager = game(VB, "wager", "music", [round("r1", "points", [opt("a", "music"), opt("b", "sports"), opt("c", "food")])]);
  play(wager, "devon", { r1: { a: 10, b: 0, c: 0 } });
  play(wager, "tyler", { r1: { a: 4, b: 6, c: 0 } });
  play(wager, "nina", { r1: { a: 6, b: 4, c: 0 } });
  const [wr] = roundResults(wager);
  assert.deepEqual(wr.totals, { a: 20, b: 10, c: 0 });
  assert.deepEqual(wr.who, { a: ["devon", "tyler", "nina"], b: ["tyler", "nina"], c: [] });
  assert.deepEqual(wr.order, ["a", "b", "c"]);
  near(performance(wager, "devon")!, 1 - (1 / 3 + 1 / 3) / 2);
  near(performance(wager, "nina")!, 1 - (2 / 30 + 2 / 30) / 2);
  assert.ok(performance(wager, "nina")! > performance(wager, "tyler")!, "closer to the chat's spread reads the room better");
});

test("results and performance: Receipts answers, and the Hot Seat subject's own answer is the truth", () => {
  clean();
  const receipts = game(VB, "receipts", "food", [round("r1", "pick", [opt("devon", undefined, "devon"), opt("nina", undefined, "nina")], "nina"), round("r2", "pick", [opt("sam", undefined, "sam"), opt("tyler", undefined, "tyler")], "sam")]);
  play(receipts, "grace", { r1: "nina", r2: "tyler" });
  play(receipts, "ethan", { r1: "nina", r2: "sam" });
  assert.equal(roundResults(receipts)[0].answer, "nina");
  assert.equal(performance(receipts, "grace"), 0.5);
  assert.equal(performance(receipts, "ethan"), 1);

  const hot = game(VB, "hotseat", "music", [round("r1", "pick", [opt("a"), opt("b"), opt("c")], "a"), round("r2", "pick", [opt("a"), opt("b")], "b")], 0, { subjectId: "sam" });
  play(hot, "jordan", { r1: "a", r2: "b" });
  play(hot, "tyler", { r1: "c", r2: "b" });
  assert.equal(answerOf(hot, hot.rounds[0]), "a", "until the subject plays, the cited answer stands");
  assert.equal(performance(hot, "jordan"), 1);
  assert.equal(performance(hot, "tyler"), 0.5);
  play(hot, "sam", { r1: "c" }, { finish: false });
  assert.equal(answerOf(hot, hot.rounds[0]), "a", "a tap the subject can still change is not the truth yet");
  play(hot, "sam", { r1: "c", r2: "b" }); // Sam says the cited answer was wrong
  const [h1, h2] = roundResults(hot);
  assert.equal(h1.answer, "c");
  assert.equal(h2.answer, "b");
  assert.equal(h1.voters, 2, "the subject sets the answer and is not counted as a voter");
  assert.deepEqual(h1.totals, { a: 1, b: 0, c: 1 });
  assert.ok(!h1.who.c.includes("sam"));
  assert.equal(performance(hot, "jordan"), 0.5);
  assert.equal(performance(hot, "tyler"), 1);
  assert.equal(performance(hot, "sam"), null, "the subject isn't graded on themself");
});

// ---------- context ----------
test("context: only posts every member can see; never another chat's messages, drafts or system lines", () => {
  clean();
  const c = getConversation(VB)!;
  c.messages.push(
    { id: "m_t_draft", senderId: "devon", text: "a draft that was never sent to anyone", createdAt: iso(Date.now()), status: "draft" },
    { id: "m_t_system", senderId: "devon", text: "Today's game · Split: a system line", createdAt: iso(Date.now()), system: true, attachment: { type: "game", ref: "x" } },
    { id: "m_t_real", senderId: "devon", text: "who is bringing the net on sunday", createdAt: iso(Date.now()) },
  );
  const ctx = buildContext(VB);
  const posts = new Map(db().posts.map((p) => [p.id, p]));
  const seenPosts = ctx.evidence.filter((e) => e.kind === "post");
  assert.ok(seenPosts.length >= 10, "there is real material");
  for (const e of seenPosts) for (const m of c.participantIds) assert.ok(canSeePost(m, posts.get(e.id)!), `${m} can see ${e.id}`);
  const own = new Set(c.messages.map((m) => m.id));
  const msgs = ctx.evidence.filter((e) => e.kind === "message");
  assert.ok(msgs.length >= 10 && msgs.every((e) => own.has(e.id)), "every message comes from this chat");
  const elsewhere = new Set(db().conversations.filter((x) => x.id !== VB).flatMap((x) => x.messages.map((m) => m.id)));
  assert.ok(ctx.evidence.every((e) => !elsewhere.has(e.id)));
  assert.ok(ctx.byId.has("m_t_real"));
  assert.ok(!ctx.byId.has("m_t_draft") && !ctx.byId.has("m_t_system"));
  assert.ok(ctx.evidence.every((e) => !e.by || c.participantIds.includes(e.by)), "nothing by a non-member");
  assert.deepEqual(ctx.members.map((m) => m.id), c.participantIds);

  // A friends-only post is used in a chat of friends, and left out the moment one member can't see it.
  const devon = getUser("devon")!;
  const stranger = db().users.find((u) => u.id !== "devon" && !devon.friendIds.includes(u.id) && !u.friendIds.includes("devon"))!;
  const friend = devon.friendIds[0];
  const priv = createPost("devon", { text: "friends only: I am thinking about leaving nights for good", audience: "friends" });
  const pub = createPost("devon", { text: "public: sunday volleyball is on, bring water", audience: "public" });
  const withStranger = buildContext(chat("c_t_stranger", ["devon", stranger.id]).id);
  assert.ok(withStranger.byId.has(pub.id));
  assert.ok(!withStranger.byId.has(priv.id), "the stranger can't see it, so the game can't use it");
  assert.ok(buildContext(chat("c_t_friend", ["devon", friend]).id).byId.has(priv.id));
  // Stated interests are profile content: used only when every other member can see that profile.
  assert.ok(ctx.evidence.some((e) => e.kind === "interest"), "a chat of friends uses them");
  db().users.push({ ...getUser("omar")!, id: "u_unconnected", friendIds: [], privacy: "public" });
  for (const other of ["aisha", "u_unconnected"]) { // aisha: restricted profile, not a friend; u_unconnected: public but no connection to Jordan
    const dm = buildContext(chat(`c_t_${other}`, ["jordan", other]).id);
    assert.ok(!dm.evidence.some((e) => e.id.startsWith(`int:${other}:`)), `${other}'s interests are not Jordan's to see`);
  }
  assert.ok(buildContext("c_maya_jordan").evidence.some((e) => e.id.startsWith("int:jordan:")) && buildContext("c_maya_jordan").evidence.some((e) => e.id.startsWith("int:maya:")));
  // Inventory is real, upcoming, and never a private group's.
  for (const i of ctx.inventory) {
    assert.ok(i.topics.length > 0);
    if (i.kind === "event") assert.ok(new Date(getEvent(i.id)!.startsAt).getTime() > Date.now(), `${i.id} is upcoming`);
    if (i.kind === "group") assert.ok(getGroup(i.id)!.privacy === "public" || c.participantIds.every((m) => getGroup(i.id)!.memberIds.includes(m)));
  }
});

test("quoteIn accepts lines that are really there and rejects invented ones", () => {
  const src = "I'll run a 5 min warmup. not a workout";
  assert.ok(quoteIn("I'll run a 5 min warmup. not a workout", src));
  assert.ok(quoteIn("i'll run a 5 MIN warmup", src), "case and punctuation don't matter");
  assert.ok(quoteIn("run a 5 min warmup, not a real workout", src), "5 of 6 words is close enough");
  assert.ok(!quoteIn("I'll run a 45 minute bootcamp for everyone", src));
  assert.ok(!quoteIn("marcus hates warmups", src));
  assert.ok(!quoteIn("", src) && !quoteIn("...", src));
  assert.ok(!quoteIn("warmup workout", src), "two matching words out of order are not a quote");
  assert.ok(!quoteIn(src, "there was no wind"));
});

// ---------- select ----------
test("select: Lineup and Hot Seat need three people; Receipts needs quotable lines from two members", () => {
  clean();
  const group = buildContext(VB);
  const dm = buildContext("c_maya_jordan");
  assert.equal(dm.members.length, 2);
  for (const f of ["lineup", "hotseat"] as Format[]) {
    assert.equal(feasible(f, dm, "food", ["food"]), false, `${f} in a DM`);
    assert.equal(feasible(f, group, "food", ["food"]), true, `${f} in a group`);
  }
  assert.equal(feasible("split", dm, "food", ["food"]), true);
  assert.equal(feasible("blend", dm, "food", ["food"]), true);
  assert.equal(feasible("receipts", group, "food", ["food"]), true);
  assert.equal(feasible("receipts", { ...group, evidence: [] }, "food", ["food"]), false);
  assert.equal(feasible("receipts", { ...group, evidence: group.evidence.filter((e) => e.by === "devon") }, "food", ["food"]), false, "one voice is not a guessing game");
  assert.equal(feasible("receipts", { ...group, evidence: group.evidence.filter((e) => e.kind === "interest") }, "food", ["food"]), false);
  assert.equal(feasible("wager", group, "food", ["food"]), true);
  assert.equal(feasible("wager", { ...group, inventory: [] }, "food", ["food"]), false);
  for (let i = 0; i < 3; i++) { // a DM is never handed a 3+ format, whatever the rotation says
    const pick = selectGame(dm);
    assert.ok(!["lineup", "hotseat"].includes(pick.format), pick.format);
    game(dm.conversationId, pick.format, pick.topic, [round("r1", "pick", [opt("a", pick.topic)])], 3 - i);
  }
  const forced = selectGame(group, { format: "hotseat", topic: "music" });
  assert.deepEqual([forced.format, forced.topic], ["hotseat", "music"]);
  assert.ok(forced.subjectId && group.members.some((m) => m.id === forced.subjectId));
});

test("select: a topic is not repeated within two games, and formats rotate", () => {
  clean();
  const ctx = buildContext(VB);
  const picks: { topic: TopicId; format: Format }[] = [];
  for (let i = 0; i < 5; i++) {
    const s = selectGame(ctx);
    assert.ok(isTopic(s.topic));
    assert.ok(!picks.slice(-2).some((p) => p.topic === s.topic), `game ${i}: ${s.topic} after ${picks.slice(-2).map((p) => p.topic)}`);
    if (picks.length) assert.notEqual(s.format, picks.at(-1)!.format);
    picks.push({ topic: s.topic, format: s.format });
    game(VB, s.format, s.topic, [round("r1", "pick", [opt("a", s.topic)])], 5 - i); // unplayed: nothing becomes confident
  }
  assert.equal(picks[0].format, "split", "a new chat starts at the top of the rotation");
});

test("select: once a settled topic leads, the next game is a Wager on it with three real things", () => {
  clean();
  const ctx = buildContext(VB);
  for (const d of [2, 1]) {
    const g = game(VB, "split", "sports", [round("r1", "split", [opt("a", "sports"), opt("b", "sports")]), round("r2", "split", [opt("a", "sports"), opt("b", "sports")])], d);
    for (const u of CREW) play(g, u, { r1: { pick: "a", predict: "a" }, r2: { pick: "b", predict: "b" } }, { react: true });
  }
  const leader = chatTopics(VB)[0];
  assert.equal(leader.topic, "sports");
  assert.ok(confident(leader, 8));
  const s = selectGame(ctx);
  assert.deepEqual([s.format, s.topic], ["wager", "sports"]);
  assert.equal(s.items.length, 3);
  assert.ok(s.items[0].topics.includes("sports"), "on-topic inventory first");
  assert.ok(s.items.every((i) => ctx.inventory.includes(i)), "only real inventory");
  assert.ok(new Set(s.items.map((i) => i.kind)).size >= 2, "one kind never takes all three slots");
  // Having just wagered, the chat is not asked to wager again.
  game(VB, "wager", "sports", [round("r1", "points", s.items.map((i, k) => opt(`o${k}`, "sports")))], 0);
  const next = selectGame(ctx);
  assert.notEqual(next.format, "wager");
  assert.notEqual(next.topic, "sports");
});

// ---------- the seed ----------
test("resetPlayStore: empty on request, otherwise re-seeded on the next read; no seeded game is dated today", () => {
  resetDb();
  resetPlayStore({ seed: false });
  assert.equal(playStore().games.size, 0);
  assert.equal(playStore().events.length, 0);
  resetPlayStore();
  const s = playStore();
  assert.equal(s.games.size, seedGames.length);
  assert.equal(playStore(), s, "seeded once");
  assert.equal(gamesIn(VB).length, 9);
  assert.equal(gamesIn("c_maya_jordan").length, 6);
  const today = dayKey();
  for (const g of s.games.values()) {
    assert.ok(g.date < today, `${g.id} dated ${g.date}`);
    assert.equal(g.createdAt.slice(0, 10), g.date);
    assert.equal(g.mode, "seed");
    assert.equal(g.costUsd, 0);
  }
  assert.ok(s.events.every((e) => e.at.slice(0, 10) < today), "no seeded play event today");
  assert.ok(seedGames.every((g) => g.day >= 1));
  assert.ok(gamesIn(VB).filter((g) => g.format === "wager").length <= 1);
  assert.ok(new Set(gamesIn(VB).map((g) => g.format)).size >= 5, "formats are mixed");
});

test("seeded games are well-formed and cite only what their own chat can see", () => {
  resetDb();
  resetPlayStore();
  for (const g of playStore().games.values()) {
    const c = getConversation(g.conversationId)!;
    const ctx = buildContext(g.conversationId);
    const known = new Set([...ctx.byId.keys(), ...ctx.inventory.map((i) => i.id)]);
    assert.ok(g.evidence.length >= 2, `${g.id} cites real material`);
    for (const e of g.evidence) assert.ok(known.has(e.id), `${g.id} cites ${e.id}, which this chat can't see`);
    if (g.subjectId) assert.ok(c.participantIds.includes(g.subjectId));
    for (const r of g.rounds) {
      assert.ok(r.evidenceIds.length >= 1 && r.evidenceIds.every((id) => known.has(id)), `${g.id}/${r.id} evidence`);
      const ids = r.options.map((o) => o.id);
      assert.equal(new Set(ids).size, ids.length);
      for (const o of r.options) {
        if (o.topic) assert.ok(isTopic(o.topic), `${g.id}/${r.id}/${o.id} topic`);
        if (o.userId) assert.ok(c.participantIds.includes(o.userId), `${o.userId} is in the chat`);
        if (o.ref) assert.ok(ctx.inventory.some((i) => i.kind === o.ref!.kind && i.id === o.ref!.id), `${o.ref.id} is real and visible`);
      }
      if (r.answer !== undefined) assert.ok(ids.includes(r.answer));
      if (r.quote) { // Receipts: the line is really there, and really by the member marked as the answer
        const src = g.evidence.filter((e) => r.evidenceIds.includes(e.id));
        assert.ok(src.some((e) => quoteIn(r.quote!, e.text) && e.by === r.options.find((o) => o.id === r.answer)?.userId), `${g.id}/${r.id} quote`);
      }
    }
    for (const [userId, mine] of playStore().answers.get(g.id) ?? []) {
      assert.ok(c.participantIds.includes(userId));
      for (const [roundId, choice] of Object.entries(mine)) {
        const r = g.rounds.find((x) => x.id === roundId)!;
        const ids = r.options.map((o) => o.id);
        if (r.kind === "split") { const s = choice as { pick: string; predict: string }; assert.ok(ids.includes(s.pick) && ids.includes(s.predict)); }
        else if (r.kind === "pick") assert.ok(ids.includes(choice as string), `${g.id}/${roundId}/${userId}`);
        else if (r.kind === "rank") assert.deepEqual([...(choice as string[])].sort(), [...ids].sort(), `${g.id}/${roundId}/${userId} is a permutation`);
        else { const pts = choice as Record<string, number>; assert.ok(Object.keys(pts).every((k) => ids.includes(k)) && Object.values(pts).every((v) => Number.isInteger(v) && v >= 0)); assert.equal(Object.values(pts).reduce((a, b) => a + b, 0), 10); }
      }
    }
  }
});

test("the seeded volleyball chat sits just under the Event unlock: 50..58, group earned, event not yet", () => {
  resetDb();
  resetPlayStore();
  const s = chatScore(VB);
  assert.ok(s.score >= 50 && s.score <= 58, `score ${s.score}`);
  assert.ok(s.streakDays >= 4 && s.streakDays <= 5, `streak ${s.streakDays}`);
  assert.equal(s.games, 9);
  assert.ok(s.parts.participation >= 0.55 && s.parts.participation <= 0.75);
  assert.ok(s.parts.reciprocity > 0, "some reactions");
  assert.deepEqual(s.earned, ["group"]);
  assert.deepEqual(s.next, { tier: "event", at: 60 });
  const top = s.topics[0];
  assert.ok(["sports", "food", "music"].includes(top.topic), `top topic ${top.topic}`);
  assert.ok(confident(top, 8), "the top topic is settled");
  assert.ok(top.score - s.topics[1].score > 0.1, "and clearly ahead");

  const unlocks = unlocksIn(VB);
  assert.deepEqual(unlocks.map((u) => u.tier), ["group"]);
  const grp = getGroup(unlocks[0].refId)!;
  assert.equal(grp.privacy, "public");
  assert.equal(unlocks[0].title, grp.name);
  assert.ok(isTopic(unlocks[0].topic) && topicsOfGroup(grp).includes(unlocks[0].topic));
  const allowed = new Set(unlocks[0].facts.join(" ").match(/\d+/g));
  for (const num of unlocks[0].why.match(/\d+/g) ?? []) assert.ok(allowed.has(num), `the why line's ${num} is in the counted facts`);
  const card = getConversation(VB)!.messages.find((m) => m.id === unlocks[0].messageId);
  assert.deepEqual(card?.attachment, { type: "unlock", ref: unlocks[0].id });
  assert.ok(card?.system);
  assert.equal(unlocksIn("c_maya_jordan").length, 0);

  // Today's game, finished by five of eight with one reaction, takes the chat over 60.
  const today = game(VB, "split", "sports", [round("r1", "split", [opt("a", "sports"), opt("b", "food")])]);
  CREW.slice(0, 5).forEach((u, i) => play(today, u, { r1: { pick: "a", predict: "a" } }, { react: i === 0 }));
  const after = chatScore(VB);
  assert.ok(after.score >= 60, `after today ${after.score}`);
  assert.equal(after.streakDays, s.streakDays + 1);
  assert.ok(after.earned.includes("event") && !after.earned.includes("listing"));
});

// ---------- generation: code decides what a draft may put on screen ----------
const MJ = "c_maya_jordan";
const status = (n: number) => (e: unknown) => (e as { status?: number }).status === n;
/** A draft round that passes for this format, to put a bad one next to. */
const sel = (conversationId: ID, format: Format, topic: TopicId = "food") => { const ctx = buildContext(conversationId); return { ctx, s: selectGame(ctx, { format, topic }) }; };

test("validateDraft: evidence ids must be in THIS chat's index (invented ids and another chat's lines are refused)", () => {
  clean();
  const { ctx, s } = sel(VB, "split");
  const real = ctx.evidence.find((e) => e.kind === "message")!;
  const foreign = getConversation(MJ)!.messages.find((m) => !getConversation(VB)!.messages.some((x) => x.id === m.id))!;
  const two = [{ label: "Tacos first", topic: "food" }, { label: "Courts first", topic: "sports" }];
  const draft: Draft = { title: "Tacos or courts", premise: "Pick a side.", rounds: [
    { prompt: "Real line, real round?", options: two, evidenceIds: [real.id] },
    { prompt: "Made-up source?", options: two, evidenceIds: ["m_does_not_exist"] },
    { prompt: "Someone else's chat?", options: two, evidenceIds: [foreign.id] },
    { prompt: "Half real?", options: two, evidenceIds: [real.id, "p_invented"] },
  ] };
  const v = validateDraft(s, draft, ctx);
  assert.deepEqual(v.rounds.map((r) => r.prompt), ["Real line, real round?", "Half real?"]);
  assert.deepEqual(v.rounds[1].evidenceIds, [real.id], "the invented id is stripped, the real one kept");
  assert.ok(v.dropped.some((d) => d.includes("m_does_not_exist") && d.includes("not in this chat's index")));
  assert.ok(v.dropped.some((d) => d.includes(foreign.id)), "a line from another chat is not evidence here");
  assert.ok(v.evidence.every((e) => ctx.byId.has(e.id)));
  // an option topic outside the taxonomy falls back to the game's topic
  const odd = validateDraft(s, { title: "t", premise: "p", rounds: [{ prompt: "Which?", options: [{ label: "A", topic: "astrology" }, { label: "B", topic: "food" }], evidenceIds: [real.id] }] }, ctx);
  assert.deepEqual(odd.rounds[0].options.map((o) => o.topic), [s.topic, "food"]);
  assert.ok(odd.dropped.some((d) => d.includes("astrology")));
});

test("validateDraft: Receipts quotes must be real, must not name their author, and code sets who said it", () => {
  clean();
  sendMessage(VB, "devon", "Devon here, bringing the net and the good ball on Sunday");
  const { ctx, s } = sel(VB, "receipts");
  const q = quotable(ctx);
  const named = q.find((e) => e.text.startsWith("Devon here"))!;
  const good = q.find((e) => e !== named && !new RegExp(`\\b${ctx.members.find((m) => m.id === e.by)!.first}\\b`, "i").test(e.text))!;
  const other = q.find((e) => e !== good && e !== named && e.by !== good.by)!;
  const interest = ctx.evidence.find((e) => e.kind === "interest")!;
  const v = validateDraft(s, { title: "Receipts", premise: "Who said it?", rounds: [
    { evidenceId: good.id, quote: good.text.slice(0, 120), prompt: "Who said this?" },
    { evidenceId: other.id, quote: "I have honestly never typed anything like this sentence before" },
    { evidenceId: named.id, quote: named.text },
    { evidenceId: good.id, quote: good.text.slice(0, 120) },
    { evidenceId: interest.id, quote: interest.text },
    { evidenceId: "m_nope", quote: "whatever was said here" },
  ] }, ctx);
  assert.equal(v.rounds.length, 1);
  const r = v.rounds[0];
  assert.ok(quoteIn(r.quote!, good.text) && r.quote!.length <= 140);
  assert.deepEqual(r.evidenceIds, [good.id]);
  assert.equal(r.options.find((o) => o.id === r.answer)?.userId, good.by, "the answer is the real author, set by code");
  assert.ok(r.options.length >= 2 && r.options.length <= 4 && r.options.every((o) => o.userId && getConversation(VB)!.participantIds.includes(o.userId)));
  assert.equal(new Set(r.options.map((o) => o.userId)).size, r.options.length);
  for (const why of ["the quote is not in the source line", "the quote names its author", "is already used in another round", "is not a quotable line", "is not in this chat's index"]) assert.ok(v.dropped.some((d) => d.includes(why)), `refused: ${why}`);
});

test("validateDraft: a Receipts quote on screen is the source's own text, never the model's string; title and premise can't name an author", () => {
  clean();
  const { ctx, s } = sel(VB, "receipts");
  const src = quotable(ctx).find((e) => e.by === "marcus" && e.text.startsWith("I'll run a 5 min warmup"))!;
  assert.equal(src.text, "I'll run a 5 min warmup. not a workout");
  const one = (quote: string) => validateDraft(s, { title: "Receipts", premise: "Who said it?", rounds: [{ evidenceId: src.id, quote }] }, ctx);
  // Each of these gets past the fuzzy "is it in the source" gate. None of the model's words may reach the bubble.
  for (const altered of ["I'll run a 5 min warmup. not a idiots", "I'll run a 5 min warmup. 你们都是白痴 🖕", "a not warmup. min 5 a run I'll", "I'll run a 5 min warmup. a workout"]) {
    const v = one(altered);
    for (const r of v.rounds) {
      assert.ok(src.text.includes(r.quote!), `"${altered}" was shown as "${r.quote}"`);
      assert.notEqual(r.quote, altered);
      assert.equal(r.options.find((o) => o.id === r.answer)?.userId, "marcus");
    }
    assert.ok(v.rounds.length === 1 || v.dropped.some((d) => d.includes("round 1 dropped")));
  }
  assert.equal(one("i'll RUN a 5 min warmup").rounds[0].quote, "I'll run a 5 min warmup", "a real span is shown in the source's own characters");
  assert.equal(one(src.text).rounds[0].quote, src.text);

  const named = validateDraft(s, { title: "Marcus said WHAT?", premise: "Every line today is Marcus's. Easy one.", rounds: [{ evidenceId: src.id, quote: src.text }] }, ctx);
  assert.equal(named.rounds.length, 1);
  assert.ok(!/marcus/i.test(named.title) && !/marcus/i.test(named.premise), `${named.title} / ${named.premise}`);
  assert.ok(named.dropped.includes("title: names the author of a quoted line") && named.dropped.includes("premise: names the author of a quoted line"));
  const fine = validateDraft(s, { title: "Warmup receipts", premise: "Who said these?", rounds: [{ evidenceId: src.id, quote: src.text }] }, ctx);
  assert.deepEqual([fine.title, fine.premise], ["Warmup receipts", "Who said these?"]);
});

test("validateDraft: Lineup prompts must be positive; BANNED words and over-long copy never reach the screen", () => {
  clean();
  const lineup = sel(VB, "lineup", "sports");
  const split0 = sel(VB, "split");
  const v = validateDraft(lineup.s, { title: "The lineup", premise: "Rank the chat.", rounds: [{ prompt: "Who is the worst at showing up on time?" }, { prompt: "Who is first on the court every Sunday?" }, { prompt: "Who is the laziest one here?" }] }, lineup.ctx);
  assert.deepEqual(v.rounds.map((r) => r.prompt), ["Who is first on the court every Sunday?"]);
  assert.equal(v.dropped.filter((d) => d.includes("must be positive")).length, 2);
  const r = v.rounds[0];
  assert.equal(r.kind, "rank");
  assert.equal(r.options.length, 5);
  assert.ok(r.options.every((o) => o.userId && CREW.includes(o.userId)) && new Set(r.options.map((o) => o.userId)).size === 5);
  assert.equal(r.answer, undefined);
  // Negative rankings that don't use an obvious insult, and a title / premise that would turn a fine prompt into one.
  const sly = ["Who is most likely to show up late and hungover?", "Who would get dumped first?", "Who is the most unreliable about showing up?", "Who is the messiest roommate?", "Who loses every argument?", "Who peaked in high school?", "Rank the chat from hottest to not"];
  const s2 = validateDraft(lineup.s, { title: "The lineup", premise: "Rank the chat.", rounds: [...sly.map((prompt) => ({ prompt })), { prompt: "Who folds the most dumplings on Sunday?" }] }, lineup.ctx);
  assert.deepEqual(s2.rounds.map((x) => x.prompt), ["Who folds the most dumplings on Sunday?"]);
  assert.equal(s2.dropped.filter((d) => d.includes("must be positive")).length, sly.length);
  const framed = validateDraft(lineup.s, { title: "The laziest lineup", premise: "Rank everyone from most useless to least useless on the court.", rounds: [{ prompt: "Who is first on the court every Sunday?" }] }, lineup.ctx);
  assert.equal(framed.rounds.length, 1);
  assert.ok(!/laz|useless/i.test(framed.title + framed.premise), "code's own copy stands in");
  assert.ok(framed.dropped.some((d) => d.startsWith("title: Lineup copy must be positive")) && framed.dropped.some((d) => d.startsWith("premise: Lineup copy must be positive")));
  assert.equal(validateDraft(split0.s, { title: "The laziest split", premise: "Pick a side.", rounds: [] }, split0.ctx).title, "The laziest split", "only Lineup ranks people");

  const split = sel(VB, "split");
  const ev = split.ctx.evidence.find((e) => e.kind === "message")!.id;
  const two = [{ label: "Tacos", topic: "food" }, { label: "Courts", topic: "sports" }];
  const b = validateDraft(split.s, { title: "We miss you, tacos", premise: "x".repeat(141), rounds: [
    { prompt: "Feeling lonely without birria?", options: two, evidenceIds: [ev] },
    { prompt: "Which one?", options: [{ label: "Therapy tacos", topic: "food" }, { label: "Courts", topic: "sports" }], evidenceIds: [ev] },
    { prompt: "Fine round?", options: two, evidenceIds: [ev] },
  ] }, split.ctx);
  assert.deepEqual(b.rounds.map((x) => x.prompt), ["Fine round?"]);
  assert.ok(b.dropped.some((d) => d.startsWith("title: banned word")) && b.dropped.some((d) => d.startsWith("premise: over 140")));
  assert.ok(b.title && b.premise && !/miss you/i.test(b.title) && b.premise.length <= 140, "code's own copy stands in for refused copy");
  assert.ok(b.dropped.some((d) => d.includes('banned word "lonely"')) && b.dropped.some((d) => /banned word "Therapy"/i.test(d)));
});

test("validateDraft: Hot Seat cites only the subject and can't give the answer away; Wager shows only the items code chose", () => {
  clean();
  const hs = sel(VB, "hotseat");
  const subject = hs.s.subjectId!;
  const own = hs.ctx.evidence.find((e) => e.by === subject && e.kind !== "interest")!;
  const notOwn = hs.ctx.evidence.find((e) => e.by && e.by !== subject)!;
  const three = [{ label: "Birria" }, { label: "Ramen" }, { label: "Pizza" }];
  const h = validateDraft(hs.s, { title: "Hot Seat", premise: "How well do you know them?", rounds: [
    { prompt: "What do they order?", options: three, answerIndex: 0, evidenceIds: [own.id] },
    { prompt: "Do they order Birria or not?", options: three, answerIndex: 0, evidenceIds: [own.id] },
    { prompt: "What do they order after?", options: three, answerIndex: 1, evidenceIds: [notOwn.id] },
    { prompt: "And on Sundays?", options: three, answerIndex: 7, evidenceIds: [own.id] },
  ] }, hs.ctx);
  assert.equal(h.rounds.length, 1);
  assert.equal(h.rounds[0].options.find((o) => o.id === h.rounds[0].answer)?.label, "Birria");
  for (const why of ["gives away the answer", "is not by the subject", "answerIndex does not point at an option"]) assert.ok(h.dropped.some((d) => d.includes(why)), `refused: ${why}`);

  db().events.push({ ...db().events[0], id: "e_t_out_of_town", city: "houston" });
  const w = sel(VB, "wager");
  assert.equal(w.s.items.length, 3);
  const outOfTown = db().events.find((e) => e.city && e.city !== "austin")!;
  assert.ok(!w.ctx.inventory.some((i) => i.id === outOfTown.id), "inventory is the chat's own city only");
  const v = validateDraft(w.s, { title: "10 points", premise: "Spread them.", rounds: [{ prompt: "Where would we go?", options: [
    { refId: w.s.items[0].id, pitch: "Half of you are already going" },
    { refId: "e_made_up", pitch: "Sounds fun" },
    { refId: outOfTown.id, pitch: "Road trip" },
    { refId: w.s.items[1].id, pitch: "You should have gone last time" },
    { refId: w.s.items[2].id, pitch: "The one this chat keeps arguing about" },
  ] }] }, w.ctx);
  assert.equal(v.rounds.length, 1);
  assert.deepEqual(v.rounds[0].options.map((o) => o.ref?.id), w.s.items.map((i) => i.id), "exactly the items code supplied, in code's order");
  assert.deepEqual(v.rounds[0].options.map((o) => o.sub), w.s.items.map((i) => i.sub), "the date / price line is the item's own, with nothing appended");
  assert.equal(v.rounds[0].options[0].pitch, undefined, "a head-count the model wrote is not shown");
  assert.ok(v.dropped.some((d) => d.includes(`wager pitch for ${w.s.items[0].id}`) && d.includes("head-count")));
  assert.equal(v.rounds[0].options[1].pitch, undefined, "a banned pitch is dropped, the item stays");
  assert.equal(v.rounds[0].options[2].pitch, "The one this chat keeps arguing about", "colour is kept, on its own line");
  // Invented prices, times and counts never sit next to the real ones.
  for (const pitch of ["Free tonight, 7 of you already going, moved to 9pm", "Only $5 at the door", "Doors at 9pm", "Moved to Saturday", "Everyone is in", "Tickets are 40 now"]) {
    const bad = validateDraft(w.s, { title: "t", premise: "p", rounds: [{ options: w.s.items.map((i) => ({ refId: i.id, pitch })) }] }, w.ctx);
    assert.ok(bad.rounds[0].options.every((o, k) => o.pitch === undefined && o.sub === w.s.items[k].sub), pitch);
    assert.equal(bad.dropped.filter((d) => d.startsWith("wager pitch for")).length, 3, pitch);
  }
  // Code's own pitch (counted from the store) passes as is, and never says who saved a listing.
  const tpl = validateDraft(w.s, mockDraft(w.s, w.ctx), w.ctx);
  assert.ok(tpl.rounds[0].options.some((o) => /of you already (going|in)|New to all 8 of you|is already (going|in)/.test(o.pitch ?? "")));
  assert.ok(!tpl.dropped.some((d) => d.startsWith("wager pitch")));
  assert.ok(v.dropped.some((d) => d.includes("e_made_up") && d.includes("not one of the items code supplied")));
  assert.ok(v.dropped.some((d) => d.includes(outOfTown.id)));
  assert.equal(v.rounds[0].kind, "points");
});

test("mockDraft passes validateDraft: all six formats in the group chat, the four DM formats in a DM", () => {
  resetDb();
  resetPlayStore();
  const check = (conversationId: ID, format: Format) => {
    const ctx = buildContext(conversationId);
    const s = selectGame(ctx, { format });
    assert.equal(s.format, format);
    const v = validateDraft(s, mockDraft(s, ctx), ctx);
    const what = `${conversationId} ${format}`;
    assert.ok(v.rounds.length >= MIN_ROUNDS[format], `${what}: ${v.rounds.length} rounds; ${v.dropped.join(" | ")}`);
    assert.ok(v.title.length > 0 && v.title.length <= 60 && v.premise.length <= 140, what);
    const members = getConversation(conversationId)!.participantIds;
    const known = new Set([...ctx.byId.keys(), ...ctx.inventory.map((i) => i.id)]);
    for (const r of v.rounds) {
      assert.ok(r.evidenceIds.every((id) => known.has(id)), `${what}/${r.id} cites only this chat's material`);
      if (format !== "lineup") assert.ok(r.evidenceIds.length >= 1, `${what}/${r.id} cites something`);
      assert.equal(new Set(r.options.map((o) => o.id)).size, r.options.length);
      for (const o of r.options) { if (o.topic) assert.ok(isTopic(o.topic)); if (o.userId) assert.ok(members.includes(o.userId)); }
      if (format === "receipts") { const src = ctx.byId.get(r.evidenceIds[0])!; assert.ok(quoteIn(r.quote!, src.text)); assert.equal(r.options.find((o) => o.id === r.answer)?.userId, src.by); }
      if (format === "hotseat") { assert.ok(r.options.some((o) => o.id === r.answer)); assert.ok(r.evidenceIds.every((id) => ctx.byId.get(id)?.by === s.subjectId)); }
      if (format === "wager") assert.deepEqual(r.options.map((o) => o.ref?.id), s.items.map((i) => i.id));
    }
    return v;
  };
  for (const f of FORMATS) check(VB, f);
  for (const f of ["split", "blend", "receipts", "wager"] as Format[]) check(MJ, f);
  // A DM can't support Lineup or Hot Seat: nothing passes, so nothing would be shown as that format.
  for (const f of ["lineup", "hotseat"] as Format[]) { const ctx = buildContext(MJ); const s = selectGame(ctx, { format: f }); assert.equal(validateDraft(s, mockDraft(s, ctx), ctx).rounds.length, 0, `DM ${f}`); }
});

test("generateGame: a forced format the chat can't support comes back as a Split, labelled as a fallback; nothing is saved", async () => {
  resetDb();
  resetPlayStore();
  const before = playStore().games.size;
  const g = await generateGame(MJ, { format: "lineup" });
  assert.equal(g.format, "split");
  assert.ok(g.rounds.length >= MIN_ROUNDS.split);
  assert.match(g.mode, /fallback/);
  assert.ok(g.dropped.some((d) => d.includes("switched to Split")));
  assert.equal(g.costUsd, 0);
  assert.equal(g.date, dayKey());
  assert.ok(g.why, "the selection reason is kept for the inspector");
  assert.equal(playStore().games.size, before, "generateGame does not save");
});

// ---------- the daily drop ----------
const gameCards = (conversationId: ID) => getConversation(conversationId)!.messages.filter((m) => m.attachment?.type === "game");

test("ensureDaily: one game per chat per day, concurrent opens share one generation, one card in the thread", async () => {
  resetDb();
  resetPlayStore();
  assert.equal(await ensureDaily(VB, "maya"), null, "not in the chat: nothing, and nothing is generated");
  assert.equal(await ensureDaily("c_nope", "devon"), null);
  assert.equal(gamesIn(VB).length, 9);

  const [a, b, c] = await Promise.all([ensureDaily(VB, "devon"), ensureDaily(VB, "sam"), ensureDaily(VB, "nina")]);
  assert.ok(a && b && c);
  assert.equal(a.id, b.id);
  assert.equal(a.id, c.id);
  assert.equal(gamesIn(VB).length, 10);
  assert.equal(playStore().byDay.get(`${VB}|${dayKey()}`), a.id);
  assert.equal(playStore().pending.size, 0);
  assert.equal(a.date, dayKey());
  assert.deepEqual([a.format, a.topic], ["wager", "food"], "the seeded chat's leader is food, so today is a Wager on it");
  assert.ok(a.rounds.length >= MIN_ROUNDS[a.format]);

  const cards = gameCards(VB);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, a.messageId);
  assert.deepEqual(cards[0].attachment, { type: "game", ref: a.id });
  assert.ok(cards[0].system && cards[0].text.startsWith("Today's game · Wager: "));
  assert.equal(cards[0].senderId, getConversation(VB)!.participantIds[0], "posted by the chat, not by whoever opened it");

  const again = await ensureDaily(VB, "tyler");
  assert.equal(again?.id, a.id);
  assert.equal(gameCards(VB).length, 1);
  assert.equal(gamesIn(VB).length, 10);

  // A muted chat gets nothing; another chat's day is its own.
  setMuted(MJ, "maya", true);
  assert.equal(await ensureDaily(MJ, "maya"), null);
  assert.equal(gameCards(MJ).length, 0);
  setMuted(MJ, "jordan", false);
  const dm = await ensureDaily(MJ, "jordan");
  assert.ok(dm && dm.id !== a.id && dm.conversationId === MJ);
  const vbIds = new Set(buildContext(VB).evidence.filter((e) => e.kind === "message").map((e) => e.id));
  assert.ok(dm.evidence.every((e) => e.kind !== "message" || !vbIds.has(e.id)), "nothing from the group chat appears in the DM's game");
});

// ---------- playing ----------
/** One game with every round kind, in a fresh four-person chat. */
function fourKinds() {
  clean();
  chat("c_t", ["devon", "sam", "tyler", "grace"]);
  return game("c_t", "blend", "food", [
    round("r1", "pick", [opt("a", "food"), opt("b", "music"), opt("c", "sports")], "b"),
    round("r2", "split", [opt("a", "food"), opt("b", "music")]),
    round("r3", "rank", [opt("a"), opt("b"), opt("c")]),
    round("r4", "points", [opt("a", "food"), opt("b", "music"), opt("c", "sports")]),
  ]);
}

test("act: every choice is checked against its round", async () => {
  const g = fourKinds();
  const bad = (roundId: string, choice: unknown) => assert.rejects(act(g.id, "devon", { action: "answer", roundId, choice: choice as Choice }), status(400), `${roundId} ${JSON.stringify(choice)}`);
  await bad("r1", "z");
  await bad("r1", { pick: "a", predict: "a" });
  await bad("r9", "a");
  await bad("r2", "a");
  await bad("r2", { pick: "a" });
  await bad("r2", { pick: "a", predict: "z" });
  await bad("r3", ["a", "b"]);
  await bad("r3", ["a", "b", "b"]);
  await bad("r3", ["a", "b", "z"]);
  await bad("r3", ["a", "b", "c", "a"]);
  await bad("r4", { a: 5, b: 4 });
  await bad("r4", { a: 6, b: 5 });
  await bad("r4", { a: 11, b: -1 });
  await bad("r4", { a: 9.5, b: 0.5 });
  await bad("r4", { a: 5, z: 5 });
  await bad("r4", [5, 5]);
  await assert.rejects(act(g.id, "devon", { action: "nope" as "open" }), status(400));
  await assert.rejects(act("pg_nope", "devon", { action: "open" }), status(404));
  await assert.rejects(act(g.id, "maya", { action: "open" }), status(404), "not in the chat");
  assert.equal(playStore().events.length, 0, "nothing bad is logged");
  assert.equal(playStore().answers.get(g.id), undefined);
  // what a good choice is stored as: rebuilt from known keys only
  assert.deepEqual(checkChoice(g.rounds[1], { pick: "a", predict: "b", extra: 1 }), { pick: "a", predict: "b" });
  assert.deepEqual(checkChoice(g.rounds[3], { a: 10 }), { a: 10 });
});

test("act: answer vs change, skip, complete, react; nothing changes after finishing", async () => {
  const g = fourKinds();
  const kinds = () => playStore().events.filter((e) => e.userId === "devon").map((e) => e.kind);
  await act(g.id, "devon", { action: "open" });
  await act(g.id, "devon", { action: "open" });
  assert.deepEqual(kinds(), ["open"], "open is logged once");
  await assert.rejects(act(g.id, "devon", { action: "complete" }), status(400), "nothing answered yet");
  await assert.rejects(act(g.id, "devon", { action: "react", emoji: "🔥" }), status(409), "results first");

  await act(g.id, "devon", { action: "answer", roundId: "r1", choice: "a", ms: 4200 });
  const changed = await act(g.id, "devon", { action: "answer", roundId: "r1", choice: "c", ms: 900 });
  assert.deepEqual(kinds(), ["open", "answer", "change"]);
  assert.deepEqual(changed.game.mine, { r1: "c" });
  const [first, second] = playStore().events.filter((e) => e.roundId === "r1");
  assert.deepEqual([first.choice, first.topic, first.ms], ["a", "food", 4200]);
  assert.deepEqual([second.choice, second.topic, second.ms], ["c", "sports", 900]);
  await act(g.id, "devon", { action: "skip", roundId: "r2" });
  await act(g.id, "devon", { action: "answer", roundId: "r3", choice: ["c", "a", "b"] });
  await act(g.id, "devon", { action: "answer", roundId: "r4", choice: { a: 7, b: 3, c: 0 } });
  assert.deepEqual(kinds(), ["open", "answer", "change", "skip", "answer", "answer"]);

  const done = await act(g.id, "devon", { action: "complete" });
  assert.ok(done.game.done);
  assert.equal(done.unlock, undefined, "a chat that has earned nothing unlocks nothing");
  await act(g.id, "devon", { action: "complete" });
  assert.equal(kinds().filter((k) => k === "complete").length, 1, "complete is idempotent");
  await assert.rejects(act(g.id, "devon", { action: "answer", roundId: "r1", choice: "a" }), status(409));
  await assert.rejects(act(g.id, "devon", { action: "skip", roundId: "r2" }), status(409));
  await assert.rejects(act(g.id, "devon", { action: "react", emoji: "" }), status(400));
  const reacted = await act(g.id, "devon", { action: "react", emoji: "🔥" });
  assert.equal(reacted.game.reacted, "🔥");
  assert.ok(engagement(g, "devon").social);
  assert.deepEqual(playStore().answers.get(g.id)?.get("devon"), { r1: "c", r3: ["c", "a", "b"], r4: { a: 7, b: 3, c: 0 } });
});

// ---------- what a viewer may see ----------
/** Every key anywhere in a JSON value. */
function keysOf(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => keysOf(x, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.add(k); keysOf(x, out); }
  return out;
}

test("viewGame: answers, sources and everyone else's answers stay hidden until the viewer has finished; 404 outside the chat", async () => {
  const g = fourKinds();
  g.evidence = [{ id: "int:sam:0", kind: "interest", by: "sam", text: "birria", topics: ["food"] }];
  g.rounds[0].evidenceIds = ["int:sam:0"];
  await act(g.id, "sam", { action: "answer", roundId: "r1", choice: "b" });
  await act(g.id, "sam", { action: "complete" });
  await act(g.id, "devon", { action: "answer", roundId: "r1", choice: "a" });

  const before = viewGame(g, "devon");
  assert.equal(before.done, false);
  assert.ok(before.rounds.every((r) => !("answer" in r)), "no answer key at all");
  assert.ok(before.rounds.every((r) => r.evidenceIds.length === 0), "source ids would name the author");
  assert.equal(before.results, undefined);
  assert.equal(before.madeFrom, undefined);
  assert.equal(before.performance, undefined);
  assert.deepEqual(before.mine, { r1: "a" });
  assert.deepEqual(before.players.map((p) => p.id), ["sam"], "who has played is visible, what they answered is not");
  assert.ok(!JSON.stringify(before).includes("int:sam:0"));
  assert.equal(g.rounds[0].answer, "b", "the stored game is untouched");

  const after = (await act(g.id, "devon", { action: "complete" })).game;
  assert.ok(after.done);
  assert.equal(after.rounds[0].answer, "b");
  assert.deepEqual(after.rounds[0].evidenceIds, ["int:sam:0"]);
  assert.equal(after.results?.length, 4);
  assert.deepEqual(after.results?.[0].who, { a: ["devon"], b: ["sam"], c: [] });
  assert.equal(after.performance, 0);
  assert.deepEqual(after.madeFrom, [{ id: "int:sam:0", kind: "interest", by: "Sam", text: "birria" }]);
  assert.equal(after.memberCount, 4);

  assert.throws(() => viewGame(g, "maya"), status(404));
  assert.throws(() => chatView("c_t", "maya"), status(404));
  assert.throws(() => setMuted("c_t", "maya", true), status(404));
  // Hot Seat: the subject sees it as the subject, and the answer becomes theirs once they play.
  const hs = game("c_t", "hotseat", "food", [round("r1", "pick", [opt("a"), opt("b")], "a")], 0, { subjectId: "grace" });
  assert.ok(viewGame(hs, "grace").iAmSubject && !viewGame(hs, "sam").iAmSubject);
  assert.equal(viewGame(hs, "sam").subject?.id, "grace");
});

test("privacy: a viewer gets the chat's totals and their own topic numbers, never another member's", async () => {
  resetDb();
  resetPlayStore();
  const today = (await ensureDaily(VB, "devon"))!;
  const pts = Object.fromEntries(today.rounds[0].options.map((o, i) => [o.id, i === 0 ? 10 : 0]));
  for (const u of ["devon", "sam"]) { await act(today.id, u, { action: "answer", roundId: today.rounds[0].id, choice: pts }); await act(today.id, u, { action: "complete" }); }
  const devon = chatView(VB, "devon"), sam = chatView(VB, "sam");
  assert.deepEqual(Object.keys(devon).sort(), ["conversationId", "games", "muted", "myTopics", "next", "parts", "score", "streak", "streakDays", "thresholds", "todayGameId", "topics", "unlocks"]);
  assert.deepEqual(devon.streak, sam.streak, "the streak is a chat total, the same for everyone");
  for (const id of CREW) assert.ok(!JSON.stringify(devon.streak).includes(`"${id}"`), "and names nobody");
  assert.deepEqual(devon.topics, sam.topics, "chat totals are the same for everyone");
  assert.equal(devon.score, sam.score);
  assert.notDeepEqual(devon.myTopics, sam.myTopics);
  const own = (u: ID) => { const a = affinityFor(u).score; return Object.entries(a).filter(([, v]) => Math.round(v * 100) / 100 > 0).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([t, v]) => [t, Math.round(v * 100) / 100]); };
  assert.deepEqual(devon.myTopics.map((t) => [t.topic, t.score]).sort(), own("devon").sort(), "myTopics is the viewer's own affinity");
  assert.deepEqual(sam.myTopics.map((t) => [t.topic, t.score]).sort(), own("sam").sort());
  assert.equal(devon.todayGameId, today.id);

  // No per-member score of any kind in anything a product screen receives.
  const views: unknown[] = [devon, sam, viewGame(today, "devon"), viewGame(today, "nina"), ...unlocksIn(VB).map((u) => viewUnlock(u, "devon")), ...gamesIn(VB).map((g) => viewGame(g, "devon"))];
  const banned = ["affinity", "engagement", "observations", "raw", "answers", "facts", "dropped", "evidence", "why_", "costUsd", "responses"];
  for (const v of views) for (const k of keysOf(v)) assert.ok(!banned.includes(k), `key "${k}" must not be in a viewer's response`);
  // Nina hasn't played today's game: she sees who finished, not what they wagered.
  const nina = viewGame(today, "nina");
  assert.equal(nina.results, undefined);
  assert.deepEqual(nina.mine, {});
  assert.deepEqual(nina.players.map((p) => p.id).sort(), ["devon", "sam"]);
  // fitFor is the caller's own affinity only.
  assert.deepEqual(fitFor("devon", ["food"]).topic, "food");
  assert.equal(fitFor("devon", []).fit, 0);
});

// ---------- unlocks ----------
test("rankInventory: real, local, not already unlocked, not something the whole chat is already in; ranked by chat topics", () => {
  resetDb();
  resetPlayStore();
  const groups = rankInventory(VB, "group");
  assert.ok(groups.length > 0);
  assert.ok(!groups.some((c) => c.item.id === "g_cheapeats"), "already unlocked for this chat");
  assert.ok(!groups.some((c) => c.item.id === "g_volleyball"), "all eight are already members");
  assert.ok(groups.every((c) => c.item.kind === "group" && getGroup(c.item.id)!.privacy === "public"));
  assert.ok(rankInventory(MJ, "group").some((c) => c.item.id === "g_cheapeats") || getGroup("g_cheapeats")!.memberIds.includes("maya") && getGroup("g_cheapeats")!.memberIds.includes("jordan"), "another chat's unlock doesn't take it from this one");

  const events = rankInventory(VB, "event");
  assert.ok(events.length >= 3);
  for (const c of events) {
    const e = getEvent(c.item.id)!;
    assert.ok(new Date(e.startsAt).getTime() > Date.now() && (e.city ?? "austin") === "austin" && e.category !== "Reconnect", `${e.id} is upcoming and local`);
    assert.ok(CREW.some((u) => !e.going.includes(u)));
    assert.ok(isTopic(c.topic) && c.item.topics.includes(c.topic));
    near(c.score, Object.values(c.parts).reduce((s, x) => s + x, 0), `${e.id} score is the sum of its parts`);
  }
  assert.deepEqual(events.map((c) => c.score), [...events.map((c) => c.score)].sort((a, b) => b - a));
  assert.equal(events[0].topic, "food", "the chat's top topic leads");
  assert.ok(topicsOfEvent(getEvent(events[0].item.id)!).includes("food"));
  // Once the whole chat is going, it is no longer a candidate.
  const top = events[0].item.id;
  for (const u of CREW) rsvp(top, u, "going");
  assert.ok(!rankInventory(VB, "event").some((c) => c.item.id === top));
  assert.ok(rankInventory(VB, "listing").every((c) => getListing(c.item.id)!.status === "available"));
  assert.deepEqual(rankInventory("c_nope", "event"), []);
});

test("maybeUnlock: the seeded chat crosses 60 on today's game and gets its Event once, never twice", async () => {
  resetDb();
  resetPlayStore();
  assert.equal(await maybeUnlock(VB), null, "58 with the group already unlocked: nothing to give");
  const today = (await ensureDaily(VB, "devon"))!;
  const r = today.rounds[0];
  assert.equal(r.kind, "points");
  const spread = (i: number) => Object.fromEntries(r.options.map((o, k) => [o.id, k === i % 3 ? 6 : k === (i + 1) % 3 ? 4 : 0]));
  const before = chatScore(VB).score;
  assert.ok(before < 60, `before ${before}`);
  const seen: { by: ID; tier: UnlockTier; score: number }[] = [];
  const order = ["devon", "sam", "tyler", "marcus", "grace", "nina", "ethan", "jordan"];
  for (const [i, u] of order.entries()) {
    await act(today.id, u, { action: "answer", roundId: r.id, choice: i < 4 ? { [r.options[0].id]: 7, [r.options[1].id]: 3 } : spread(i), ms: 5000 });
    const out = await act(today.id, u, { action: "complete" });
    const now = chatScore(VB).score;
    if (out.unlock) seen.push({ by: u, tier: out.unlock.tier, score: now });
    else if (!seen.length) assert.ok(now < 60, `${u} finished at ${now} and no card came`);
    if (i === 0) await act(today.id, u, { action: "react", emoji: "🔥" });
  }
  assert.equal(seen.length, 1, `exactly one unlock, got ${JSON.stringify(seen)}`);
  assert.equal(seen[0].tier, "event");
  assert.ok(seen[0].score >= 60, `unlocked at ${seen[0].score}`);
  assert.ok(order.indexOf(seen[0].by) <= 4, "by the fifth finish at the latest");
  assert.ok(chatScore(VB).score >= 60);
  assert.equal(await maybeUnlock(VB), null);
  assert.equal(await maybeUnlock(VB), null);
  assert.deepEqual(unlocksIn(VB).map((u) => u.tier), ["group", "event"]);

  const u = unlocksIn(VB)[1];
  const e = getEvent(u.refId)!;
  assert.ok(e && new Date(e.startsAt).getTime() > Date.now() && (e.city ?? "austin") === "austin");
  assert.equal(u.title, e.title);
  assert.ok(u.score >= 60);
  assert.ok(topicsOfEvent(e).includes(u.topic));
  assert.ok(u.facts.length >= 1 && u.why.trim().split(/\s+/).length <= 30);
  const allowed = new Set(u.facts.join(" ").match(/\d+(?:\.\d+)?/g) ?? []);
  for (const num of u.why.split(u.title).join(" ").match(/\d+(?:\.\d+)?/g) ?? []) assert.ok(allowed.has(num), `the why line's ${num} is in the counted facts`);
  assert.ok(u.facts.some((f) => f.includes("Wager")), "the Wager the chat just played is the reason");
  const card = getConversation(VB)!.messages.filter((m) => m.attachment?.type === "unlock" && m.attachment.ref === u.id);
  assert.equal(card.length, 1);
  assert.ok(card[0].system && card[0].id === u.messageId);
  for (const m of CREW) assert.equal(notificationsFor(m).filter((n) => n.type === "play").length, 1, `${m} is told once`);
  assert.equal(notificationsFor("maya").filter((n) => n.type === "play").length, 0);
  // What a member sees of it.
  const v = viewUnlock(u, "nina");
  assert.equal(v.href, `/events/${e.id}`);
  assert.deepEqual(v.inMembers.map((m) => m.id).sort(), CREW.filter((m) => e.going.includes(m)).sort(), "members already going show on the card");
  assert.throws(() => viewUnlock(u, "maya"), status(404));
  // Facts are counted, never written.
  const facts = unlockFacts(VB, rankInventory(VB, "listing")[0]);
  assert.ok(facts.length >= 1 && facts.every((f) => typeof f === "string" && f.length > 0));
});

test("respondUnlock: \"I'm in\" really RSVPs / joins / saves, and comes back as that member's own signal", () => {
  resetDb();
  resetPlayStore();
  const mk = (tier: UnlockTier, refId: string, topic: TopicId): Unlock => {
    const u: Unlock = { id: `ul_${tier}`, conversationId: VB, tier, refId, topic, title: refId, sub: "", why: "w", facts: ["w"], score: 61, mode: "mock", costUsd: 0, responses: {}, createdAt: iso(Date.now()) };
    playStore().unlocks.set(u.id, u);
    return u;
  };
  const isIn = { event: (id: string, u: ID) => getEvent(id)!.going.includes(u), group: (id: string, u: ID) => getGroup(id)!.memberIds.includes(u), listing: (id: string, u: ID) => getListing(id)!.savedBy.includes(u) };
  const cases: [UnlockTier, string, TopicId, string][] = [["event", "e_anime_night", "film", "rsvp"], ["group", "g_thrift", "thrift", "join"], ["listing", "l_bike", "cycling", "save"]];
  for (const [tier, refId, topic, kind] of cases) {
    const who = CREW.find((m) => !isIn[tier](refId, m))!;
    const other = CREW.find((m) => m !== who && !isIn[tier](refId, m))!;
    const u = mk(tier, refId, topic);
    const a0 = affinityFor(who).raw[topic], o0 = affinityFor(other).raw[topic];
    const n0 = playStore().events.length;

    respondUnlock(u.id, who, "in");
    assert.ok(isIn[tier](refId, who), `${tier}: ${who} is really in`);
    const ev = playStore().events.at(-1)!;
    assert.deepEqual([ev.kind, ev.userId, ev.topic, ev.unlockId, ev.conversationId], [kind, who, topic, u.id, VB]);
    const a1 = affinityFor(who).raw[topic];
    assert.ok(a1 > a0 + 0.5, `${tier}: ${who}'s ${topic} affinity rises (${a0} → ${a1})`);
    near(affinityFor(other).raw[topic], o0, "nobody else's moves");
    assert.ok(fitFor(who, [topic]).fit >= fitFor(other, [topic]).fit);
    respondUnlock(u.id, who, "in");
    assert.equal(playStore().events.length, n0 + 1, "idempotent");
    assert.equal(viewUnlock(u, who).my, "in");
    assert.ok(viewUnlock(u, other).inMembers.some((m) => m.id === who));

    respondUnlock(u.id, other, "dismiss");
    assert.ok(!isIn[tier](refId, other));
    assert.ok(affinityFor(other).raw[topic] < o0, "a dismissal counts against the topic, for that member only");
    assert.equal(viewUnlock(u, other).my, "dismiss");

    respondUnlock(u.id, who, "undo");
    assert.ok(!isIn[tier](refId, who), `${tier}: undo takes the ${kind} back`);
    near(affinityFor(who).raw[topic], a0);
    assert.equal(viewUnlock(u, who).my, undefined);
    assert.throws(() => respondUnlock(u.id, "maya", "in"), status(404));
    assert.throws(() => respondUnlock(u.id, who, "maybe" as "in"), status(400));
  }
  // Someone who was already going keeps their RSVP when they undo: the card didn't make it.
  const u = playStore().unlocks.get("ul_event")!;
  const already = CREW.find((m) => getEvent(u.refId)!.going.includes(m));
  if (already) { respondUnlock(u.id, already, "in"); respondUnlock(u.id, already, "undo"); assert.ok(getEvent(u.refId)!.going.includes(already)); }
  assert.throws(() => respondUnlock("ul_nope", "devon", "in"), status(404));
});

// ---------- confirmed defects, one test each ----------
test("ensureDaily: a thread nobody has really written in gets no game, so it never appears in the other person's inbox", async () => {
  resetDb();
  resetPlayStore();
  const dm = getOrCreateDM("maya", "priya"); // what "Message" on a profile or a listing does
  assert.equal(dm.messages.length, 0);
  const inbox = () => conversationsFor("priya").some((c) => c.id === dm.id);
  assert.equal(await ensureDaily(dm.id, "maya"), null);
  assert.equal(dm.messages.length, 0);
  assert.equal(inbox(), false);
  // Maya's unsent draft (Reconnect / trip agent) is only hers to see: still no card, still not in Priya's inbox.
  dm.messages.push({ id: "m_t_draft", senderId: "maya", text: "ok what if I actually came out in march", createdAt: iso(Date.now()), status: "draft", readBy: ["maya"] });
  assert.equal(await ensureDaily(dm.id, "maya"), null);
  assert.equal(gameCards(dm.id).length, 0);
  assert.equal(inbox(), false);
  assert.equal(unreadCount("priya"), unreadCountBefore("priya", dm.id));
  await assert.rejects(dropNow(dm.id), status(409), "the dev drop refuses too");
  assert.equal(playStore().failed.size, 0, "not a failure: it drops once someone writes");
  sendMessage(dm.id, "maya", "hey are you still doing the saturday long run? I want in");
  assert.equal(inbox(), true);
  const g = await ensureDaily(dm.id, "priya");
  assert.ok(g && g.conversationId === dm.id && g.rounds.length >= 1, "a real conversation gets its game");
  assert.equal(gameCards(dm.id).length, 1);
});
/** Unread messages for a user, not counting one conversation. */
function unreadCountBefore(userId: ID, exceptId: ID) {
  return conversationsFor(userId).filter((c) => c.id !== exceptId).reduce((n, c) => n + c.messages.filter((m) => (m.system || m.senderId !== userId) && m.status !== "draft" && !m.readBy?.includes(userId)).length, 0);
}

test("a game card is nobody's own message: it is unread for the member it is stored under too", async () => {
  resetDb();
  resetPlayStore();
  const first = getConversation(VB)!.participantIds[0];
  const before = unreadCount(first);
  const g = (await ensureDaily(VB, "sam"))!;
  const cardMsg = getConversation(VB)!.messages.find((m) => m.id === g.messageId)!;
  assert.deepEqual([cardMsg.senderId, cardMsg.system, cardMsg.readBy], [first, true, []]);
  assert.equal(unreadCount(first), before + 1);
});

test("privacy in a DM: chat topics carry no score and only what the chat played; the other person's pick moves nothing an unfinished viewer sees", async () => {
  resetDb();
  resetPlayStore();
  const v0 = chatView(MJ, "maya");
  assert.ok(v0.topics.length >= 3);
  for (const t of v0.topics) { assert.deepEqual(Object.keys(t).sort(), ["games", "label", "topic"]); assert.ok(t.games > 0, `${t.topic} was never played in this chat`); }
  assert.deepEqual(v0.topics.map((t) => t.games), [...v0.topics.map((t) => t.games)].sort((a, b) => b - a), "ordered by how much the chat played them, not by anyone's score");
  assert.ok(chatView(VB, "devon").topics.every((t) => !("score" in t)), "no chat-topic number in a group either");

  // Two worlds that differ only in which side Jordan took. Maya, who hasn't finished, must not be able to tell them apart.
  const world = async (pick: "a" | "b", finish: boolean) => {
    resetDb();
    resetPlayStore();
    const g = game(MJ, "split", "food", [round("r1", "split", [opt("a", "food"), opt("b", "art")])]);
    playStore().byDay.set(`${MJ}|${g.date}`, g.id);
    await act(g.id, "jordan", { action: "answer", roundId: "r1", choice: { pick, predict: pick } });
    if (finish) await act(g.id, "jordan", { action: "complete" });
    const v = chatView(MJ, "maya");
    const seen = viewGame(g, "maya");
    return { g, topics: v.topics, parts: v.parts, score: v.score, myTopics: v.myTopics, next: v.next, results: seen.results, mine: seen.mine, players: seen.players.map((p) => p.id) };
  };
  for (const finish of [false, true]) {
    const { g: _a, ...a } = await world("a", finish);
    const { g: _b, ...b } = await world("b", finish);
    assert.deepEqual(a, b, finish ? "a finished pick" : "a tap Jordan can still change");
    assert.equal(a.results, undefined);
  }
  // Maya's own view of herself is untouched by Jordan's play; once she finishes she sees the results like anyone.
  const { g } = await world("b", true);
  await act(g.id, "maya", { action: "answer", roundId: "r1", choice: { pick: "a", predict: "b" } });
  const done = (await act(g.id, "maya", { action: "complete" })).game;
  assert.deepEqual(done.results?.[0].who, { a: ["maya"], b: ["jordan"] });
});

test("Wager template: a listing's pitch never says who saved it", async () => {
  resetDb();
  resetPlayStore();
  assert.ok(getListing("l_monstera")!.savedBy.includes("maya") && getListing("l_camera")!.savedBy.includes("maya"), "Maya has private saves");
  for (const topic of ["home", "film"] as TopicId[]) {
    const g = await generateGame(MJ, { format: "wager", topic });
    assert.equal(g.format, "wager");
    const listings = g.rounds[0].options.filter((o) => o.ref?.kind === "listing");
    assert.ok(listings.length >= 1, `${topic}: a listing is on the table`);
    for (const o of listings) {
      assert.equal(o.pitch, undefined);
      assert.equal(o.sub, buildContext(MJ).inventory.find((i) => i.id === o.ref!.id)!.sub);
    }
    assert.ok(!/watching|saved/i.test(JSON.stringify(g.rounds)), "nothing about saves anywhere in the round");
  }
});

test("rankInventory: a Wager result replaces the topic estimate, so the Wager winner outranks the Wager losers", async () => {
  resetDb();
  resetPlayStore();
  // Seeded day-9 Wager: pickleball 27, Porch Lights 18, dumpling night 15 (of 60).
  const ev = rankInventory(VB, "event");
  const at = (id: string) => ev.findIndex((c) => c.item.id === id);
  assert.ok(at("e_pickleball_tourney") >= 0 && at("e_pickleball_tourney") < at("e_porch_lights") && at("e_porch_lights") < at("e_dumpling_night"), ev.map((c) => `${c.item.id} ${c.score}`).join(", "));
  for (const id of ["e_pickleball_tourney", "e_porch_lights", "e_dumpling_night"]) { const c = ev[at(id)]; assert.equal(c.parts.topics, 0, `${id}: the topic estimate is replaced`); assert.ok(c.parts.wager > 0); }
  assert.ok(ev[at("e_pickleball_tourney")].parts.wager > ev[at("e_porch_lights")].parts.wager);
  assert.ok(unlockFacts(VB, ev[at("e_pickleball_tourney")])[0].startsWith("27 of 60 points went to this in "));
  for (const id of ["e_porch_lights", "e_dumpling_night"]) assert.ok(!unlockFacts(VB, ev[at(id)]).some((f) => f.includes("points went to this")), `${id} lost: no points line`);

  // Today's Wager: five members put 7 on the second item and 3 on the first. The card goes to the one they chose.
  const today = (await ensureDaily(VB, "devon"))!;
  const r = today.rounds[0];
  assert.deepEqual([today.format, r.options[0].ref?.kind, r.options[1].ref?.kind], ["wager", "event", "event"]);
  const first = await act(today.id, "devon", { action: "answer", roundId: r.id, choice: { [r.options[0].id]: 3, [r.options[1].id]: 7 } });
  assert.equal(first.unlock, undefined);
  await act(today.id, "devon", { action: "complete" });
  const early = await act(today.id, "devon", { action: "react", emoji: "🔥" });
  assert.ok(chatScore(VB).earned.includes("event"), "the reaction takes the score over 60");
  assert.equal(early.unlock, undefined, "but the chat is mid-Wager on events: the card waits for half the chat to answer");
  let unlock;
  for (const u of ["sam", "tyler", "marcus", "grace"]) {
    await act(today.id, u, { action: "answer", roundId: r.id, choice: { [r.options[0].id]: 3, [r.options[1].id]: 7 } });
    unlock = (await act(today.id, u, { action: "complete" })).unlock ?? unlock;
  }
  assert.equal(unlock?.refId, r.options[1].ref!.id, "the item the chat put its points on");
  const u = unlocksIn(VB).at(-1)!;
  assert.equal(u.facts[0], "35 of 50 points went to this in today's Wager");
  assert.ok(u.why.startsWith(u.facts[0]));
  const loser = rankInventory(VB, "event").find((c) => c.item.id === r.options[0].ref!.id)!;
  assert.ok(loser.parts.topics === 0 && loser.parts.wager < 0.5);
  assert.ok(!unlockFacts(VB, loser).some((f) => f.includes("points went to this")), "the item that lost today's Wager can't cite its losing share");
});

test("the topic gate counts played games only, and the unlocked item has to be on a topic this chat settled", async () => {
  clean();
  const five = chat("c_t_five", ["devon", "sam", "tyler", "grace", "nina"]);
  sendMessage(five.id, "devon", "who is in for tacos after the game on sunday");
  // (a) One Split on food played by three, then a Wager with a food option that nobody plays: food is not settled.
  const split = game(five.id, "split", "food", [round("r1", "split", [opt("a", "food"), opt("b", "music")])], 2);
  for (const u of ["devon", "sam", "tyler"]) play(split, u, { r1: { pick: "a", predict: "a" } }, { react: true });
  game(five.id, "wager", "food", [round("r1", "points", [opt("a", "food"), opt("b", "sports")])], 1);
  const a = chatScore(five.id);
  const food = a.topics.find((t) => t.topic === "food")!;
  assert.deepEqual([food.games, food.observedBy], [1, 3], "the unplayed Wager doesn't count as a game on food");
  assert.ok(!confident(food, 5));
  assert.deepEqual(a.earned, []);
  assert.equal(await maybeUnlock(five.id), null);

  // (b) Two Receipts games on "community" played by three: who-said-it expresses no preference, so nothing is settled
  //     and nothing unlocks, whatever the score.
  playStore().games.clear(); playStore().answers.clear(); playStore().events.length = 0; playStore().byDay.clear();
  for (const d of [2, 1]) {
    const rc = game(five.id, "receipts", "community", [round("r1", "pick", [opt("devon", undefined, "devon"), opt("sam", undefined, "sam")], "sam")], d);
    for (const u of ["devon", "sam", "tyler"]) play(rc, u, { r1: "sam" }, { react: true });
  }
  const b = chatScore(five.id);
  assert.ok(b.score >= 40, `score ${b.score}`);
  const community = b.topics.find((t) => t.topic === "community")!;
  assert.deepEqual([community.games, community.observedBy], [2, 3]);
  assert.ok(!confident(community, 5), "played twice by 60%, but nobody said they like it");
  assert.deepEqual(b.earned, []);
  assert.equal(await maybeUnlock(five.id), null);
  assert.equal(unlocksIn(five.id).length, 0);
  // The fallback fact counts played games on that topic, not every game the chat was sent.
  const item = buildContext(five.id).inventory.find((i) => i.kind === "event")!;
  assert.match(unlockFacts(five.id, { item, score: 0, topic: "community", parts: {} })[0], /^giving back is this chat's (top|#\d+) topic after 2 games on it$/);
  assert.match(unlockFacts(five.id, { item, score: 0, topic: "cycling", parts: {} })[0], /^cycling is this chat's (top|#\d+) topic$/);

  // (c) Sports is settled (two Splits, everyone played). The Group card must be a sports group, even if a group on a
  //     topic the chat never played ranks higher on taste alone.
  playStore().games.clear(); playStore().answers.clear(); playStore().events.length = 0; playStore().byDay.clear();
  for (const d of [2, 1]) {
    const sp = game(five.id, "split", "sports", [round("r1", "split", [opt("a", "sports"), opt("b", "sports")])], d);
    for (const u of five.participantIds) play(sp, u, { r1: { pick: "a", predict: "a" } }, { react: true });
  }
  const c = chatScore(five.id);
  assert.ok(c.earned.includes("group"), `earned ${c.earned} at ${c.score}`);
  const settled = new Set(c.topics.filter((t) => confident(t, 5)).map((t) => t.topic));
  assert.deepEqual([...settled], ["sports"]);
  const backed = (t: UnlockTier) => rankInventory(five.id, t).find((x) => x.parts.topics > 0 && settled.has(x.topic));
  const topGroup = rankInventory(five.id, "group")[0];
  assert.ok(topGroup.parts.topics > 0 && !settled.has(topGroup.topic), `the best-ranked group (${topGroup.item.id}, ${topGroup.topic}) is there on taste alone`);
  const want = c.earned.map(backed).find((x) => !!x);
  const got = await maybeUnlock(five.id);
  assert.ok(got && want, "something on sports is on offer");
  assert.equal(got.refId, want.item.id);
  assert.equal(got.topic, "sports");
  assert.notEqual(got.refId, topGroup.item.id);
});

test("maybeUnlock: a lower tier with nothing to offer doesn't block the next one", async () => {
  clean();
  const trio = chat("c_t_trio", ["devon", "sam", "tyler"]);
  sendMessage(trio.id, "devon", "tacos after volleyball on sunday, who is in");
  for (const g of db().groups) for (const u of trio.participantIds) if (!g.memberIds.includes(u)) g.memberIds.push(u); // everyone is already in every group
  for (const d of [3, 2, 1]) {
    const sp = game(trio.id, "split", "food", [round("r1", "split", [opt("a", "food"), opt("b", "food")])], d);
    for (const u of trio.participantIds) play(sp, u, { r1: { pick: "a", predict: "a" } }, { react: true });
  }
  const cs = chatScore(trio.id);
  assert.ok(cs.score >= 60 && cs.earned.includes("group") && cs.earned.includes("event"), `score ${cs.score}, earned ${cs.earned}`);
  assert.equal(rankInventory(trio.id, "group").length, 0, "no group left to suggest");
  assert.ok(rankInventory(trio.id, "event").length > 0);
  const u = await maybeUnlock(trio.id);
  assert.equal(u?.tier, "event");
  assert.ok(topicsOfEvent(getEvent(u!.refId)!).includes("food"));
  assert.deepEqual(unlocksIn(trio.id).map((x) => x.tier), ["event"], "the empty Group tier stays open for later");
});

/** `n` new people outside the chat who are friends of `member` (so tests don't depend on who the seed has going). */
function newFriendsOf(member: ID, n: number): ID[] {
  const ids = Array.from({ length: n }, (_, i) => `u_t_friend${i}`);
  for (const id of ids) { db().users.push({ ...getUser("omar")!, id, friendIds: [member] }); getUser(member)!.friendIds.push(id); }
  return ids;
}

test("rankInventory: friends of the chat going lift an event a little (0.05 each, capped at 0.15); groups and listings get nothing", () => {
  clean();
  const first = rankInventory(VB, "event")[0];
  assert.ok(first, "an event to rank");
  const e = getEvent(first.item.id)!;
  const outside = newFriendsOf("devon", 4);
  const partFor = () => rankInventory(VB, "event").find((x) => x.item.id === e.id)!.parts.friends;
  const base = partFor();
  e.going.push(outside[0]);
  near(partFor(), Math.min(0.15, base + 0.05));
  e.going.push(...outside.slice(1, 4));
  assert.equal(partFor(), 0.15, "capped");
  assert.ok(rankInventory(VB, "group").every((x) => x.parts.friends === 0));
  assert.ok(rankInventory(VB, "listing").every((x) => x.parts.friends === 0));
});

test("unlockFacts: a streak milestone comes before the topic fallback; 'N of your friends are going' from two", () => {
  clean();
  // Three played days of a format with no taste facts (Receipts), so nothing else is counted about the item.
  for (const d of [1, 2, 3]) finishAt(dayGame(VB, d, "receipts"), CREW.slice(0, 5));
  assert.equal(streakDays(VB), 3);
  const c = rankInventory(VB, "event")[0];
  const e = getEvent(c.item.id)!;
  e.going = e.going.filter((id) => CREW.includes(id));
  let facts = unlockFacts(VB, rankInventory(VB, "event").find((x) => x.item.id === e.id)!);
  assert.equal(facts[0], "3-day streak", "the milestone leads");
  assert.ok(!facts.some((f) => f.includes("top topic") || /#\d/.test(f)), "and replaces the topic fallback");
  assert.ok(!facts.some((f) => f.includes("friends")));
  const outside = newFriendsOf("devon", 2);
  e.going.push(outside[0]);
  facts = unlockFacts(VB, rankInventory(VB, "event").find((x) => x.item.id === e.id)!);
  assert.ok(!facts.some((f) => f.includes("friends")), "one friend isn't a fact yet");
  e.going.push(outside[1]);
  facts = unlockFacts(VB, rankInventory(VB, "event").find((x) => x.item.id === e.id)!);
  assert.ok(facts.includes("2 of your friends are going"));
  assert.equal(checkWhy("2 of your friends are going, so this one is for the whole chat.", facts, e.title), undefined, "the why line can copy it");

  // Two days is a streak but not a milestone: it follows the topic fallback.
  clean();
  for (const d of [1, 2]) finishAt(dayGame(VB, d, "receipts"), CREW.slice(0, 5));
  facts = unlockFacts(VB, rankInventory(VB, "event")[0]);
  assert.ok(facts[0].includes("topic"), `topic first: ${facts[0]}`);
  assert.ok(facts.includes("2-day streak"));
});

test("maybeUnlock: one card per chat per Austin day (an unlock at 11:30pm last night doesn't block today's)", async () => {
  resetDb();
  resetPlayStore();
  const g = await maybeUnlock(MJ);
  assert.equal(g?.tier, "group");
  assert.equal(await maybeUnlock(MJ), null, "one a day");
  g!.createdAt = iso(austin(daysBack(1), 23, 30)); // UTC is already "today" at that moment
  const e = await maybeUnlock(MJ);
  assert.equal(e?.tier, "event", "yesterday in Austin: today's card can come");
  assert.equal(await maybeUnlock(MJ), null);
});

test("checkWhy: numbers only inside a fact copied word for word; no quantity words, non-strings or walls of text", async () => {
  const facts = ["7 of 20 points went to this in today's Wager", "3-day streak", "2 of you are already going"];
  assert.equal(checkWhy(`${facts[0]}, so this one is for the whole chat.`, facts), undefined, "the template line");
  assert.equal(checkWhy(`3-day streak and 2 of you are already going. Porch Lights + Sun June it is.`, facts, "Porch Lights + Sun June"), undefined);
  assert.equal(checkWhy(`${facts[0]}: Fall Pickleball Round Robin 2026 fits.`, facts, "Fall Pickleball Round Robin 2026"), undefined, "the item's own name is not a claim");
  for (const line of [
    "20 of you are already going, 7 days running", // the facts' numbers moved onto other nouns
    "All eight of you put every point on this one",
    "Everyone here picked this unanimously, and half the chat is already going",
    `${facts[0]}, and everyone is in`,
    `${facts[0]}, plus 5 more reasons`,
    "This one fits the chat", // states no fact at all
    "[object Object]",
    "",
    `${facts[1]} ${"x".repeat(200)}`,
    `${facts[1]}, ${Array(31).fill("so").join(" ")}`,
    `${facts[1]} and we miss you`,
  ]) assert.ok(checkWhy(line, facts), `allowed: "${line.slice(0, 60)}"`);
  assert.equal(checkWhy({ text: "x" } as unknown as string, facts), "empty line");

  // A model that returns something other than a string for the line: the card shows the counted fact.
  resetDb();
  resetPlayStore();
  const real = ai.json;
  ai.json = (async () => ({ data: { line: { text: "trust me" } }, trace: { mode: "live", costUsd: 0 } })) as unknown as typeof ai.json;
  try {
    const g = game(MJ, "split", "food", [round("r1", "split", [opt("a", "food"), opt("b", "food")])]);
    await act(g.id, "maya", { action: "answer", roundId: "r1", choice: { pick: "a", predict: "a" } });
    const out = await act(g.id, "maya", { action: "complete" });
    const u = unlocksIn(MJ)[0];
    assert.ok(out.unlock && u, "the DM's first unlock fires on the next finish");
    assert.equal(u.why, u.facts[0]);
    assert.ok(u.refused?.startsWith("empty line"));
  } finally { ai.json = real; }
});

test("generateGame: a format code already knows the chat can't support is never sent to the model", async () => {
  resetDb();
  resetPlayStore();
  const real = ai.json;
  let calls = 0;
  ai.json = ((...args: Parameters<typeof ai.json>) => { calls++; return real(...args); }) as typeof ai.json;
  try {
    for (const format of ["lineup", "hotseat"] as Format[]) {
      const g = await generateGame(MJ, { format });
      assert.equal(g.format, "split");
      assert.match(g.mode, /fallback/);
    }
    assert.equal(calls, 0, "no call for a Lineup or Hot Seat in a DM");
    await generateGame(MJ, { format: "split" });
    assert.equal(calls, 1);
  } finally { ai.json = real; }
});

test("chatView.next is the lowest tier the chat hasn't been given, not the first threshold above the score", async () => {
  resetDb();
  resetPlayStore();
  assert.equal(chatScore(MJ).score, 74, "the DM's one missed day is held by its weekly freeze");
  assert.deepEqual(chatScore(MJ).next, { tier: "listing", at: 75 }, "the score alone would say Marketplace");
  assert.deepEqual(chatView(MJ, "maya").next, { tier: "group", at: 40, ready: true }, "but nothing has been unlocked yet: the Group comes first");
  assert.deepEqual(chatView(VB, "devon").next, { tier: "event", at: 60, ready: false });
  const g = game(MJ, "split", "food", [round("r1", "split", [opt("a", "food"), opt("b", "food")])]);
  await act(g.id, "maya", { action: "answer", roundId: "r1", choice: { pick: "a", predict: "a" } });
  const out = await act(g.id, "maya", { action: "complete" });
  assert.equal(out.unlock?.tier, "group");
  assert.deepEqual(chatView(MJ, "maya").next, { tier: "event", at: 60, ready: false }, "the Event is next, and not today: one card a day");
});

test("a reaction that takes the chat over a threshold unlocks the card; it doesn't wait for the next finished game", async () => {
  resetDb();
  resetPlayStore();
  const today = game(VB, "split", "food", [round("r1", "split", [opt("a", "food"), opt("b", "food")])]);
  playStore().byDay.set(`${VB}|${today.date}`, today.id);
  const four = ["devon", "sam", "tyler", "marcus"]; // half the chat: the day doesn't count toward the streak
  for (const u of four) {
    await act(today.id, u, { action: "answer", roundId: "r1", choice: { pick: "a", predict: "a" } });
    assert.equal((await act(today.id, u, { action: "complete" })).unlock, undefined);
  }
  assert.ok(chatScore(VB).score < 60, `after four finishes ${chatScore(VB).score}`);
  const seen: { by: ID; score: number }[] = [];
  for (const u of four) {
    const before = chatScore(VB).score;
    const out = await act(today.id, u, { action: "react", emoji: "🔥" });
    if (out.unlock) { seen.push({ by: u, score: chatScore(VB).score }); assert.equal(out.unlock.tier, "event"); assert.ok(before < 60, "it came with the reaction that crossed 60"); }
    else if (!seen.length) assert.ok(chatScore(VB).score < 60, `${u} reacted at ${chatScore(VB).score} and no card came`);
  }
  assert.equal(seen.length, 1, `exactly one unlock, got ${JSON.stringify(seen)}`);
  assert.ok(seen[0].score >= 60);
  assert.deepEqual(unlocksIn(VB).map((u) => u.tier), ["group", "event"]);
});

// ---------- reset ----------
test("the admin reset route clears the play store: today's game, answers, unlocks and mutes go; the seed comes back", async () => {
  resetDb();
  resetPlayStore();
  const today = (await ensureDaily(VB, "devon"))!;
  await act(today.id, "devon", { action: "answer", roundId: today.rounds[0].id, choice: { [today.rounds[0].options[0].id]: 10 } });
  await act(today.id, "devon", { action: "complete" });
  setMuted(MJ, "maya", true);
  const old = playStore();
  assert.equal(gamesIn(VB).length, 10);

  const res = await resetRoute(new NextRequest("http://localhost/api/admin/reset", { method: "POST" }), { params: Promise.resolve({}) });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, reset: true });
  const s = playStore();
  assert.notEqual(s, old);
  assert.equal(s.games.size, seedGames.length);
  assert.equal(s.byDay.get(`${VB}|${dayKey()}`), undefined);
  assert.equal(s.muted.size, 0);
  assert.equal(s.pending.size, 0);
  assert.equal(completedBy(today.id).size, 0);
  assert.ok(s.events.every((e) => e.gameId !== today.id));
  assert.deepEqual(unlocksIn(VB).map((u) => u.id), ["pu_seed_vb_group"]);
  assert.equal(gameCards(VB).length, 0, "the thread is back to the seed too");
  assert.equal(getConversation(VB)!.messages.filter((m) => m.attachment?.type === "unlock").length, 1, "with the seeded unlock card re-inserted");
  assert.equal(chatScore(VB).score, 58);
});
