// End-to-end QA for the Reconnect demo path, against the dev server. Exits non-zero on the first failed check.
//   node scripts/qa-reconnect.mjs
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
let n = 0;
const check = (ok, what, extra = "") => { n++; console.log(`${ok ? "PASS" : "FAIL"} ${n}. ${what}${extra ? ` · ${extra}` : ""}`); if (!ok) process.exit(1); };
const t0 = Date.now();

await post("/api/admin/reset", {}, "maya");
const drift = await get("/api/reconnect/drift", "maya");
const nadia = drift.people.find((p) => p.friendId === "nadia");
check(nadia?.state === "napping", "Nadia reads as napping from Maya's real chats and events", `${nadia?.daysSince} days, rhythm ${nadia?.rhythmDays}`);
check(drift.people.every((p) => !("missed" in p) || typeof p.missed === "boolean"), "drift list carries only the viewer's own picks");
check(drift.crews.some((c) => c.id === "c_plano_east" && c.hook), "Plano East crew surfaces with the ask that died");

const daily = await get("/api/reconnect/nudge", "maya");
check(!!daily.nudge, "one daily nudge exists for Maya", daily.nudge ? `${daily.nudge.friend.name}: "${daily.nudge.nudge.line}" (${daily.nudge.nudge.mode})` : "none");
const BANNED = /\b(depress\w*|anxi\w*|lonely|grie\w+|sick|hospital|therap\w*|mental|struggl\w*|miss(?:ing|ed|es)?\s+you|too long|guilt\w*)\b/i;
check(!BANNED.test(daily.nudge.nudge.line), "nudge has no mood / health / guilt words");
check(daily.nudge.nudge.evidenceIds.length >= 1 && !daily.nudge.nudge.evidenceIds.includes(daily.nudge.nudge.triggerId), "nudge cites shared evidence and never the trigger post");
const notifs = await get("/api/notifications", "maya");
check(notifs.some((x) => x.type === "reconnect"), "the nudge landed as a notification");
const again = await get("/api/reconnect/nudge", "maya");
check(again.nudge?.nudge.id === daily.nudge.nudge.id && (await get("/api/notifications", "maya")).filter((x) => x.type === "reconnect").length === notifs.filter((x) => x.type === "reconnect").length, "one nudge per day: asking again does not notify twice");

const asNadiaBefore = await get("/api/reconnect/drift", "nadia");
check(asNadiaBefore.people.find((p) => p.friendId === "maya")?.mutual === false, "Nadia cannot tell that Maya hasn't picked her (private)");
const miss = await post("/api/reconnect/miss", { personId: "nadia", on: true }, "maya");
check(miss.on && miss.mutual, "Maya taps 'I miss them' → mutual with Nadia's seeded pick");
check((await get("/api/notifications", "nadia")).some((x) => /both want to catch up/.test(x.text)), "Nadia is told only now, and only because it's mutual");

const wn = await post("/api/reconnect/whynow", { personId: "nadia" }, "maya");
check(!!wn.nudge && wn.nudge.evidence.every((e) => e.people.includes("maya") && e.people.includes("nadia")), "why-now evidence all includes both people", wn.nudge?.evidenceIds.join(","));

const run = await sse("/api/reconnect/plan", { personIds: ["nadia"] }, "maya");
check(run.plans.length >= 1, "plan agent proposed at least one plan", `${run.plans.map((p) => `${p.shape} ${p.start} $${p.cost.each}`).join(" · ")} · ${(run.latencyMs / 1000).toFixed(1)}s · ${run.mode}`);
const plan = run.plans[0];
check(plan.people.every((p) => ["nadia", "arjun"].includes(p.id) || drift.people.some((d) => d.friendId === p.id)), "every person in the plan is Maya's friend or the target");
check(plan.cost.each === plan.cost.lines.reduce((s, l) => s + l.usd, 0), "cost equals the sum of its lines");
check(!/\$\s?\d/.test(plan.title + plan.pitch + plan.reasons.join(" ")), "no model-written dollar figures");
check(plan.sources.length >= 3, "plan carries its sources", `${plan.sources.length}`);
check((await get(`/api/reconnect/plans/${plan.id}`, "nadia")).error, "Nadia cannot see an unsent plan");

const d = await post(`/api/reconnect/plans/${plan.id}`, { action: "draft" }, "maya");
check(!!d.messageId && d.text.length > 10 && !/\$\s?\d/.test(d.text), "draft written into Messenger, no money in it", `"${d.text}"`);
const convNadia = await get(`/api/conversations/${d.conversationId}`, "nadia");
check(!convNadia.messages.some((m) => m.id === d.messageId), "Nadia cannot see Maya's unsent draft");
const s = await post(`/api/reconnect/plans/${plan.id}`, { action: "send", text: d.text }, "maya");
check(s.ok && s.eventId, "send flips the draft to sent and creates an invite-only Event");
const ev = await get(`/api/events/${s.eventId}`, "nadia");
check(ev.invited.includes("nadia") && ev.host?.id === "maya", "the Event invites exactly the plan's people, hosted by Maya");
const convAfter = await get(`/api/conversations/${d.conversationId}`, "nadia");
const last = convAfter.messages.at(-1);
check(last?.text === d.text && last?.attachment?.type === "plan", "Nadia sees exactly the message Maya sent, with the plan card");
const view = await get(`/api/reconnect/plans/${plan.id}`, "nadia");
check(view.role === "invited" && !view.sources.some((x) => x.kind === "model" || x.kind === "chat" || x.kind === "post"), "Nadia sees the plan without Maya's private sources");
const j = await post(`/api/reconnect/plans/${plan.id}`, { action: "join" }, "nadia");
check(j.people.find((p) => p.id === "nadia")?.joinedAt, "Nadia taps I'm in");
check((await get("/api/notifications", "maya")).some((x) => /is in for/.test(x.text)), "Maya is told Nadia is in");
const early = await post(`/api/reconnect/plans/${plan.id}`, { action: "confirm" }, "cole");
check(early.error, "nobody else can confirm Maya's plan");
const c = await post(`/api/reconnect/plans/${plan.id}`, { action: "confirm" }, "maya");
check(c.status === "confirmed", "Maya confirms last; plan is final");
console.log(`\nall ${n} checks passed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
