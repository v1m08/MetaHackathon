// Glue between the game systems on the demo branch: the daily Chat Games (src/lib/play) next to the Sidequest games
// (sidequest/) in the same threads. No model is called.
//   npm test
process.env.AI_MODE = "mock";
import assert from "node:assert/strict";
import test from "node:test";

import { buildContext } from "@/lib/play/context";
import { dropNow, ensureDaily } from "@/lib/play/daily";
import { quotable } from "@/lib/play/select";
import { playStore, resetPlayStore } from "@/lib/play/store";
import { getConversation, notificationsFor, resetDb, sendMessage } from "@/server/db";

const MJ = "c_maya_jordan";
const VB = "c_volleyball";
const CREW = ["devon", "tyler", "marcus", "nina", "grace", "ethan", "sam", "jordan"];
/** A member's "today's game dropped" notifications. */
const drops = (userId: string) => notificationsFor(userId).filter((n) => n.type === "game");

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

test("a game drop tells every member of the chat once, except the one whose open made it drop", async () => {
  fresh();
  const game = (await ensureDaily(VB, "devon"))!;
  const chat = getConversation(VB)!.name!;
  for (const m of CREW.filter((u) => u !== "devon")) {
    assert.equal(drops(m).length, 1, `${m} is told once`);
    const n = drops(m)[0];
    assert.equal(n.href, `/messages/${VB}`, "it opens the chat");
    assert.ok(n.text.includes(chat) && n.text.includes(game.title), `names the chat and the game: ${n.text}`);
    assert.equal(n.read, false);
  }
  assert.equal(drops("devon").length, 0, "devon opened the chat and is already looking at the card");
  assert.equal(drops("maya").length, 0, "maya is not in this chat");

  assert.equal((await ensureDaily(VB, "sam"))!.id, game.id);
  assert.equal((await ensureDaily(VB, "devon"))!.id, game.id);
  for (const m of CREW) assert.equal(drops(m).length, m === "devon" ? 0 : 1, "the same game again: nobody is told twice");
  for (const m of CREW) assert.equal(notificationsFor(m).filter((n) => n.type === "play").length, 0, "'play' stays what it was: unlocks only");
});

test("in a DM the drop notification says who the chat is with; no game, no notification", async () => {
  fresh();
  const game = (await ensureDaily(MJ, "jordan"))!;
  assert.equal(drops("jordan").length, 0);
  assert.equal(drops("maya").length, 1);
  assert.ok(drops("maya")[0].text.includes("your chat with Jordan") && drops("maya")[0].text.includes(game.title), drops("maya")[0].text);

  // Someone outside the chat, and a muted chat, get no game and so nobody is told.
  assert.equal(await ensureDaily(VB, "maya"), null);
  playStore().muted.add(VB);
  assert.equal(await ensureDaily(VB, "devon"), null);
  for (const m of CREW) assert.equal(drops(m).length, 0, `${m} hears nothing`);
});

test("a game dropped from the dev inspector has no opener, so it tells the whole chat", async () => {
  fresh();
  await dropNow(VB);
  for (const m of CREW) assert.equal(drops(m).length, 1, `${m} is told`);
  assert.equal(drops("maya").length, 0);
});
