// Hangout streaks: statuses from today's game, the seeded spread, the 14-day strip, the host's words, and the demo play.
// No live model: AI_MODE is forced to mock, so today's game comes from the template drafts.
//   npm test
process.env.AI_MODE = "mock";
import assert from "node:assert/strict";
import test from "node:test";

import { streakDays } from "@/lib/play/score";
import { completedBy, dayKey, logEvent, playStore, resetPlayStore, saveGame, type PlayGame } from "@/lib/play/store";
import { CRITTER_ART } from "@/lib/streaks/art";
import { endsLabel, hostLine, needsYou, SECTIONS, timeLeft } from "@/lib/streaks/copy";
import { dayEndsAt, friendPlaysToday, streakDetail, streaksFor } from "@/lib/streaks/streaks";
import type { StreakCard } from "@/lib/streaks/views";
import { getConversation, resetDb, sendMessage } from "@/server/db";
import type { ID } from "@/types";

const HOUR = 3600e3;
const iso = (t: number) => new Date(t).toISOString();

/** The seeded database and play history, fresh. */
function seeded() { resetDb(); resetPlayStore(); playStore(); }
const card = (friendId: ID) => streaksFor("maya").friends.find((c) => c.friendId === friendId)!;

let n = 0;
/** Today's game in a chat (as if dropped an hour ago), finished by `players`. */
function today(cid: ID, players: ID[]): PlayGame {
  const g = saveGame({ id: `g_st${n++}`, conversationId: cid, date: dayKey(), format: "split", topic: "food", title: "t", premise: "p", evidence: [], mode: "mock", costUsd: 0, dropped: [], createdAt: iso(Date.now() - HOUR),
    rounds: [{ id: "r1", kind: "split", prompt: "p", options: [{ id: "a", label: "a" }, { id: "b", label: "b" }], evidenceIds: [] }] });
  for (const u of players) logEvent({ gameId: g.id, conversationId: cid, userId: u, kind: "complete", at: iso(Date.now()) });
  return g;
}

test("the seeded Hangout: five streaks ending tonight, Lucas never played, Grace's ended", () => {
  seeded();
  const v = streaksFor("maya");
  assert.deepEqual(v.friends.map((c) => [c.friendId, c.streak, c.status, c.state]), [
    ["aisha", 21, "atRisk", "sleepy"], ["sofia", 12, "atRisk", "sleepy"], ["ethan", 5, "atRisk", "sleepy"], ["hannah", 3, "atRisk", "sleepy"], ["jordan", 2, "atRisk", "sleepy"],
    ["lucas", 0, "new", "egg"], ["grace", 0, "lost", "resting"],
  ], "most urgent first, then longest");
  assert.equal(v.friends.length, Object.keys(CRITTER_ART).length, "every critter friend of Maya's appears once");
  for (const c of v.friends) assert.equal(c.streak, c.conversationId ? streakDays(c.conversationId) : 0, `${c.friendId} matches Chat Games`);
  assert.equal(needsYou(v.friends).length, 5);
  const sections = SECTIONS.map((s) => [s.title, v.friends.filter((c) => s.statuses.includes(c.status)).map((c) => c.friendId)]).filter(([, ids]) => ids.length);
  assert.deepEqual(sections, [["Needs you today", ["aisha", "sofia", "ethan", "hannah", "jordan"]], ["Hatch a streak", ["lucas"]], ["Ended", ["grace"]]]);
  assert.ok(SECTIONS.flatMap((s) => s.statuses).length === 6, "every status has exactly one section");
});

test("today's game sets the status: your turn, waiting, done (hatching on day 1)", () => {
  seeded();
  const sofia = card("sofia").conversationId!;
  const g = today(sofia, ["sofia"]);
  assert.deepEqual([card("sofia").status, card("sofia").state, card("sofia").streak], ["yourTurn", "awake", 12]);
  logEvent({ gameId: g.id, conversationId: sofia, userId: "maya", kind: "complete" });
  assert.deepEqual([card("sofia").status, card("sofia").state, card("sofia").streak], ["done", "celebrating", 13]);

  today(card("ethan").conversationId!, ["maya"]);
  assert.deepEqual([card("ethan").status, card("ethan").state], ["theirTurn", "awake"]);
  assert.deepEqual(streaksFor("maya").friends.slice(0, 5).map((c) => c.friendId), ["aisha", "hannah", "jordan", "ethan", "sofia"], "ending tonight, then waiting on them, then safe");

  // Grace's ended streak and Lucas's egg both restart from today's game.
  today(card("grace").conversationId!, ["maya", "grace"]);
  assert.deepEqual([card("grace").status, card("grace").state, card("grace").streak], ["done", "hatching", 1]);
  today(card("lucas").conversationId!, ["lucas"]);
  assert.equal(card("lucas").status, "yourTurn");
  assert.equal(streaksFor("maya").friends[0].friendId, "lucas", "your turn comes first");
  assert.ok(streaksFor("maya").friends.every((c) => c.status !== "new" && c.status !== "lost"), "both left Hatch and Ended");
});

test("a game card or a plain message never counts as playing", () => {
  seeded();
  const cid = card("hannah").conversationId!;
  sendMessage(cid, "hannah", "did you see today's game");
  const g = today(cid, []);
  const c = getConversation(cid)!;
  c.messages.push({ id: "m_st_card", senderId: "hannah", text: "Today's game", createdAt: iso(Date.now()), system: true, attachment: { type: "game", ref: g.id }, readBy: [] });
  assert.equal(completedBy(g.id).size, 0);
  assert.deepEqual([card("hannah").status, card("hannah").streak], ["atRisk", 3]);
});

test("detail: 14 days oldest first ending today, marks from who finished each game", () => {
  seeded();
  const d = streakDetail("maya", "sofia");
  assert.equal(d.days.length, 14);
  assert.equal(d.days[13].date, dayKey());
  assert.equal(d.days[13].mark, "nogame");
  assert.ok(d.days.slice(1, 13).every((x) => x.mark === "both"), "the 12 streak days");
  assert.equal(d.days[0].mark, "one", "13 days ago only Sofia played");
  assert.deepEqual(d.today, { gameId: undefined, me: false, them: false });
  assert.equal(streakDetail("maya", "grace").days[11].mark, "one", "2 days ago only Maya played");
  assert.throws(() => streakDetail("maya", "omar"), /No streak/, "a friend without a critter");
  assert.throws(() => streakDetail("maya", "zoe"), /No streak/, "not a friend");
});

test("the day ends when dayKey rolls over, and the words follow the view", () => {
  const now = Date.parse("2026-11-12T15:30:00Z");
  const end = dayEndsAt(now);
  assert.notEqual(dayKey(new Date(end)), dayKey(new Date(now)));
  assert.equal(dayKey(new Date(Date.parse(end) - 1e3)), dayKey(new Date(now)));
  assert.equal(timeLeft(iso(now + 3 * HOUR + 12 * 60e3), now), "3h 12m");
  assert.equal(timeLeft(iso(now + 45 * 60e3), now), "45m");
  assert.match(endsLabel(iso(now)), /^\d{1,2}(:\d{2})?(am|pm)$/);

  seeded();
  assert.equal(hostLine(streaksFor("maya"), "6pm"), "Aisha's at 21 days! 5 streaks end at 6pm unless you play.");
  today(card("sofia").conversationId!, ["sofia"]);
  assert.match(hostLine(streaksFor("maya"), "6pm"), /^Sofia already played today\. Your turn! 4 streaks end/);
  const v = streaksFor("maya");
  const doneAll = { ...v, friends: v.friends.filter((c) => c.streak > 0 || c.status === "yourTurn").map((c): StreakCard => ({ ...c, status: "done", streak: c.streak + 1 })) };
  assert.equal(hostLine(doneAll, "6pm"), "Aisha's at 22 days! Every streak is safe today.");
});

test("demo: the friend plays today's game (dropped if needed), and the room shows your turn", async () => {
  seeded();
  const before = playStore().games.size;
  const d = await friendPlaysToday("maya", "aisha");
  assert.equal(playStore().games.size, before + 1, "today's game dropped");
  assert.ok(d.today.gameId && completedBy(d.today.gameId).has("aisha"));
  assert.deepEqual([d.today.me, d.today.them, d.status, d.streak], [false, true, "yourTurn", 21]);
  await friendPlaysToday("maya", "aisha");
  assert.equal(completedBy(d.today.gameId!).size, 1, "idempotent");
  await assert.rejects(friendPlaysToday("maya", "omar"), /No streak/);
});
