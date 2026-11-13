// Chat Games eval, against the dev server (http://localhost:3000; QA_BASE=... or BASE=... for another port).
//   npm run eval:play            → eval/play.json + EVAL-PLAY.md, summary on stdout
// Runs in whatever mode the server is in. With AI_MODE=mock nothing is spent and the output is labelled a mock dry
// run: it shows the pipeline holds end to end, not how the model writes. A live run is one model call per game
// (two if the first draft is refused) plus one per unlock line.
//   EVAL_CHATS=n   cap on games generated in total, spread over chats and formats (default 6). What the cap
//                  leaves out is logged and written to the report.
//   CHATS=id,id    only these chats.
// Four things, each a number:
//   1. Generation: every seeded chat with enough of its own messages is a candidate for every format it has the
//      people for. Up to the cap, one game each through POST /api/play/dev. How many passed code's validation in
//      the format asked for with no fallback, how many rounds were kept and what was dropped and why.
//   2. Grounding: share of rounds citing a line a member of that chat wrote (a message in that thread, a post, a
//      Reel). Message citations are looked up in the thread itself; one found in no thread of the chat is a leak.
//   3. Unlock lines: each chat then plays its game to the end as its real members. Every unlock's why line must
//      copy one of code's counted facts word for word with no number outside it, and the script recounts those
//      facts from the raw answers.
//   4. Mode and cost, from the app's own ledger (GET /api/ai/status) before and after.
// Resets the demo first.
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.QA_BASE ?? process.env.BASE ?? "http://localhost:3000";
const CAP = Math.max(1, Math.floor(Number(process.env.EVAL_CHATS ?? 6)) || 6);
const MIN_MESSAGES = 8; // "enough material": fewer real messages than this and the chat is left out
const FORMATS = ["wager", "receipts", "split", "blend", "lineup", "hotseat"];
const GROUP_ONLY = ["lineup", "hotseat"];
const LABEL = { split: "Split", receipts: "Receipts", lineup: "Lineup", blend: "Blend", hotseat: "Hot Seat", wager: "Wager" };
const H = (u) => ({ "content-type": "application/json", "x-user-id": u });
const get = (p, u) => fetch(`${BASE}${p}`, { headers: H(u) }).then((r) => r.json());
const post = (p, b, u) => fetch(`${BASE}${p}`, { method: "POST", headers: H(u), body: JSON.stringify(b) }).then((r) => r.json());
const BANNED = /\b(depress\w*|anxi\w*|lonely|loneliness|grie\w+|sick|illness|hospital|therap\w*|mental|struggl\w*|miss(?:ing|ed|es)?\s+you|too long|guilt\w*|sorry for|you never|should have)\b/i;
const OWN = ["message", "post", "reel"]; // lines a member wrote; interests and inventory are not counted as chat-specific
const pct = (a, b) => (b ? `${a} / ${b} (${Math.round((100 * a) / b)}%)` : "0 / 0");
const cell = (s) => String(s ?? "").replace(/\|/g, "/").replace(/\s+/g, " ");
const tally = (list) => Object.entries(list.reduce((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
const today = () => new Date().toISOString().slice(0, 10);

const status0 = await get("/api/ai/status", "maya").catch(() => null);
if (!status0?.mode) { console.error(`No dev server at ${BASE}. Start one (npm run dev) or set QA_BASE.`); process.exit(1); }
const MOCK = status0.mode === "mock";
console.log(`Chat Games eval against ${BASE} · Muse mode: ${status0.mode}${MOCK ? " — MOCK DRY RUN: no model is called, every game is the code-built template" : ""}\n`);
const t0 = Date.now();

await post("/api/admin/reset", {}, "maya");
const inspectAll = () => get("/api/play/inspect", "maya");
const chatOf = async (id) => (await inspectAll()).chats.find((c) => c.conversationId === id);
const posts = new Map((await get("/api/admin/dump?what=posts", "maya")).map((p) => [p.id, p.authorId]));

// ---- which chats, which formats ----
const found = new Map();
for (const u of await get("/api/admin/dump?what=users", "maya")) for (const c of await get("/api/conversations", u.id)) if (!found.has(c.id)) found.set(c.id, { id: c.id, name: c.name, members: [u.id, ...c.participants.map((p) => p.id)] });
const history = new Set((await inspectAll()).chats.filter((c) => c.games.length).map((c) => c.conversationId));
const all = [];
for (const c of found.values()) {
  const thread = (await get(`/api/conversations/${c.id}`, c.members[0])).messages ?? [];
  const real = thread.filter((m) => !m.system && m.status !== "draft");
  all.push({ ...c, messages: real.length, thread: new Map(real.map((m) => [m.id, m.senderId])), history: history.has(c.id) });
}
const wanted = process.env.CHATS ? process.env.CHATS.split(",") : null;
const thin = all.filter((c) => c.messages < MIN_MESSAGES && (!wanted || wanted.includes(c.id)));
const eligible = all.filter((c) => c.messages >= MIN_MESSAGES && (!wanted || wanted.includes(c.id))).sort((a, b) => Number(b.history) - Number(a.history) || b.messages - a.messages || a.id.localeCompare(b.id));
const pairs = eligible.flatMap((c, ci) => FORMATS.filter((f) => c.members.length >= 3 || !GROUP_ONLY.includes(f)).map((f) => ({ chat: c, ci, format: f, fi: FORMATS.indexOf(f) })));
// Spread the cap: each pick is the pair whose chat and format have been used least so far.
const plan = [];
const used = { chat: {}, format: {} };
const left = [...pairs];
while (plan.length < CAP && left.length) {
  const cost = (p) => (used.chat[p.chat.id] ?? 0) + (used.format[p.format] ?? 0);
  left.sort((a, b) => cost(a) - cost(b) || a.ci - b.ci || a.fi - b.fi);
  const p = left.shift();
  plan.push(p);
  used.chat[p.chat.id] = (used.chat[p.chat.id] ?? 0) + 1;
  used.format[p.format] = (used.format[p.format] ?? 0) + 1;
}
const skipped = { byCap: left.map((p) => `${p.chat.id} ${p.format}`), chatsNotReached: eligible.filter((c) => !used.chat[c.id]).map((c) => c.id), tooLittleMaterial: thin.map((c) => `${c.id} (${c.messages} messages)`) };
console.log(`${all.length} seeded chats, ${eligible.length} with ${MIN_MESSAGES}+ messages of their own → ${pairs.length} chat × format pairs; generating ${plan.length} (EVAL_CHATS=${CAP}).`);
if (skipped.tooLittleMaterial.length) console.log(`left out, too little material: ${skipped.tooLittleMaterial.join(", ")}`);
if (skipped.byCap.length) console.log(`left out by the cap: ${skipped.byCap.length} pairs; chats not reached at all: ${skipped.chatsNotReached.join(", ") || "none"}`);
console.log("");

// ---- 1 + 2. generation and grounding ----
const reason = (d) => d.replace(/^(first draft|refused draft) · /, "").replace(/^(round \d+|wager) dropped: /, "").replace(/"[^"]*"/g, '"…"').replace(/\b(round|option|pitch) \d+/g, "$1 N").replace(/\d+/g, "N");
const games = [];
for (const { chat, format } of plan) {
  const res = await post("/api/play/dev", { conversationId: chat.id, format }, chat.members[0]);
  if (res.error) { games.push({ chat: chat.id, asked: format, error: res.error }); console.log(`${chat.id} ${format}: error ${res.error}`); continue; }
  const g = (await chatOf(chat.id)).games.find((x) => x.id === res.game.id);
  const ev = new Map(g.evidence.map((e) => [e.id, e]));
  // A cited line counts as this chat's own when a member wrote it and, for a message, it is in this very thread.
  const mine = (id) => { const e = ev.get(id); return !!e && OWN.includes(e.kind) && chat.members.includes(e.by) && (e.kind === "message" ? chat.thread.get(id) === e.by : e.kind !== "post" || posts.get(id) === e.by); };
  const leaked = g.rounds.flatMap((r) => r.evidenceIds).filter((id) => { const e = ev.get(id); return !e || (e.kind === "message" && !chat.thread.has(id)) || (e.by && !chat.members.includes(e.by)); });
  const shown = [g.title, g.premise, ...g.rounds.flatMap((r) => [r.prompt, r.quote ?? "", ...r.options.flatMap((o) => [o.label, o.pitch ?? ""])])].join(" \n ");
  const unsupported = g.dropped.some((d) => d.includes("too little to go on"));
  const roundDrops = g.dropped.filter((d) => /(round \d+|wager) dropped: /.test(d));
  const other = g.dropped.filter((d) => !roundDrops.includes(d) && !d.includes("too little to go on"));
  const row = {
    chat: chat.id, members: chat.members.length, asked: format, got: g.format, topic: g.topic, mode: g.mode, title: g.title, selection: g.why,
    passed: g.format === format && !/fallback/.test(g.mode), unsupported,
    rounds: g.rounds.length, roundsDropped: roundDrops.length, roundDropReasons: roundDrops.map(reason), otherRefusals: other.map(reason), refusedRaw: g.dropped,
    roundsCiting: g.rounds.filter((r) => r.evidenceIds.length > 0).length, roundsCitingChat: g.rounds.filter((r) => r.evidenceIds.some(mine)).length, citedOutsideChat: leaked,
    banned: BANNED.test(shown), costUsd: g.costUsd,
  };
  games.push(row);
  console.log(`${chat.id} ${format}: ${row.passed ? "passed" : row.unsupported ? `chat can't support it → ${LABEL[row.got]}` : `fell back → ${LABEL[row.got]}`} "${row.title}" [${row.mode}] rounds kept ${row.rounds}, dropped ${row.roundsDropped}, citing the chat's own lines ${row.roundsCitingChat}/${row.rounds}${row.citedOutsideChat.length ? " CITES OUTSIDE THE CHAT" : ""}${row.banned ? " BANNED WORD SHOWN" : ""}`);
}
const ok = games.filter((g) => !g.error);
const sum = (f) => ok.reduce((n, g) => n + f(g), 0);
const gen = {
  asked: games.length, generated: ok.length, errors: games.length - ok.length,
  passed: ok.filter((g) => g.passed).length, chatCouldNotSupport: ok.filter((g) => !g.passed && g.unsupported).length, fellBack: ok.filter((g) => !g.passed && !g.unsupported).length,
  roundsKept: sum((g) => g.rounds), roundsDropped: sum((g) => g.roundsDropped), roundDropReasons: Object.fromEntries(tally(ok.flatMap((g) => g.roundDropReasons))), otherRefusals: Object.fromEntries(tally(ok.flatMap((g) => g.otherRefusals))),
  roundsCiting: sum((g) => g.roundsCiting), roundsCitingChat: sum((g) => g.roundsCitingChat), citedOutsideChat: sum((g) => g.citedOutsideChat.length), bannedShown: ok.filter((g) => g.banned).length,
  modes: Object.fromEntries(tally(ok.map((g) => g.mode))),
};

// ---- 3. unlock lines: every chat plays its game to the end as its members ----
const choiceFor = (r, i) => { const ids = r.options.map((o) => o.id); return r.kind === "points" ? { [ids[0]]: 7, [ids[1]]: 3 } : r.kind === "split" ? { pick: ids[i % 2], predict: ids[0] } : r.kind === "rank" ? ids : ids[i % ids.length]; };
const played = [...new Set(ok.map((g) => g.chat))];
const playErrors = [];
let finishes = 0;
for (const id of played) {
  const info = await chatOf(id);
  const game = info?.games.find((g) => g.today);
  if (!game) continue;
  for (const [i, m] of info.members.entries()) {
    for (const r of game.rounds) { const a = await post(`/api/play/games/${game.id}`, { action: "answer", roundId: r.id, choice: choiceFor(r, i), ms: 4000 }, m.id); if (a.error) playErrors.push(`${id} ${m.id} ${r.id}: ${a.error}`); }
    const done = await post(`/api/play/games/${game.id}`, { action: "complete" }, m.id);
    if (done.error) playErrors.push(`${id} ${m.id} complete: ${done.error}`); else finishes++;
    if (i < 2) await post(`/api/play/games/${game.id}`, { action: "react", emoji: "🔥" }, m.id);
  }
}
const going = new Map((await get("/api/admin/dump?what=events", "maya")).map((e) => [e.id, e.going]));
const dayOf = (g) => (g.date === today() ? "today" : new Date(g.date + "T12:00:00").toLocaleString("en-US", { weekday: "long" }));
// A fact is counted when the card is made; members who finished after that are left out of the recount.
const finishedAt = new Map((await inspectAll()).events.filter((e) => e.kind === "complete").map((e) => [`${e.gameId}|${e.userId}`, e.at]));
const doneBy = (g, u) => g.completed.filter((id) => (finishedAt.get(`${g.id}|${id}`) ?? "") <= u.createdAt);
/** Recount one of code's facts from the inspector's raw answers (players who had finished by then). undefined = not a counted pattern. */
function recount(chat, u, fact) {
  let m;
  if ((m = fact.match(/^(\d+) of (\d+) points went to this in (\w+)'s Wager$/))) {
    for (const g of chat.games) for (const r of g.format === "wager" && dayOf(g) === m[3] ? g.rounds : []) {
      const o = r.options.find((x) => x.ref?.id === u.refId);
      const done = doneBy(g, u).map((id) => g.answers[id]?.[r.id]).filter(Boolean);
      if (o && done.length) { const pts = done.reduce((s, c) => s + (c[o.id] ?? 0), 0), total = done.reduce((s, c) => s + Object.values(c).reduce((a, b) => a + b, 0), 0); return { ok: pts === +m[1] && total === +m[2], counted: `${pts} of ${total}` }; }
    }
    return { ok: false, counted: "no such Wager" };
  }
  if ((m = fact.match(/^(\d+) of (\d+) of you picked (.+) in (\w+)'s (Split|Blend)$/))) {
    for (const g of chat.games) for (const r of g.formatLabel === m[5] && dayOf(g) === m[4] ? g.rounds : []) {
      const o = r.options.find((x) => x.label === m[3]);
      const picks = doneBy(g, u).map((id) => g.answers[id]?.[r.id]).filter((c) => c !== undefined).map((c) => (typeof c === "string" ? c : c.pick));
      if (o && picks.filter((p) => p === o.id).length === +m[1] && picks.length === +m[2]) return { ok: true, counted: `${m[1]} of ${m[2]}` };
    }
    return { ok: false, counted: "no round with that count" };
  }
  if ((m = fact.match(/^(\d+)-day streak$/))) return { ok: chat.streakDays === +m[1], counted: `${chat.streakDays}` };
  if ((m = fact.match(/^(\d+) of you (?:is|are) already going$/)) && going.has(u.refId)) { const k = chat.members.filter((x) => going.get(u.refId).includes(x.id)).length; return { ok: k === +m[1], counted: `${k}` }; }
  return undefined;
}
const unlocks = [];
for (const id of played) {
  const chat = await chatOf(id);
  for (const u of chat?.unlocks ?? []) {
    if (u.mode === "seed") continue;
    const copied = u.facts.filter((f) => u.why.toLowerCase().includes(f.toLowerCase()));
    const rest = copied.reduce((s, f) => s.replace(f.toLowerCase(), " "), u.why.toLowerCase()).split(u.title.toLowerCase()).join(" ");
    const recounts = copied.map((f) => ({ fact: f, ...(recount(chat, u, f) ?? { ok: null, counted: "not a counted pattern" }) }));
    const row = { chat: id, tier: u.tier, item: u.title, score: u.score, why: u.why, facts: u.facts, mode: u.mode, modelLineRefused: u.refused ?? null, copiesAFact: copied.length > 0, numberOutsideFact: /\d/.test(rest), recounts, banned: BANNED.test(u.why), costUsd: u.costUsd };
    row.checksOut = row.copiesAFact && !row.numberOutsideFact && !row.banned && recounts.every((r) => r.ok !== false);
    unlocks.push(row);
    console.log(`unlock ${id}: ${u.tier} "${u.title}" at ${u.score} [${u.mode}] · "${u.why}"${u.refused ? ` (model line refused: ${u.refused})` : ""} · recount: ${recounts.map((r) => (r.ok === null ? "n/a" : r.ok ? `${r.counted} ✓` : `${r.counted} ✗`)).join(", ") || "nothing copied"}`);
  }
}
const counted = unlocks.flatMap((u) => u.recounts).filter((r) => r.ok !== null);
const un = { chatsPlayed: played.length, finishes, playErrors, unlocks: unlocks.length, checkOut: unlocks.filter((u) => u.checksOut).length, factsRecounted: counted.length, factsRecountedOk: counted.filter((r) => r.ok).length, modelLinesRefused: unlocks.filter((u) => u.modelLineRefused).length };

// ---- 4. mode and cost ----
const status1 = await get("/api/ai/status", "maya");
const traced = +(sum((g) => g.costUsd ?? 0) + unlocks.reduce((n, u) => n + (u.costUsd ?? 0), 0)).toFixed(4);
const cost = { mode: status0.mode, dryRun: MOCK, tracedUsd: traced, ledgerUsd: +(status1.budget.committedUsd - status0.budget.committedUsd).toFixed(4), ledgerNowUsd: +status1.budget.committedUsd.toFixed(4), ledgerLimitUsd: status1.budget.limitUsd, modelCalls: status1.calls - status0.calls };

const out = { ranAt: new Date().toISOString(), base: BASE, mode: status0.mode, dryRun: MOCK, seconds: Math.round((Date.now() - t0) / 1000), cap: CAP, minMessages: MIN_MESSAGES, chats: { seeded: all.length, eligible: eligible.length, pairs: pairs.length, generatedFor: played }, skipped, generation: gen, unlockLines: un, cost, games, unlocks };
mkdirSync("eval", { recursive: true });
writeFileSync("eval/play.json", JSON.stringify(out, null, 1));

const rows = (o) => Object.entries(o).map(([k, v]) => `| ${cell(k)} | ${v} |`).join("\n");
const md = `# Chat Games eval${MOCK ? " — MOCK DRY RUN" : ""}

${MOCK
    ? `> **Mock dry run. No model was called and nothing was spent.** The server ran with \`AI_MODE=mock\`, so every game below is the code-built template and every unlock line is the mock line. These numbers show that selection, validation, play, scoring and unlocks hold together end to end. They say nothing about how well Muse writes a game. For that, run \`npm run eval:play\` against a live dev server (about ${CAP} to ${2 * CAP + 2} model calls at the default cap).`
    : `Live Muse unless a row says otherwise (\`cached\` = served from the cache at $0, \`fallback\` = the code-built template).`}

Ran ${out.ranAt.slice(0, 16).replace("T", " ")} UTC against ${BASE}, mode **${status0.mode}**, ${out.seconds}s. Re-run: \`npm run eval:play\` (\`EVAL_CHATS=n\` sets the cap on games, default 6).

## What was run

${all.length} seeded chats. ${eligible.length} have ${MIN_MESSAGES} or more messages of their own, which makes ${pairs.length} chat × format pairs (Lineup and Hot Seat need three people). The cap is ${CAP} games, spread so each pick uses the chat and the format used least so far. Each game is generated through \`POST /api/play/dev\` with the format forced; code still picks the topic and the sources.

- Generated: ${plan.map((p) => `${p.chat.id} · ${LABEL[p.format]}`).join(", ")}
- Left out by the cap: ${skipped.byCap.length} pairs${skipped.chatsNotReached.length ? `. Chats not reached at all: ${skipped.chatsNotReached.join(", ")}` : ""}
- Left out for too little material: ${skipped.tooLittleMaterial.join(", ") || "none"}

## 1. Generation (${gen.generated} games)

| | |
|---|---|
| Passed validation in the format asked for, no fallback | **${pct(gen.passed, gen.generated)}** |
| Fell back to the template after the draft was refused | ${gen.fellBack} |
| Chat could not support the format, so code switched to Split | ${gen.chatCouldNotSupport} |
| Errors | ${gen.errors} |
| Rounds kept | **${gen.roundsKept}** |
| Rounds dropped by code | **${gen.roundsDropped}** |
| Other things code refused (an option, a pitch, a title, an unknown id) | ${Object.values(gen.otherRefusals).reduce((a, b) => a + b, 0)} |
| Games with a mood / health / guilt word on screen | **${gen.bannedShown} / ${gen.generated}** |

${gen.roundsDropped ? `Why rounds were dropped:\n\n| reason | rounds |\n|---|---|\n${rows(gen.roundDropReasons)}\n` : "No round was dropped."}
${Object.keys(gen.otherRefusals).length ? `\nWhat else code refused:\n\n| reason | times |\n|---|---|\n${rows(gen.otherRefusals)}\n` : ""}
A dropped round is the check working: the game ships with what passed, or falls back to the template, and nothing unverified is shown.

## 2. Grounding (${gen.roundsKept} rounds)

| | |
|---|---|
| Rounds citing a line a member of that chat wrote (a message in that thread, a post, a Reel) | **${pct(gen.roundsCitingChat, gen.roundsKept)}** |
| Rounds citing anything in the chat's index (adds members' interests and the real events / groups / listings of a Wager) | ${pct(gen.roundsCiting, gen.roundsKept)} |
| Citations that are not in that chat's thread or not by one of its members | **${gen.citedOutsideChat}** |

The script checks this itself: a cited message has to be in that conversation, from that sender; a cited post has to be by a member. A Wager's single round cites the three real things on offer, so it counts in the second row and only counts in the first if it also cites a line.

<details><summary>Every game</summary>

| chat | asked | got | topic | title | mode | kept | dropped | cites chat lines | refused by code |
|---|---|---|---|---|---|---|---|---|---|
${games.map((g) => (g.error ? `| ${g.chat} | ${LABEL[g.asked]} | error | | ${cell(g.error)} | | | | | |` : `| ${g.chat} (${g.members}) | ${LABEL[g.asked]} | ${LABEL[g.got]}${g.passed ? "" : g.unsupported ? " (chat can't support it)" : " (fallback)"} | ${g.topic} | ${cell(g.title)} | ${g.mode} | ${g.rounds} | ${g.roundsDropped} | ${g.roundsCitingChat} / ${g.rounds} | ${cell(g.refusedRaw.join("; "))} |`)).join("\n")}

</details>

## 3. Unlock lines (${un.unlocks} cards)

Each of the ${un.chatsPlayed} chats then played its game to the end as its real members (${un.finishes} finishes, ${un.playErrors.length} errors). A chat only gets a card when its score and a settled topic have earned one, so cards come from the chats with seeded play history; one card a day per chat.

| | |
|---|---|
| Why lines whose numbers check out (copies one of code's counted facts word for word, no number outside it, recount agrees) | **${pct(un.checkOut, un.unlocks)}** |
| Counted facts the script recounted from the raw answers and got the same numbers | ${pct(un.factsRecountedOk, un.factsRecounted)} |
| Model lines code refused and replaced with the fact | ${un.modelLinesRefused} |

| chat | unlocked | at score | line on the card | recount | mode |
|---|---|---|---|---|---|
${unlocks.map((u) => `| ${u.chat} | ${u.tier}: ${cell(u.item)} | ${u.score} | ${cell(u.why)}${u.modelLineRefused ? ` (model line refused: ${cell(u.modelLineRefused)})` : ""} | ${u.recounts.map((r) => (r.ok === null ? "not a counted pattern" : `${r.counted} ${r.ok ? "agrees" : "DISAGREES"}`)).join("; ") || "nothing copied"} | ${u.mode} |`).join("\n") || "| (none) | | | | | |"}
${un.playErrors.length ? `\nPlay errors:\n\n${un.playErrors.map((e) => `- ${e}`).join("\n")}\n` : ""}
## 4. Mode and cost

| | |
|---|---|
| Mode | **${status0.mode}**${MOCK ? " (dry run)" : ""} |
| Game modes | ${Object.entries(gen.modes).map(([k, v]) => `${v}× ${k}`).join(", ")} |
| Calls through the Muse client during the run | ${cost.modelCalls}${MOCK ? " (all answered by the mock, none sent)" : ""} |
| Cost of this run, from the games and unlocks | $${cost.tracedUsd} |
| Cost of this run, from the ledger (\`/api/ai/status\`, includes its safety margin) | $${cost.ledgerUsd} |
| Ledger after the run | $${cost.ledgerNowUsd} of the $${cost.ledgerLimitUsd} limit |

## Limits

- Seeded world. ${eligible.length} chats have enough to go on and only two of them (c_volleyball, c_maya_jordan) have play history, so unlock lines are a sample of at most two per run.
- "Passed" is code's verdict (ids real, quotes found in the source, caps, word list, format rules). It is not a human rating of whether the game is fun; read the titles.
- The cap decides coverage. At ${CAP} of ${pairs.length} pairs, most chat × format pairs were not generated; they are listed in \`eval/play.json\` under \`skipped\`.${MOCK ? "\n- Mock mode: the draft is the template built from the same store data the checks read, so it passing is expected. A live run is where rounds get dropped." : ""}
`;
writeFileSync("EVAL-PLAY.md", md);

console.log(`\n${MOCK ? "MOCK DRY RUN (no model called). " : ""}Mode ${status0.mode}.`);
console.log(`Games passing validation in the format asked for, no fallback: ${pct(gen.passed, gen.generated)} (fell back: ${gen.fellBack}, chat couldn't support the format: ${gen.chatCouldNotSupport}, errors: ${gen.errors})`);
console.log(`Rounds kept ${gen.roundsKept}, dropped ${gen.roundsDropped}${gen.roundsDropped ? ` (${tally(ok.flatMap((g) => g.roundDropReasons)).map(([k, v]) => `${v}× ${k}`).join("; ")})` : ""}; other refusals ${Object.values(gen.otherRefusals).reduce((a, b) => a + b, 0)}; games with a banned word on screen: ${gen.bannedShown}`);
console.log(`Rounds citing the chat's own lines: ${pct(gen.roundsCitingChat, gen.roundsKept)}; citing anything in its index: ${pct(gen.roundsCiting, gen.roundsKept)}; citations from outside the chat: ${gen.citedOutsideChat}`);
console.log(`Unlock why lines whose numbers check out: ${pct(un.checkOut, un.unlocks)} (facts recounted from raw answers: ${pct(un.factsRecountedOk, un.factsRecounted)}; model lines refused: ${un.modelLinesRefused}; play errors: ${un.playErrors.length})`);
console.log(`Cost: $${cost.tracedUsd} traced, $${cost.ledgerUsd} on the ledger, ${cost.modelCalls} calls through the Muse client${MOCK ? " (all mock, none sent)" : ""}, ${out.seconds}s → eval/play.json, EVAL-PLAY.md`);
if (gen.errors || gen.citedOutsideChat || gen.bannedShown || un.playErrors.length || un.checkOut !== un.unlocks) process.exitCode = 1;
