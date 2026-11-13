// Glue between the game systems on the demo branch: the daily Chat Games (src/lib/play) next to the Sidequest games
// (sidequest/) in the same threads. No model is called.
//   npm test
process.env.AI_MODE = "mock";
import assert from "node:assert/strict";
import test from "node:test";

import { buildContext } from "@/lib/play/context";
import { quotable } from "@/lib/play/select";
import { resetPlayStore } from "@/lib/play/store";
import { getConversation, resetDb, sendMessage } from "@/server/db";

const MJ = "c_maya_jordan";

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
