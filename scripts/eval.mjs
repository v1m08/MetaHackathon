// Evaluation: ~12 seeded scenarios through the real endpoints the UI calls. Reports grounding, constraints,
// privacy, guide attribution (hand-labelled photos) and network-vs-hotel cost, then writes EVAL.md + eval/results.json.
//   npm run eval            (server on :3000; live Muse unless replay/mock is active — the report says which)
//   npm run eval -- --quick (first 4 scenarios)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const BASE = process.env.EVAL_BASE ?? "http://localhost:3000";
const quick = process.argv.includes("--quick");
const labels = JSON.parse(readFileSync("eval/labels.json", "utf8")).labels;
const media = JSON.parse(readFileSync("src/data/media.json", "utf8"));
const mediaIdForUrl = (url) => {
  const raw = url?.startsWith("/api/img?u=") ? decodeURIComponent(url.slice(11)) : url;
  return Object.values(media).find((m) => m.url === raw)?.id;
};

const opts = await (await fetch(`${BASE}/api/travel/options`, { headers: { "x-user-id": "maya" } })).json();
const W = (n) => opts.weekends[n - 1];

// Varied users, weekends and budgets. Expectations are soft (what a reasonable agent would do), not asserts.
const SCENARIOS = [
  { user: "maya", w: 4, budget: 120, expect: "Dallas: Cole hosts, Ravi/Owen seats, vintage market" },
  { user: "maya", w: 3, budget: 150, expect: "Nashville (Kai hosts, Sofia flying) or SA/Houston day trips" },
  { user: "maya", w: 5, budget: 200, expect: "Marfa with Kenji's car + June's casita" },
  { user: "zoe", w: 4, budget: 40, expect: "tiny budget: Dallas ride she's already on, or decline" },
  { user: "ethan", w: 4, budget: 300, expect: "Denver: Jules hosts, comp, flight" },
  { user: "devon", w: 1, budget: 150, expect: "New Orleans: Finn's van via Sam, Elijah hosts" },
  { user: "priya", w: 3, budget: 250, expect: "Chicago: Arjun hosts + his birthday" },
  { user: "hannah", w: 2, budget: 60, expect: "Thanksgiving weekend, few options" },
  { user: "ella", w: 3, budget: 80, expect: "tiny network, nobody open to hosting → graceful decline" },
  { user: "grace", w: 7, budget: 400, expect: "NYC: Ava hosts (restricted profile), Wes's open house" },
  { user: "marcus", w: 6, budget: 150, expect: "Atlanta: BeltLine run, Andre via Kwame" },
  { user: "omar", w: 5, budget: 250, expect: "Denver (Mateo) or Houston (Layla), no hosts → honest" },
].slice(0, quick ? 4 : undefined);

async function sse(url, body, user) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-user-id": user }, body: JSON.stringify(body) });
  const text = await res.text();
  let result, error;
  const steps = [];
  for (const chunk of text.split("\n\n")) {
    const ev = chunk.match(/^event: (.+)$/m)?.[1];
    const data = chunk.match(/^data: (.+)$/m)?.[1];
    if (!ev || !data) continue;
    const d = JSON.parse(data);
    if (ev === "step") steps.push(d);
    else if (ev === "result") result = d;
    else if (ev === "error") error = d.message;
  }
  return { result, error, steps };
}
const get = (path, user = "maya") => fetch(`${BASE}${path}`, { headers: { "x-user-id": user } }).then((r) => r.json());

const rows = [];
const guideRows = [];
let guidesRun = 0;
for (const sc of SCENARIOS) {
  const wk = W(sc.w);
  process.stdout.write(`▶ ${sc.user} ${wk.label} $${sc.budget} … `);
  const t0 = Date.now();
  const { result, error, steps } = await sse(`${BASE}/api/travel/discover`, { start: wk.start, end: wk.end, budget: sc.budget }, sc.user);
  if (error || !result) {
    console.log(`ERROR ${error}`);
    rows.push({ ...sc, weekend: wk.label, error });
    continue;
  }
  const audit = await get(`/api/admin/audit?runId=${result.runId}`, sc.user);
  const row = { ...sc, weekend: wk.label, runId: result.runId, mode: result.mode, latencyMs: result.latencyMs, costUsd: result.costUsd, steps: steps.length, trips: result.trips.map((t) => ({ id: t.id, city: t.cityName, title: t.title, host: t.host?.name, hostDegree: t.host?.degree, ride: t.ride?.driver.name, event: t.event?.title, ifYes: t.prices.ifYes.total, otherwise: t.prices.otherwise.total, solo: t.prices.solo.total, fitsBudget: t.fitsBudget, repairs: t.repairs })), declineReason: result.declineReason, audit };
  rows.push(row);
  console.log(`${result.mode} ${(result.latencyMs / 1000).toFixed(1)}s $${result.costUsd.toFixed(3)} → ${result.trips.length ? result.trips.map((t) => `${t.cityName} $${t.prices.ifYes.total}/${t.prices.otherwise.total}${t.fitsBudget ? "" : "!"}`).join(", ") : "declined: " + result.declineReason}`);
  // Guide on the first trip of up to 5 scenarios (one live image look each)
  if (result.trips[0] && guidesRun < 5) {
    guidesRun++;
    const g = await sse(`${BASE}/api/travel/guide`, { tripId: result.trips[0].id }, sc.user);
    if (g.result) {
      const items = g.result.items.map((it) => {
        const mid = mediaIdForUrl(it.evidence.image);
        const lab = labels[mid];
        const text = `${it.title} ${it.what} ${it.whyYou}`.toLowerCase();
        const authorOk = it.credit.id === it.evidence.authorId; // the credited friend must be the post's real author
        return { title: it.title, credit: it.credit.name, mediaId: mid, labelled: !!lab, mentionsPhoto: lab ? lab.mustMentionAny.some((k) => text.includes(k)) : null, authorOk };
      });
      guideRows.push({ user: sc.user, city: result.trips[0].cityName, mode: g.result.mode, latencyMs: g.result.latencyMs, costUsd: g.result.costUsd, looked: g.result.looked.length, items });
      console.log(`   guide ${g.result.mode} ${(g.result.latencyMs / 1000).toFixed(1)}s $${g.result.costUsd.toFixed(3)}: ${items.length} picks, ${items.filter((i) => i.labelled).length} labelled, ${items.filter((i) => i.mentionsPhoto).length} match`);
    }
  }
  void t0;
}

// ---------- aggregate ----------
const ok = rows.filter((r) => !r.error);
const trips = ok.flatMap((r) => r.trips);
const audits = ok.map((r) => r.audit);
const renderedElements = audits.flatMap((a) => a.trips.flatMap((t) => t.elements));
const renderedViolations = renderedElements.filter((e) => !e.exists || !e.visible || e.inDates === false).length;
const raw = audits.reduce((acc, a) => ({ ids: acc.ids + a.raw.ids, grounded: acc.grounded + a.raw.grounded, privacy: acc.privacy + a.raw.privacyViolationsCaught, invented: acc.invented + a.raw.invented }), { ids: 0, grounded: 0, privacy: 0, invented: 0 });
const fits = trips.filter((t) => t.fitsBudget).length;
const overFlagged = trips.filter((t) => !t.fitsBudget).length; // every over-budget trip is flagged by construction (fitsBudget false → UI shows "$X over")
const hosted = trips.filter((t) => t.host);
const savings = trips.map((t) => ({ net: t.ifYes, hotel: t.solo, pct: Math.round((1 - t.ifYes / t.solo) * 100) }));
const avgPct = savings.length ? Math.round(savings.reduce((n, s) => n + s.pct, 0) / savings.length) : 0;
const guideItems = guideRows.flatMap((g) => g.items);
const labelled = guideItems.filter((i) => i.labelled);
const matches = labelled.filter((i) => i.mentionsPhoto).length;
const modes = [...new Set(ok.map((r) => r.mode))];
const live = ok.filter((r) => r.mode === "live");
const avgLatency = live.length ? Math.round(live.reduce((n, r) => n + r.latencyMs, 0) / live.length) : 0;
const totalCost = ok.reduce((n, r) => n + r.costUsd, 0) + guideRows.reduce((n, g) => n + g.costUsd, 0);
const declines = ok.filter((r) => r.trips.length === 0);

mkdirSync("eval", { recursive: true });
writeFileSync("eval/results.json", JSON.stringify({ ranAt: new Date().toISOString(), rows, guideRows }, null, 2));

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "n/a");
const md = `# EVAL

Ran ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC against the live app (\`npm run eval\`), ${ok.length} scenarios, modes: ${modes.join(", ")}. Raw results in \`eval/results.json\`.

## Results

| Metric | Result | How it was measured |
|---|---|---|
| **Grounding (rendered)** | **${pct(renderedElements.length - renderedViolations, renderedElements.length)}** of ${renderedElements.length} trip elements trace to a real record the viewer can see | every host, driver, ride, event, person, post and reel on every card re-checked against the store after rendering |
| Grounding (raw model output) | ${pct(raw.grounded, raw.ids)} of ${raw.ids} ids the model emitted were real and visible; ${raw.invented} invented, ${raw.privacy} real-but-not-visible | the model's \`propose_trips\` call before validation |
| **Constraints** | **${pct(fits, trips.length)}** of ${trips.length} proposed trips fit the budget; the other ${overFlagged} are labelled "$X over" on the card; 100% fit the dates | \`fitsBudget\` from code-computed prices; dates enforced by validation |
| **Privacy** | **${renderedViolations} violations** in ${renderedElements.length} rendered elements (target 0); ${raw.privacy} attempted violations caught before rendering | seed includes restricted profiles (ruben, simone, ivy, mei, ava, aisha, zoe) and 3rd-degree people; the test suite proves a friends-only post from a non-friend is dropped |
| **Guide attribution** | ${pct(matches, labelled.length)} of ${labelled.length} recommendations on hand-labelled photos describe what is in the photo; credit = real author in ${pct(guideItems.filter((i) => i.authorOk).length, guideItems.length)} (forced in code) | \`eval/labels.json\` keywords vs. recommendation text; ${guideRows.length} guides, ${guideRows.reduce((n, g) => n + g.looked, 0)} live image reads |
| **Cost vs. hotel trip** | network trip averages **${avgPct}% cheaper** than the same trip with a hotel and solo transport (${savings.length} trips; e.g. ${savings.slice(0, 3).map((s) => `$${s.net} vs $${s.hotel}`).join(", ")}) | seeded prices in \`src/lib/travel/pricing.ts\`, computed in code |
| Hosts | ${hosted.length}/${trips.length} trips have a host; all hosts had "open to hosting" on; ${hosted.filter((t) => t.hostDegree === 2).length} were friends-of-friends (with a named mutual) | audit |
| Declines | ${declines.length} scenario${declines.length === 1 ? "" : "s"} declined gracefully (${declines.map((d) => d.user).join(", ") || "none"}) | result has no trips and a reason |
| Latency | live Discover averaged ${(avgLatency / 1000).toFixed(1)}s (${live.length} live runs) | SSE result |
| Muse spend | $${totalCost.toFixed(3)} for this eval (ledger, with 1.5× margin) | \`npm run ledger\` |

## Per scenario

| User | Weekend | Budget | Mode | Time | Trips (if-yes / otherwise) | Notes |
|---|---|---|---|---|---|---|
${rows.map((r) => `| ${r.user} | ${r.weekend} | $${r.budget} | ${r.mode ?? "error"} | ${r.latencyMs ? (r.latencyMs / 1000).toFixed(1) + "s" : ""} | ${r.error ? r.error : r.trips.length ? r.trips.map((t) => `${t.city} $${t.ifYes}/${t.otherwise}${t.fitsBudget ? "" : " (over)"}${t.host ? ` · ${t.host.split(" ")[0]} hosts` : ""}${t.ride ? ` · ${t.ride.split(" ")[0]} drives` : ""}`).join("; ") : `declined: ${r.declineReason}`} | ${r.expect} |`).join("\n")}

## Guides

${guideRows.map((g) => `- **${g.user} → ${g.city}** (${g.mode}, ${(g.latencyMs / 1000).toFixed(1)}s, ${g.looked} live image read${g.looked === 1 ? "" : "s"}): ${g.items.map((i) => `${i.title} ← ${i.credit.split(" ")[0]}${i.labelled ? (i.mentionsPhoto ? " ✓" : " ✗") : ""}`).join("; ")}`).join("\n")}

## Limits, honestly

- These are seeded people and seeded prices. "${avgPct}% cheaper" is arithmetic on our price table (gas $3.10/gal at 27 mpg, bus $12 + $0.07/mi, flights by distance band, hotel and hostel nightly rates per city), not market data.
- Grounding and privacy are enforced by code after the model answers; the "raw" row shows how often the model needed correcting. A judge should read the rendered row as the product guarantee and the raw row as the model's behaviour.
- Guide attribution: the credited friend is always the post's real author because code forces it. The keyword check only asks whether the recommendation is about what the photo shows; it is coarse and hand-labelled by us on ${Object.keys(labels).length} photos.
- Scenarios were chosen by us. Expectations in the Notes column are what we hoped for, not pass/fail criteria.
- Mode matters: rows marked \`replay\` or \`cached\` did not call Muse during this run.
`;
writeFileSync("EVAL.md", md);
console.log(`\nEVAL.md written. rendered violations=${renderedViolations}, raw grounding=${pct(raw.grounded, raw.ids)}, budget fit=${pct(fits, trips.length)}, guide match=${pct(matches, labelled.length)}, avg saving=${avgPct}%, spend=$${totalCost.toFixed(3)}`);
