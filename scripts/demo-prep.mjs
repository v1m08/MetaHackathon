// Demo prep: one command before going on stage and between runs. Calls the same endpoints the app uses.
//
//   npm run demo:prep                       reset, drop today's game in the group chat, one off-stage member plays
//   npm run demo:prep -- --preplay 0        nobody plays ahead: all five on stage are needed to unlock the Event
//   npm run demo:prep -- --preplay 2        two play ahead: the Event unlocks on the third player on stage
//   npm run demo:prep -- --dm               also set up the Maya and Jordan DM (Jordan has played; it is Maya's turn)
//   npm run demo:prep -- --sketch movies    also make sure a Sketch Off topic opens instantly (repeat the flag for more)
//   npm run demo:prep -- --no-reset         keep the current state, just print it
//
//   DEMO_BASE=http://localhost:3000   the app            DEMO_SIDEQUEST=http://localhost:5180   the game server
//
// The group is the seeded 8-person chat c_volleyball ("Zilker Sunday"). The five players on stage are jordan, sam,
// devon, tyler and grace; marcus, nina and ethan are the off-stage members. A day counts, and the chat crosses 60,
// when five of the eight have finished today's game.
import { networkInterfaces } from "node:os";

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const values = (f) => args.flatMap((a, i) => (a === f && args[i + 1] !== undefined ? [args[i + 1]] : []));
const BASE = (process.env.DEMO_BASE ?? "http://localhost:3000").replace(/\/$/, "");
const SQ = (process.env.DEMO_SIDEQUEST ?? BASE.replace(/:\d+$/, ":5180")).replace(/\/$/, "");
const GROUP = "c_volleyball";
const DM = "c_maya_jordan";
const ON_STAGE = ["jordan", "sam", "devon", "tyler", "grace"];
const OFF_STAGE = ["nina", "ethan", "marcus"];
const preplay = Math.max(0, Math.min(OFF_STAGE.length, Number(values("--preplay")[0] ?? 1) || 0));

const H = (u) => ({ "content-type": "application/json", "x-user-id": u });
const call = async (method, path, user, body) => {
  const r = await fetch(`${BASE}${path}`, { method, headers: H(user), body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const get = async (path, user) => (await call("GET", path, user)).body;
const post = async (path, body, user) => (await call("POST", path, user, body)).body;
const secs = (t0) => `${((Date.now() - t0) / 1000).toFixed(1)}s`;
const say = (s = "") => console.log(s);

/** A valid answer for any round. Wager points lean to the second real thing, so one early vote does not decide the card. */
function choiceFor(round, lean = 1) {
  const ids = round.options.map((o) => o.id);
  if (round.kind === "pick") return ids[0];
  if (round.kind === "split") return { pick: ids[0], predict: ids[0] };
  if (round.kind === "rank") return ids;
  const a = ids[Math.min(lean, ids.length - 1)], b = ids[0];
  return a === b ? { [a]: 10 } : { [a]: 6, [b]: 4 };
}
async function play(game, user) {
  await post(`/api/play/games/${game.id}`, { action: "open" }, user);
  for (const r of game.rounds) await post(`/api/play/games/${game.id}`, { action: "answer", roundId: r.id, choice: choiceFor(r), ms: 5000 }, user);
  return post(`/api/play/games/${game.id}`, { action: "complete" }, user);
}
async function drop(chat, user) {
  const t0 = Date.now();
  const game = (await get(`/api/play/daily/${chat}`, user))?.game;
  if (!game) throw new Error(`no game dropped in ${chat} (muted, or the model call failed: try again in a minute, or restart with AI_MODE=mock)`);
  say(`  ${game.formatLabel} · ${game.topicLabel} · "${game.title}"  [${game.mode}, ${secs(t0)}]`);
  if (game.premise) say(`  ${game.premise}`);
  for (const r of game.rounds) say(`    - ${r.prompt}  (${r.options.map((o) => o.label).join(" | ")})`);
  return game;
}
async function state(chat, user) {
  const v = await get(`/api/play/chat/${chat}`, user);
  const today = v.todayGameId ? await get(`/api/play/games/${v.todayGameId}`, user) : null;
  const next = v.next ? `next unlock: ${v.next.tier} at ${v.next.at}` : "every unlock reached";
  say(`  score ${v.score} · ${v.streakDays}-day streak · ${next} · unlocked so far: ${v.unlocks.map((u) => `${u.tier} (${u.title})`).join(", ") || "none"}`);
  if (today?.players) say(`  today's game: ${today.players.length} of ${today.memberCount} played${today.players.length ? ` (${today.players.map((p) => p.first).join(", ")})` : ""}`);
  else say("  today's game has not dropped yet (it drops the first time a member opens the chat)");
  return { played: today?.players?.length ?? 0, unlockedToday: v.unlocks.some((u) => u.tier === "event") };
}

const status = await call("GET", "/api/ai/status", "maya").catch(() => null);
if (!status || status.status !== 200) {
  console.error(`No app at ${BASE}. Start it (npm run build && npm run start, or npm run dev) or set DEMO_BASE.`);
  process.exit(1);
}
say(`Demo prep against ${BASE} · Muse mode: ${status.body.mode}${status.body.budget ? ` · spent $${status.body.budget.spentUsd?.toFixed?.(2) ?? "?"} of $${status.body.budget.limitUsd}` : ""}`);

if (!flag("--no-reset")) {
  await post("/api/admin/reset", {}, "maya");
  say("\nReset: seed restored, today's games and unlocks cleared.");

  say(`\nGroup chat ${GROUP}: today's game`);
  const game = await drop(GROUP, OFF_STAGE[0]);
  for (const u of OFF_STAGE.slice(0, preplay)) {
    await play(game, u);
    say(`  ${u} played ahead of the demo`);
  }
} else say("\nNo reset (--no-reset).");
say(`\nGroup chat ${GROUP}: where it stands`);
const group = await state(GROUP, ON_STAGE[0]);
const needed = Math.max(0, 5 - group.played);
say(group.unlockedToday ? "  The Event card is already out." : `  The Event card unlocks when ${needed} more ${needed === 1 ? "person finishes" : "people finish"} today's game (five of the eight).`);

if (flag("--dm")) {
  say(`\nDM ${DM}: today's game`);
  const game = flag("--no-reset") ? null : await drop(DM, "jordan");
  if (game) {
    await play(game, "jordan");
    say("  jordan played ahead of the demo: it is Maya's turn");
  }
  await state(DM, "maya");
}

// ---------- Sidequest ----------
const sq = async (path, body) => {
  const r = await fetch(`${SQ}${path}`, body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
};
const GAMES = { x: "Deep Cuts", k: "Order Up!", r: "Ghost Run", s: "Sketch Off" };
say(`\nSidequest game server ${SQ}`);
try {
  if ((await sq("/api/health")).app !== "sidequest") throw new Error("not the game server");
  for (const topic of values("--sketch")) {
    const t0 = Date.now();
    const made = await sq("/api/s/new", { interest: topic });
    say(made.id ? `  Sketch Off "${topic}" is ready [${secs(t0)}]` : `  Sketch Off "${topic}" could not be made: ${made.error ?? "unknown error"}`);
  }
  for (const [k, name] of Object.entries(GAMES)) {
    const topics = await sq(`/api/${k}/topics`).catch(() => []);
    say(`  ${name.padEnd(10)} opens instantly for: ${topics.map((t) => t.interest).join(", ") || "(nothing cached yet)"}`);
  }
} catch {
  say("  Not running. Start it in a second terminal: npm run sidequest");
}

// ---------- links ----------
const lan = Object.values(networkInterfaces()).flat().find((a) => a && a.family === "IPv4" && !a.internal)?.address;
const port = new URL(BASE).port || "80";
say("\nOne link per player (each opens the group chat as that person):");
for (const u of ON_STAGE) say(`  ${u.padEnd(7)} ${BASE}/messages/${GROUP}?as=${u}${lan ? `    phone: http://${lan}:${port}/messages/${GROUP}?as=${u}` : ""}`);
if (flag("--dm")) say(`  maya    ${BASE}/?as=maya    (Hangout, then the chat with Jordan)`);
say(`\nInspectors: ${BASE}/dev/play · ${BASE}/dev/context · ${BASE}/dev/ai`);
if (lan) say("Phones need the app started with npm run start:phone (or dev:phone) and the same Wi-Fi as this laptop.");
