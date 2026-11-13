// Glue between the three game systems on the demo branch: the daily Chat Games (src/lib/play), the Sidequest
// games (sidequest/) and the context engine (src/lib/context). No model is called.
//   npm test
process.env.AI_MODE = "mock";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { connectionScoreFor, GAME_LABEL, ingestSidequestSessions, kindOfRef, streakInfoFor, userContextFor } from "@/lib/context";
import { sqPid } from "@/lib/context/seed";
import { buildContext } from "@/lib/play/context";
import { quotable } from "@/lib/play/select";
import { resetPlayStore } from "@/lib/play/store";
import { getConversation, resetDb, sendMessage } from "@/server/db";

const MJ = "c_maya_jordan";
const VB = "c_volleyball";
const CACHE = join(process.cwd(), "sidequest", ".cache");

function fresh() {
  resetDb();
  resetPlayStore();
}

test("Sidequest cards and 'played' lines are never daily-game evidence, so they can never be quoted as something a member said", () => {
  fresh();
  const seeded = getConversation(MJ)!.messages.filter((m) => m.attachment?.type === "sqgame" || m.attachment?.type === "sqgamelog");
  assert.ok(seeded.length >= 4, "the seed puts Sidequest cards and lines in this chat");
  // a fresh one, long enough to pass the length filters on its own
  const line = sendMessage(MJ, "jordan", "played Taco 'Bout It · $214 · took the lead", { type: "sqgamelog", ref: "k:sqtaco01" });
  const card = sendMessage(MJ, "maya", "🎮 Sketch Off: Animals of the Greenbelt", { type: "sqgame", ref: "s:demo0001" });
  const typed = sendMessage(MJ, "jordan", "ok who is bringing the folding tables on saturday");

  const ctx = buildContext(MJ);
  const ids = new Set(ctx.evidence.map((e) => e.id));
  for (const m of [...seeded, line, card]) assert.ok(!ids.has(m.id), `${m.id} (${m.attachment!.type}) is not evidence`);
  assert.ok(ids.has(typed.id), "a line someone actually typed still is");
  assert.ok(!ctx.evidence.some((e) => e.kind === "message" && /^(played|ran) .+ · /.test(e.text)), "no 'played …' line anywhere in the evidence");
  assert.ok(!quotable(ctx).some((e) => e.id === line.id || e.id === card.id), "and none is offered to Receipts as a quote");
});

test("card refs map to the four Sidequest games", () => {
  assert.deepEqual(["abc123", "k:abc123", "r:abc123", "s:abc123"].map(kindOfRef), ["deepcuts", "orderup", "ghostrun", "sketchoff"]);
  assert.deepEqual(Object.keys(GAME_LABEL).sort(), ["deepcuts", "ghostrun", "orderup", "sketchoff"]);
});

test("Ghost Run and Sketch Off sessions are ingested as their own games and count toward the chat's streak and score", () => {
  fresh();
  const before = connectionScoreFor(VB);
  const five = ["jordan", "sam", "devon", "tyler", "grace"];
  sendMessage(VB, "sam", "🎮 Sketch Off: Movies", { type: "sqgame", ref: "s:demo0002" });
  for (const u of five) sendMessage(VB, u, "played Frame by Frame · 210 pts", { type: "sqgamelog", ref: "s:demo0002" });
  sendMessage(VB, "tyler", "🎮 Ghost Run: F1", { type: "sqgame", ref: "r:demo0003" });
  sendMessage(VB, "tyler", "ran Lights Out Sprint · 38.20s", { type: "sqgamelog", ref: "r:demo0003" });

  const sessions = ingestSidequestSessions();
  const sketch = sessions.find((s) => s.ref === "s:demo0002")!;
  assert.equal(sketch.gameKind, "sketchoff");
  assert.equal(sketch.roomId, "demo0002", "the prefix is stripped from the room id");
  assert.equal(sketch.interest, "Movies");
  assert.equal(sketch.title, "Frame by Frame");
  assert.deepEqual([...sketch.players.keys()].sort(), [...five].sort());
  assert.ok(sketch.topics.includes("film"), "a movies game is a film topic");

  const run = sessions.find((s) => s.ref === "r:demo0003")!;
  assert.equal(run.gameKind, "ghostrun");
  assert.equal(run.title, "Lights Out Sprint", "'ran <title>' is read like 'played <title>'");
  assert.deepEqual([...run.players.keys()], ["tyler"]);

  // Five of the chat's eight is a strict majority: today counts.
  const streak = streakInfoFor(VB, sessions);
  assert.deepEqual([streak.today.hasGame, streak.today.finished, streak.today.needed, streak.today.lockedIn], [true, 5, 5, true]);
  assert.ok(connectionScoreFor(VB, sessions).streak.days >= before.streak.days, "and the streak does not go backwards");

  const labels = userContextFor("tyler")!.after.recentGames.filter((g) => g.ref.startsWith("s:") || g.ref.startsWith("r:")).map((g) => g.gameLabel);
  assert.deepEqual(labels.sort(), ["Ghost Run", "Sketch Off"], "the inspector names the game that was played");
});

test("a Sketch Off room on disk fills in the title and who drew or guessed, even without a 'played' line", () => {
  fresh();
  const id = "demoglue9";
  const file = join(CACHE, "sketch", `${id}.json`);
  mkdirSync(join(CACHE, "sketch"), { recursive: true });
  writeFileSync(file, JSON.stringify({
    id,
    pack: { interest: "movies", title: "Frame by Frame", tagline: "Draw the movie thing." },
    createdAt: new Date().toISOString(),
    players: {},
    drawings: [{ id: "d1", artist: sqPid("sam"), at: new Date().toISOString(), guesses: { [sqPid("devon")]: { correct: true, points: 100 }, fbustranger: { correct: false, points: 0 } } }],
  }));
  try {
    sendMessage(VB, "sam", "🎮 Sketch Off: Movies", { type: "sqgame", ref: `s:${id}` });
    const s = ingestSidequestSessions().find((x) => x.ref === `s:${id}`)!;
    assert.equal(s.title, "Frame by Frame");
    assert.deepEqual([...s.players.keys()].sort(), ["devon", "sam"], "the artist and a member who guessed; a player outside the chat is ignored");
  } finally {
    rmSync(file, { force: true });
  }
});
