// Reconnect eval. Live against the dev server (http://localhost:3000).
//   npm run eval:reconnect            → eval/reconnect.json + EVAL-RECONNECT.md
// Three things, each a number the pitch can quote:
//   1. Why-now grounding: for N (viewer, drifted friend) pairs, how often Muse's citations survive the code check,
//      how often a nudge is dropped (and why), zero banned words on anything shown.
//   2. Plan grounding: for a few targets, every person/event/ride id in a rendered plan exists and is visible to
//      the viewer; every dollar equals the sum of its code-computed lines; no model-written prices.
//   3. Reactivation, code only, over every user in the seed: friends asleep, with history, with a fresh post.
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const H = (u) => ({ "content-type": "application/json", "x-user-id": u });
const get = (p, u) => fetch(`${BASE}${p}`, { headers: H(u) }).then((r) => r.json());
const post = (p, b, u) => fetch(`${BASE}${p}`, { method: "POST", headers: H(u), body: JSON.stringify(b) }).then((r) => r.json());
async function sse(p, b, u) {
  const text = await (await fetch(`${BASE}${p}`, { method: "POST", headers: H(u), body: JSON.stringify(b) })).text();
  let result;
  for (const chunk of text.split("\n\n")) { const ev = chunk.match(/^event: (.+)$/m)?.[1]; const data = chunk.match(/^data: (.+)$/m)?.[1]; if (ev === "result") result = JSON.parse(data); if (ev === "error") throw new Error(JSON.parse(data).message); }
  return result;
}
const BANNED = /\b(depress\w*|anxi\w*|lonely|loneliness|grie\w+|sick|illness|hospital|therap\w*|mental|struggl\w*|miss(?:ing|ed|es)?\s+you|too long|guilt\w*|sorry for|you never|should have)\b/i;
const MONEY = /\$\s?\d|\b\d+\s?(dollars|bucks)\b/i;

await post("/api/admin/reset", {}, "maya");
const dump = { users: await get("/api/admin/dump?what=users", "maya"), events: await get("/api/admin/dump?what=events", "maya"), rides: await get("/api/admin/dump?what=rides", "maya") };
const users = dump.users;
const t0 = Date.now();

// 1. why-now over drifted pairs with shared history (the only pairs a nudge can exist for)
const viewers = ["maya", "nadia", "cole", "priya", "jordan", "kai", "harper", "arjun"];
const pairs = [];
for (const v of viewers) {
  const d = await get("/api/reconnect/drift", v);
  for (const c of d.people.filter((c) => c.state !== "awake" && c.sharedCount > 0).slice(0, 3)) pairs.push([v, c.friendId]);
}
const whynow = [];
for (const [v, f] of pairs) {
  const r = await post("/api/reconnect/whynow", { personId: f, force: true }, v);
  const n = r.nudge;
  whynow.push({ viewer: v, friend: f, shown: !!n, line: n?.line, evidenceIds: n?.evidenceIds, mode: n?.mode, dropped: n ? undefined : r.reason, banned: n ? BANNED.test(n.line) : false, citedShared: n ? n.evidenceIds.every((id) => r.index.some((e) => e.id === id)) : null, indexSize: r.index.length });
  process.stdout.write(`whynow ${v}→${f}: ${n ? `"${n.line}" [${n.evidenceIds.join(",")}]` : `dropped: ${r.reason}`}\n`);
}
const shown = whynow.filter((w) => w.shown);
const wn = { pairs: whynow.length, shown: shown.length, dropped: whynow.filter((w) => !w.shown).length, dropReasons: Object.fromEntries(Object.entries(whynow.filter((w) => !w.shown).reduce((m, w) => ((m[w.dropped] = (m[w.dropped] ?? 0) + 1), m), {}))), bannedShown: shown.filter((w) => w.banned).length, citedSharedShown: shown.filter((w) => w.citedShared).length };

// 2. plans
const targets = [["maya", ["nadia"]], ["maya", ["cole", "harper", "kenji", "tess", "bri"]], ["priya", ["raj"]], ["cole", ["maya"]]];
const plans = [];
for (const [v, ids] of targets) {
  const me = users.find((u) => u.id === v);
  const visible = new Set([...me.friendIds, ...me.friendIds.flatMap((f) => users.find((u) => u.id === f)?.friendIds ?? [])]);
  let res;
  try { res = await sse("/api/reconnect/plan", { personIds: ids }, v); } catch (e) { plans.push({ viewer: v, ids, error: e.message }); continue; }
  for (const p of res.plans) {
    const peopleOk = p.people.every((x) => visible.has(x.id));
    const eventOk = !p.event || dump.events.some((e) => e.id === p.event.id);
    const rideOk = !p.ride || dump.rides.some((r) => r.id === p.ride.id);
    const sum = p.cost.lines.reduce((n, l) => n + l.usd, 0);
    plans.push({ viewer: v, ids, shape: p.shape, title: p.title, start: p.start, each: p.cost.each, peopleOk, eventOk, rideOk, costAddsUp: sum === p.cost.each, modelMoney: MONEY.test(p.title + " " + p.pitch + " " + p.reasons.join(" ")), repairs: p.repairs, mode: res.mode, latencyMs: res.latencyMs, costUsd: res.costUsd });
    process.stdout.write(`plan ${v}→${ids.join(",")}: ${p.shape} "${p.title}" ${p.start} $${p.cost.each} people=${peopleOk} event=${eventOk} ride=${rideOk} adds=${sum === p.cost.each}\n`);
  }
  if (!res.plans.length) process.stdout.write(`plan ${v}→${ids.join(",")}: declined: ${res.declineReason}\n`);
}
const rendered = plans.filter((p) => !p.error);
const pl = { targets: targets.length, plans: rendered.length, allIdsReal: rendered.filter((p) => p.peopleOk && p.eventOk && p.rideOk).length, costAddsUp: rendered.filter((p) => p.costAddsUp).length, modelMoney: rendered.filter((p) => p.modelMoney).length, avgLatencyMs: Math.round(rendered.reduce((n, p) => n + p.latencyMs, 0) / Math.max(1, rendered.length)), costUsd: +rendered.reduce((n, p) => n + (p.costUsd ?? 0), 0).toFixed(3) };

// 3. reactivation over the whole seed, code only
const react = [];
for (const u of users) {
  const d = await get("/api/reconnect/drift", u.id);
  react.push({ id: u.id, ...d.stats });
}
const tot = (k) => react.reduce((n, r) => n + r[k], 0);
const rx = { users: react.length, friends: tot("friends"), asleep: tot("asleep"), napping: tot("napping"), withHistory: tot("withHistory"), withTrigger: tot("withTrigger"), asleepShare: +(tot("asleep") / Math.max(1, tot("friends"))).toFixed(2) };

const out = { ranAt: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), whynow: { summary: wn, rows: whynow }, plans: { summary: pl, rows: plans }, reactivation: { summary: rx, rows: react } };
mkdirSync("eval", { recursive: true });
writeFileSync("eval/reconnect.json", JSON.stringify(out, null, 2));
const md = `# Reconnect eval

Ran ${out.ranAt.slice(0, 16).replace("T", " ")} UTC against the dev server, live Muse unless a row says otherwise. ${out.seconds}s. Re-run: \`npm run eval:reconnect\`.

## 1. Why-now grounding (${wn.pairs} drifted pairs with shared history)

| | |
|---|---|
| Nudges shown | **${wn.shown} / ${wn.pairs}** |
| Dropped by code | ${wn.dropped}${wn.dropped ? ` (${Object.entries(wn.dropReasons).map(([k, v]) => `${v}× ${k}`).join(", ")})` : ""} |
| Shown lines whose every citation is real and includes both people | **${wn.citedSharedShown} / ${wn.shown}** (code check; the rest were dropped, not shown) |
| Shown lines with a mood / health / guilt word | **${wn.bannedShown} / ${wn.shown}** |

A dropped nudge is a success of the guardrail, not a failure of the product: nothing is better than a made-up reason.

<details><summary>Every pair</summary>

| viewer → friend | shown | line | cited | mode |
|---|---|---|---|---|
${whynow.map((w) => `| ${w.viewer} → ${w.friend} | ${w.shown ? "yes" : `no: ${w.dropped}`} | ${w.line ? w.line.replace(/\|/g, "/") : ""} | ${w.evidenceIds?.join(", ") ?? ""} | ${w.mode ?? ""} |`).join("\n")}

</details>

## 2. Plan grounding (${pl.targets} targets, ${pl.plans} rendered plans)

| | |
|---|---|
| Plans whose every person, event and ride id exists and is visible to the viewer | **${pl.allIdsReal} / ${pl.plans}** |
| Plans whose per-person cost equals the sum of its code-computed lines | **${pl.costAddsUp} / ${pl.plans}** |
| Plans with a model-written dollar figure in title / pitch / reasons | **${pl.modelMoney} / ${pl.plans}** |
| Average agent latency | ${(pl.avgLatencyMs / 1000).toFixed(1)}s |
| Model cost for this section | $${pl.costUsd} |

<details><summary>Every plan</summary>

| viewer → target | shape | title | when | each | ids real | adds up | repairs |
|---|---|---|---|---|---|---|---|
${plans.map((p) => p.error ? `| ${p.viewer} → ${p.ids.join(",")} | error | ${p.error} | | | | | |` : `| ${p.viewer} → ${p.ids.join(",")} | ${p.shape} | ${p.title.replace(/\|/g, "/")} | ${p.start} | $${p.each} | ${p.peopleOk && p.eventOk && p.rideOk ? "yes" : "NO"} | ${p.costAddsUp ? "yes" : "NO"} | ${p.repairs.join("; ").replace(/\|/g, "/")} |`).join("\n")}

</details>

## 3. Reactivation, code only, whole seed (${rx.users} people)

| | |
|---|---|
| Friendships | ${rx.friends} |
| Asleep (past their rhythm) | **${rx.asleep}** (${Math.round(rx.asleepShare * 100)}%) |
| Napping | ${rx.napping} |
| Asleep with shared history a nudge can cite | ${rx.withHistory} |
| Asleep with a fresh post to hang a nudge on | ${rx.withTrigger} |

Rhythm = median gap between real exchanges over the last 180 days (two-way chats within 48h, events both went to, photos both tagged in; likes never count), clamped 7–120, default 30. These are seed numbers; the point is that the computation is code and runs on data Facebook already has.

## Limits

- Seeded world, ~60 people. Drift states depend on how the seed's timestamps fall relative to today.
- "Shown" counts code's verdict, not a human rating of whether the line is good; read the table.
- Plans are validated for grounding, not for whether a human would say yes. Availability for unknowns is honest "we'll ask".
`;
writeFileSync("EVAL-RECONNECT.md", md);
console.log(JSON.stringify({ whynow: wn, plans: pl, reactivation: rx, seconds: out.seconds }, null, 1));
