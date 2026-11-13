// End-to-end QA for Chat Games, against the dev server. Exits non-zero on the first failed check.
//   node scripts/qa-play.mjs            (QA_BASE=http://localhost:3111 to point it at another port; BASE works too)
// Plays as real members of the seeded group chat c_volleyball (devon, tyler, marcus, nina, grace, ethan, sam,
// jordan); maya and nadia are NOT in that chat. The Event card needs a majority (5 of 8) to finish today's game.
// Two games are generated (the group chat's and one DM's) and two unlock lines are written; everything else
// is code. Resets the demo before it starts and again at the end (the last checks are that reset clears everything).
//   QA_KEEP=1 node scripts/qa-play.mjs  stops before those last checks and leaves the played state up for a demo:
//                                       c_volleyball past 60 with its Event card, the DM with a card of its own.
const BASE = process.env.QA_BASE ?? process.env.BASE ?? "http://localhost:3000";
const H = (u) => ({ "content-type": "application/json", "x-user-id": u });
const call = async (method, p, u, b) => { const r = await fetch(`${BASE}${p}`, { method, headers: H(u), body: b === undefined ? undefined : JSON.stringify(b) }); return { status: r.status, body: await r.json().catch(() => null) }; };
const get = async (p, u) => (await call("GET", p, u)).body;
const post = async (p, b, u) => (await call("POST", p, u, b)).body;
let n = 0;
const check = (ok, what, extra = "") => { n++; console.log(`${ok ? "PASS" : "FAIL"} ${n}. ${what}${extra ? ` · ${extra}` : ""}`); if (!ok) process.exit(1); };
const keys = (v, out = new Set()) => { if (Array.isArray(v)) v.forEach((x) => keys(x, out)); else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.add(k); keys(x, out); } return out; };
const hasNumber = (v) => typeof v === "number" || (!!v && typeof v === "object" && Object.values(v).some(hasNumber));
/** Objects that name someone other than the viewer and carry a number: what a leaked per-member score would look like. */
const numbersOnOthers = (v, me, members, out = []) => {
  if (Array.isArray(v)) v.forEach((x) => numbersOnOthers(x, me, members, out));
  else if (v && typeof v === "object") {
    const who = [v.id, v.userId].find((x) => typeof x === "string" && members.includes(x) && x !== me);
    if (who && hasNumber(v)) out.push(who);
    Object.values(v).forEach((x) => numbersOnOthers(x, me, members, out));
  }
  return out;
};
const t0 = Date.now();
const VB = "c_volleyball";
const DM = "c_maya_jordan";
const CREW = ["devon", "sam", "tyler", "marcus", "grace", "nina", "ethan", "jordan"];
const cards = async (conv, u, type) => ((await get(`/api/conversations/${conv}`, u)).messages ?? []).filter((m) => m.attachment?.type === type);
const inspectChat = async (id) => (await get("/api/play/inspect", "devon")).chats.find((c) => c.conversationId === id);

const up = await call("GET", "/api/ai/status", "maya").catch(() => null);
if (!up || up.status !== 200) { console.error(`No dev server at ${BASE}. Start one (npm run dev) or set QA_BASE.`); process.exit(1); }
console.log(`Chat Games QA against ${BASE} · Muse mode: ${up.body.mode}\n`);

await post("/api/admin/reset", {}, "maya");
const totals0 = (await get("/api/play/inspect", "maya")).totals;
const cards0 = (await cards(VB, "devon", "game")).length;

// ---- the daily drop: once per chat per day ----
check((await get(`/api/play/daily/${VB}`, "maya")).game === null && (await cards(VB, "devon", "game")).length === cards0, "someone outside the chat gets no game and triggers none");
const [a, b] = await Promise.all([get(`/api/play/daily/${VB}`, "devon"), get(`/api/play/daily/${VB}`, "sam")]);
check(a.game?.id && a.game.id === b.game?.id, "two members opening the group chat at once share one game", `${a.game?.formatLabel}: "${a.game?.title}" (${a.game?.mode})`);
check((await get(`/api/play/daily/${VB}`, "nina")).game.id === a.game.id && (await cards(VB, "nina", "game")).length === cards0 + 1, "asked again, the same game: one per chat per day, one card in the thread");
const game = a.game;
check(game.rounds.length >= 1 && game.rounds.every((r) => !("answer" in r) && r.evidenceIds.length === 0) && game.results === undefined && game.madeFrom === undefined, "before playing: no answers, no sources, no results");

// ---- members only ----
const outsider = [await call("GET", `/api/play/games/${game.id}`, "maya"), await call("POST", `/api/play/games/${game.id}`, "maya", { action: "open" }), await call("GET", `/api/play/chat/${VB}`, "maya"), await call("POST", `/api/play/chat/${VB}`, "maya", { action: "mute" })];
check(outsider.every((r) => r.status === 404 && r.body?.error), "a non-member gets 404 for the game, for playing it, for the chat's score and for muting it", outsider.map((r) => r.status).join(" "));
check((await call("GET", "/api/play/games/pg_nope", "devon")).status === 404, "a game that doesn't exist is 404");

// ---- the score bar, and what a member may see of it ----
const before = await get(`/api/play/chat/${VB}`, "devon");
check(before.score < 60 && before.next?.tier === "event" && before.unlocks.length === 1 && !before.muted, "the seeded chat sits under the Event unlock with its Group already unlocked", `score ${before.score}, streak ${before.streakDays}`);
check(before.topics.length > 0 && before.topics.every((t) => !("score" in t)), "chat topics carry names and game counts, no score", before.topics.map((t) => t.label).join(", "));
const banned = ["affinity", "engagement", "observations", "raw", "answers", "facts", "dropped", "evidence", "costUsd", "responses"];
check([...keys(before), ...keys(game)].every((k) => !banned.includes(k)), "no per-member numbers or internals in what a member receives");
const asSam = await get(`/api/play/chat/${VB}`, "sam");
check(numbersOnOthers(before, "devon", CREW).length === 0 && numbersOnOthers(asSam, "sam", CREW).length === 0, "the chat view never puts a number on another member");
const dev0 = await inspectChat(VB);
const own = (u) => Object.fromEntries(dev0.affinity.find((x) => x.user.id === u).topics.map((t) => [t.topic, t.score]));
const isOwn = (view, u) => view.myTopics.length > 0 && view.myTopics.every((t) => own(u)[t.topic] === t.score);
check(isOwn(before, "devon") && isOwn(asSam, "sam"), "the only topic numbers in it are the viewer's own", `devon: ${before.myTopics.map((t) => `${t.topic} ${t.score}`).join(", ")}`);
const shared = (v) => JSON.stringify({ ...v, myTopics: null, unlocks: v.unlocks.map((u) => ({ ...u, my: null })) });
check(shared(before) === shared(asSam), "everything else in it is the same for every member (chat totals only)");

// ---- an empty DM gets no game and stays out of the other person's inbox ----
const empty = (c) => !!c.error || c.messages?.length === 0; // a thread with nothing visible in it reads as not found
let dm, other;
for (const u of (await get("/api/admin/dump?what=users", "maya")).map((x) => x.id).filter((id) => !CREW.includes(id))) {
  const id = (await post(`/api/conversations/with/${u}`, {}, "ethan")).id; // what "Message" on a profile does
  if (id && empty(await get(`/api/conversations/${id}`, "ethan"))) { dm = id; other = u; break; }
}
check(!!dm, "found someone Ethan has never messaged", other);
check((await get(`/api/play/daily/${dm}`, "ethan")).game === null && empty(await get(`/api/conversations/${dm}`, "ethan")), "opening an empty DM makes no game and posts no card");
check(!(await get("/api/conversations", other)).some((c) => c.id === dm), "so the thread does not appear in the other person's inbox");

// ---- invalid choices: 400, and nothing is stored. One past game per round kind, as a member who hasn't finished it. ----
const wrong = {
  pick: (ids) => ["not-an-option", [ids[0]], { pick: ids[0], predict: ids[0] }, null],
  split: (ids) => [ids[0], { pick: ids[0] }, { pick: ids[0], predict: "not-an-option" }, { pick: "not-an-option", predict: ids[0] }],
  rank: (ids) => [ids.slice(1), [...ids.slice(1), ids[1]], [...ids, ids[0]], [...ids.slice(1), "not-an-option"], ids[0]],
  points: (ids) => [{ [ids[0]]: 6, [ids[1]]: 3 }, { [ids[0]]: 11, [ids[1]]: -1 }, { [ids[0]]: 9.5, [ids[1]]: 0.5 }, { [ids[0]]: 5, "not-an-option": 5 }, { [ids[0]]: "10" }, ids, "10"],
};
for (const kind of ["pick", "split", "rank", "points"]) {
  const g = dev0.games.find((x) => !x.today && x.rounds.some((r) => r.kind === kind) && CREW.some((u) => !x.completed.includes(u)));
  const r = g?.rounds.find((x) => x.kind === kind);
  const u = g && CREW.find((x) => !g.completed.includes(x));
  const tries = r ? wrong[kind](r.options.map((o) => o.id)) : [];
  const res = [];
  for (const choice of tries) res.push((await call("POST", `/api/play/games/${g.id}`, u, { action: "answer", roundId: r.id, choice })).status);
  const mine = g ? (await get(`/api/play/games/${g.id}`, u)).mine ?? {} : {};
  check(!!r && res.every((s) => s === 400) && JSON.stringify(mine[r.id]) === JSON.stringify(g.answers[u]?.[r.id]), `${kind}: ${tries.length} malformed choices are each refused with 400 and nothing is stored`, g ? `${g.formatLabel} ${g.id} as ${u}: ${res.join(" ")}` : "no past game of this kind");
}
const bad = [
  await call("POST", `/api/play/games/${game.id}`, "devon", { action: "answer", roundId: game.rounds[0].id, choice: "not-an-option" }),
  await call("POST", `/api/play/games/${game.id}`, "devon", { action: "answer", roundId: "r99", choice: game.rounds[0].options[0].id }),
  await call("POST", `/api/play/games/${game.id}`, "devon", { action: "skip", roundId: "r99" }),
  await call("POST", `/api/play/games/${game.id}`, "devon", { action: "cheat" }),
  await call("POST", `/api/play/games/${game.id}`, "devon", { action: "complete" }), // nothing answered yet
  await call("POST", `/api/play/chat/${VB}`, "devon", { action: "explode" }),
];
check(bad.every((r) => r.status === 400 && r.body?.error), "today's game: a choice off the round, an unknown round, an unknown action and finishing with nothing answered are all 400", bad.map((r) => r.status).join(" "));
check((await call("POST", `/api/play/games/${game.id}`, "devon", { action: "react", emoji: "🔥" })).status === 409, "reacting before finishing is refused (409)");
const still = await get(`/api/play/chat/${VB}`, "devon");
check(still.score === before.score && (await get(`/api/play/games/${game.id}`, "sam")).players.length === 0, "none of that moved the score or counted anyone as having played", `score ${still.score}`);

// ---- five members play, one reacts ----
const choiceFor = (r, i) => {
  const ids = r.options.map((o) => o.id);
  if (r.kind === "points") return { [ids[0]]: 7, [ids[1]]: 3 };
  if (r.kind === "split") return { pick: ids[i % 2], predict: ids[0] };
  if (r.kind === "rank") return ids;
  return ids[i % ids.length];
};
let unlock, unlockedBy, last;
const PLAYERS = CREW.slice(0, 5);
for (const [i, u] of PLAYERS.entries()) {
  await post(`/api/play/games/${game.id}`, { action: "open" }, u);
  for (const r of game.rounds) { const res = await post(`/api/play/games/${game.id}`, { action: "answer", roundId: r.id, choice: choiceFor(r, i), ms: 4000 }, u); if (res.error) check(false, `${u} answers ${r.id}`, res.error); }
  if (i === 0) {
    const peek = await get(`/api/play/games/${game.id}`, "sam");
    check(peek.results === undefined && peek.players.length === 0 && peek.rounds.every((r) => !("answer" in r)), "an answer its player hasn't finished is not shown to anyone, by name or in totals");
  }
  last = await post(`/api/play/games/${game.id}`, { action: "complete" }, u);
  if (i === 0) {
    check(last.game.done && Array.isArray(last.game.results) && last.game.results.length === game.rounds.length && last.game.madeFrom?.length >= 1, "after finishing: results for every round and the lines the game was made from", `${last.game.madeFrom?.length} sources`);
    const peek = await get(`/api/play/games/${game.id}`, "sam");
    check(peek.results === undefined && peek.madeFrom === undefined && peek.players.length === 1, "someone who hasn't finished still sees no results, only who has played");
    const r = await post(`/api/play/games/${game.id}`, { action: "react", emoji: "🔥" }, u);
    check(r.game.reacted === "🔥", "a finished player can react to the results");
    check((await call("POST", `/api/play/games/${game.id}`, u, { action: "answer", roundId: game.rounds[0].id, choice: choiceFor(game.rounds[0], 1) })).status === 409, "nothing can be changed after finishing (409)");
    if (r.unlock) { unlock = r.unlock; unlockedBy = `${u} (reaction)`; }
  }
  if (last.unlock) { unlock = last.unlock; unlockedBy = u; }
}
const after = await get(`/api/play/chat/${VB}`, "devon");
check(after.score > before.score && after.score >= 60, `${PLAYERS.length} of ${CREW.length} played and one reacted: the chat score rose to 60 or more`, `${before.score} → ${after.score}, streak ${before.streakDays} → ${after.streakDays}`);
check(!!unlock && unlock.tier === "event", "crossing 60 unlocked an Event for the chat", unlock ? `${unlock.title} (after ${unlockedBy})` : "none");

// ---- exactly one Event card ----
const eventCards = async () => { const out = []; for (const m of await cards(VB, "nina", "unlock")) { const u = await get(`/api/play/unlocks/${m.attachment.ref}`, "nina"); if (u.tier === "event") out.push(m); } return out; };
const ec = await eventCards();
check(ec.length === 1 && ec[0].attachment.ref === unlock.id && ec[0].system === true, "exactly one Event unlock message in the conversation, and it is this one");
const sixth = await (async (u) => { for (const r of game.rounds) await post(`/api/play/games/${game.id}`, { action: "answer", roundId: r.id, choice: choiceFor(r, 5), ms: 4000 }, u); return post(`/api/play/games/${game.id}`, { action: "complete" }, u); })(CREW[5]);
check(sixth.game?.done && !sixth.unlock && (await eventCards()).length === 1 && (await cards(VB, "nina", "unlock")).length === before.unlocks.length + 1, "a sixth finish posts no second card (one a day per chat)");
check((await call("GET", `/api/play/unlocks/${unlock.id}`, "maya")).status === 404 && (await call("POST", `/api/play/unlocks/${unlock.id}`, "maya", { action: "in" })).status === 404, "a non-member gets 404 for the card and cannot answer it");
check(numbersOnOthers(await get(`/api/play/chat/${VB}`, "sam"), "sam", CREW).length === 0 && [...keys(await get(`/api/play/unlocks/${unlock.id}`, "sam"))].every((k) => !banned.includes(k)), "after playing, the chat view and the card still put no number on another member");

// ---- the why line is one of code's counted facts, word for word ----
const dev = await inspectChat(VB);
const stored = dev.unlocks.find((u) => u.id === unlock.id);
const fact = stored.facts.find((f) => stored.why.toLowerCase().includes(f.toLowerCase()));
const rest = fact ? stored.why.toLowerCase().replace(fact.toLowerCase(), " ").split(stored.title.toLowerCase()).join(" ") : stored.why;
check(!!fact && !/\d/.test(rest), "the why line copies a counted fact and adds no number of its own", `"${stored.why}"`);
if (game.format === "wager" && game.rounds[0].options[0].ref?.kind === "event") check(stored.facts[0].includes("points went to this") && stored.refId === game.rounds[0].options[0].ref?.id, "the card is the item the chat put its points on in today's Wager", stored.facts[0]);
check((await get("/api/notifications", "grace")).some((x) => x.type === "play") && !(await get("/api/notifications", "maya")).some((x) => x.type === "play"), "members are told, nobody else");

// ---- "I'm in" does the real thing, once ----
const ev0 = await get(`/api/events/${unlock.refId}`, "nina");
const joiner = CREW.find((u) => !ev0.going.includes(u));
check(!!joiner && ev0.id === unlock.refId, "the card points at a real event that not everyone is going to yet", `${ev0.title}: ${ev0.going.length} going`);
const mine = await post(`/api/play/unlocks/${unlock.id}`, { action: "in" }, joiner);
const ev1 = await get(`/api/events/${unlock.refId}`, joiner);
check(mine.my === "in" && ev1.going.includes(joiner) && ev1.going.length === ev0.going.length + 1, `${joiner} taps I'm in → a real RSVP on the event`);
const twice = await post(`/api/play/unlocks/${unlock.id}`, { action: "in" }, joiner);
const ev2 = await get(`/api/events/${unlock.refId}`, joiner);
const rsvps = (await get("/api/play/inspect", "devon")).events.filter((e) => e.kind === "rsvp" && e.unlockId === unlock.id && e.userId === joiner);
check(twice.my === "in" && ev2.going.filter((u) => u === joiner).length === 1 && ev2.going.length === ev1.going.length && twice.inMembers.filter((m) => m.id === joiner).length === 1 && rsvps.length === 1, "tapping it again changes nothing: one RSVP, one signal");
check((await get(`/api/play/unlocks/${unlock.id}`, "devon")).inMembers.some((m) => m.id === joiner), "the rest of the chat sees them on the card");
await post(`/api/play/unlocks/${unlock.id}`, { action: "undo" }, joiner);
check(!(await get(`/api/events/${unlock.refId}`, joiner)).going.includes(joiner) && (await get(`/api/play/unlocks/${unlock.id}`, joiner)).my === undefined, "undo takes the RSVP back");
check((await call("POST", `/api/play/unlocks/${unlock.id}`, joiner, { action: "maybe" })).status === 400, "an unknown answer to the card is 400");
await post(`/api/play/unlocks/${unlock.id}`, { action: "in" }, joiner); // left on, so the reset below has a real RSVP to clear

// ---- mute, and the DM's own daily ----
const muted = await post(`/api/play/chat/${DM}`, { action: "mute" }, "maya");
check(muted.muted && (await get(`/api/play/daily/${DM}`, "jordan")).game === null && (await get(`/api/play/daily/${DM}`, "maya")).game === null && (await cards(DM, "maya", "game")).length === 0 && !(await get(`/api/play/chat/${DM}`, "jordan")).todayGameId, "a muted chat gets no daily game, whoever opens it");
const unmuted = await post(`/api/play/chat/${DM}`, { action: "unmute" }, "jordan");
const [d1, d2] = await Promise.all([get(`/api/play/daily/${DM}`, "jordan"), get(`/api/play/daily/${DM}`, "maya")]);
check(!unmuted.muted && !!d1.game && !["lineup", "hotseat"].includes(d1.game.format), "unmuted, the DM gets its own game, in a two-person format", d1.game ? `${d1.game.formatLabel}: "${d1.game.title}" (${d1.game.mode})` : "");
check(d1.game.id === d2.game?.id && d1.game.id !== game.id && (await get(`/api/play/daily/${DM}`, "maya")).game.id === d1.game.id && (await cards(DM, "jordan", "game")).length === 1, "the DM too: both people and a second load share one game and one card");
check((await call("GET", `/api/play/games/${d1.game.id}`, "devon")).status === 404, "the DM's game is 404 for someone in the other chat");

// ---- a chat of two: one person's answers are never read out to the other ----
const dmPlay = async (u) => { for (const r of d1.game.rounds) { const res = await post(`/api/play/games/${d1.game.id}`, { action: "answer", roundId: r.id, choice: choiceFor(r, 0), ms: 4000 }, u); if (res.error) check(false, `${u} answers ${r.id}`, res.error); } return post(`/api/play/games/${d1.game.id}`, { action: "complete" }, u); };
const solo = await dmPlay("jordan");
const mayaSees = await get(`/api/play/chat/${DM}`, "maya");
if (d1.game.format === "wager") check(solo.game.done && !solo.unlock && mayaSees.unlocks.length === 0 && (await cards(DM, "maya", "unlock")).length === 0, "in a chat of two, one person's Wager unlocks nothing yet: the card would tell the other what they wagered");
check(numbersOnOthers(mayaSees, "maya", ["maya", "jordan"]).length === 0 && mayaSees.topics.every((t) => t.games > 0 && !("score" in t)) && [...keys(mayaSees)].every((k) => !banned.includes(k)), "the DM's chat view lists only topics it has played, with no number on the other person");
const both = await dmPlay("maya");
const dmCards = await cards(DM, "jordan", "unlock");
const dmUnlock = solo.unlock ?? both.unlock;
check(!!dmUnlock && dmCards.length === 1 && dmCards[0].attachment.ref === dmUnlock.id, "once both have played, the DM gets a card of its own (its first)", dmUnlock ? `${dmUnlock.tier}: ${dmUnlock.title} · "${dmUnlock.why}"` : "none");
check(dmUnlock.id !== unlock.id && (await call("GET", `/api/play/unlocks/${dmUnlock.id}`, "devon")).status === 404 && (await cards(VB, "devon", "unlock")).every((m) => m.attachment.ref !== dmUnlock.id), "that card stays in the DM: 404 for the group chat's members, nothing posted there");

check((await post(`/api/play/chat/${VB}`, { action: "mute" }, "nina")).muted && (await get(`/api/play/daily/${VB}`, "devon")).game === null, "muting a chat that already has today's game stops handing it out too");
check(!(await post(`/api/play/chat/${VB}`, { action: "unmute" }, "devon")).muted && (await get(`/api/play/daily/${VB}`, "devon")).game?.id === game.id, "unmuted, it is the same game again, not a new one");

if (process.env.QA_KEEP) { console.log(`\nall ${n} checks passed in ${((Date.now() - t0) / 1000).toFixed(1)}s · QA_KEEP is set: stopped before the reset checks, so the played state stays up (open /messages/${VB}?as=jordan)`); process.exit(0); }

// ---- reset clears everything ----
await post("/api/admin/reset", {}, "maya");
const clean = await get(`/api/play/chat/${VB}`, "devon");
const totals1 = (await get("/api/play/inspect", "maya")).totals;
check(clean.score === before.score && clean.streakDays === before.streakDays && !clean.muted && !clean.todayGameId && clean.unlocks.length === before.unlocks.length && clean.next?.tier === "event", "reset: the chat is back at its seeded score, unmuted, with no game today and no Event card", `score ${clean.score}`);
check(JSON.stringify(totals1) === JSON.stringify(totals0), "reset: the play store is back to the seed, nothing more", JSON.stringify(totals1));
check((await call("GET", `/api/play/games/${game.id}`, "devon")).status === 404 && (await call("GET", `/api/play/games/${d1.game.id}`, "maya")).status === 404 && (await call("GET", `/api/play/unlocks/${unlock.id}`, "devon")).status === 404 && (await call("GET", `/api/play/unlocks/${dmUnlock.id}`, "maya")).status === 404, "reset: today's games and both unlocks are gone (404)");
check((await cards(VB, "devon", "game")).length === cards0 && (await cards(DM, "maya", "game")).length === 0 && (await cards(DM, "maya", "unlock")).length === 0 && (await cards(VB, "devon", "unlock")).length === before.unlocks.length, "reset: their cards are out of both threads");
check(!(await get(`/api/events/${unlock.refId}`, joiner)).going.includes(joiner) && !(await get("/api/notifications", "grace")).some((x) => x.type === "play"), "reset: the RSVP and the notifications are gone");

console.log(`\nall ${n} checks passed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
