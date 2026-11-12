// Reconnect: drift math, evidence checking, guardrails, plan validation, mutual picks. Code paths only, no model.
//   npm test
import assert from "node:assert/strict";
import test from "node:test";

import { chatEvents, crewsFor, driftFor, driftList, rhythmDays, stateForRatio, type ContactEvent } from "@/lib/reconnect/drift";
import { checkEvidence, sharedEvidence } from "@/lib/reconnect/evidence";
import { costFor, validatePlan } from "@/lib/reconnect/plan";
import { conversationForPlan, joinPlan, sendPlan, viewPlan } from "@/lib/reconnect/send";
import { hasMissed, isMutual, resetReconnectStore, savePlan, setMiss, type Plan } from "@/lib/reconnect/store";
import { BANNED } from "@/lib/reconnect/whynow";
import { db, getUser, resetDb } from "@/server/db";
import type { Conversation } from "@/types";

resetDb();
resetReconnectStore();

test("a two-way chat needs both people inside 48 hours; likes never count", () => {
  const c: Conversation = { id: "c_t", participantIds: ["a", "b"], isGroup: false, messages: [
    { id: "1", senderId: "a", text: "hey", createdAt: "2026-10-01T10:00:00Z" },
    { id: "2", senderId: "b", text: "hey!", createdAt: "2026-10-02T10:00:00Z" },
    { id: "3", senderId: "a", text: "you there?", createdAt: "2026-10-20T10:00:00Z" },
    { id: "4", senderId: "a", text: "draft", createdAt: "2026-10-21T10:00:00Z", status: "draft" },
  ] };
  const ev = chatEvents(c, "a", "b");
  assert.deepEqual(ev.map((e) => e.type), ["two_way_chat", "one_way"]);
  assert.equal(ev[1].sourceIds.length, 1); // the draft is not an exchange
});

test("rhythm is the median gap inside the lookback window, clamped, default 30", () => {
  const mk = (dates: string[]): ContactEvent[] => dates.map((date) => ({ date, type: "two_way_chat", via: "dm", sourceIds: [] }));
  assert.equal(rhythmDays(mk(["2026-11-01"]), "2026-11-12"), 30);
  assert.equal(rhythmDays(mk(["2026-10-01", "2026-10-11", "2026-10-21", "2026-11-01"]), "2026-11-12"), 10);
  assert.equal(rhythmDays(mk(["2026-11-01", "2026-11-02", "2026-11-03"]), "2026-11-12"), 7); // clamped up
  // meetups two years ago do not stretch the rhythm
  assert.equal(rhythmDays(mk(["2024-01-01", "2024-06-01", "2026-10-20", "2026-10-30", "2026-11-09"]), "2026-11-12"), 10);
  assert.equal(stateForRatio(0.9), "awake");
  assert.equal(stateForRatio(1.2), "sleepy");
  assert.equal(stateForRatio(1.6), "napping");
});

test("Maya and Nadia read as napping from the seed; the drift list is friends only", () => {
  const d = driftFor("maya", "nadia");
  assert.equal(d.state, "napping");
  assert.ok((d.daysSince ?? 0) > 30, `daysSince ${d.daysSince}`);
  assert.ok(d.sharedCount >= 4);
  const list = driftList("maya");
  const me = getUser("maya")!;
  assert.ok(list.every((c) => me.friendIds.includes(c.friendId)));
  assert.ok(list.some((c) => c.friendId === "nadia" && c.recentPost));
});

test("crews come from group chats the viewer is in, with the ask that died", () => {
  const crews = crewsFor("maya");
  const plano = crews.find((c) => c.id === "c_plano_east");
  assert.ok(plano, "plano east crew");
  assert.ok(plano!.hook && /who's in|reunion/i.test(plano!.hook.text));
  assert.ok(!plano!.memberIds.includes("maya"));
});

test("shared evidence involves both people and only what the viewer can see", () => {
  const idx = sharedEvidence("maya", "nadia");
  assert.ok(idx.length >= 4);
  for (const e of idx) assert.ok(e.people.includes("maya") && e.people.includes("nadia"), e.id);
  // a third party's chat with Nadia is never evidence for Maya
  const nadiaArjun = db().conversations.find((c) => c.participantIds.includes("nadia") && c.participantIds.includes("arjun") && !c.participantIds.includes("maya"));
  if (nadiaArjun) for (const m of nadiaArjun.messages) assert.ok(!idx.some((e) => e.id === m.id));
  // evidence check: unknown ids and the trigger are refused
  const trigger = db().posts.find((p) => p.authorId === "nadia" && /lakefront run since the move/.test(p.text))!;
  assert.equal(checkEvidence([trigger.id], idx, trigger.id).ok, false);
  assert.equal(checkEvidence(["p_nope"], idx).ok, false);
  const ok = checkEvidence([idx[0].id, "p_nope"], idx);
  assert.equal(ok.ok, false);
  assert.deepEqual(ok.ids, [idx[0].id]); // partial: keep the real one, report the bad one
  assert.equal(checkEvidence([idx[0].id], idx).ok, true);
});

test("banned words: mood, health and guilt never reach the screen", () => {
  for (const s of ["she seems lonely lately", "you two should've talked, it's been too long", "after her hospital stay", "I bet she misses you"]) assert.ok(BANNED.test(s), s);
  for (const s of ["she's back on the lakefront, like your sunday loops senior year", "arjun's 25th is dec 6 and she rsvp'd"]) assert.ok(!BANNED.test(s), s);
});

test("private picks: a one-sided pick is never mutual", () => {
  resetReconnectStore();
  assert.equal(hasMissed("nadia", "maya"), true); // seeded
  assert.equal(isMutual("maya", "nadia"), false); // maya has not picked back
  setMiss("maya", "nadia", true);
  assert.equal(isMutual("maya", "nadia"), true);
});

test("mutual needs both sides", () => {
  resetReconnectStore();
  setMiss("maya", "june", true);
  assert.equal(isMutual("maya", "june"), false);
  setMiss("june", "maya", true);
  assert.equal(isMutual("maya", "june"), true);
  setMiss("maya", "june", false);
  assert.equal(isMutual("maya", "june"), false);
});

test("plan validation: invisible people dropped, costs recomputed in code, model prices stripped", async () => {
  const p = await validatePlan("maya", { personIds: ["nadia"] }, { shape: "visit", title: "chicago $300 trip", pitch: "costs $300. lakefront.", start: "2026-12-04", end: "2026-12-06", city: "chicago", personIds: ["nadia", "ghost_user"], hostId: "nadia", nights: 2, reasons: ["nadia is there", "only $50 flight"] }, { mode: "test", costUsd: 0 });
  assert.ok(p);
  assert.ok(p!.repairs.some((r) => /ghost_user/.test(r)));
  assert.ok(!/\$/.test(p!.title) && !/\$/.test(p!.pitch));
  assert.equal(p!.reasons.length, 1);
  assert.equal(p!.hostId, "nadia");
  assert.equal(p!.cost.each, p!.cost.lines.reduce((n, l) => n + l.usd, 0));
  assert.ok(p!.sources.some((s) => s.kind === "price"));
  // a call is free; a hangout is the seeded flat line
  assert.equal((costFor("maya", { shape: "call", city: "austin" }) as { each: number }).each, 0);
  assert.equal((costFor("maya", { shape: "hangout", city: "austin" }) as { each: number }).each, 28);
});

test("send creates an invite-only Event, invitees see the plan without the owner's private detail, join notifies", async () => {
  resetDb();
  resetReconnectStore();
  const p = (await validatePlan("maya", { personIds: ["nadia"] }, { shape: "visit", title: "chicago weekend", pitch: "lakefront.", start: "2026-12-04", end: "2026-12-06", city: "chicago", personIds: ["nadia"], hostId: "nadia", nights: 2, reasons: ["she lives there"] }, { mode: "test", costUsd: 0 }))!;
  savePlan(p);
  assert.equal(viewPlan("nadia", p), null); // not sent yet: invisible to Nadia
  const conv = conversationForPlan("maya", p);
  conv.messages.push({ id: "m_draft", senderId: "maya", text: "come?", createdAt: new Date().toISOString(), status: "draft", attachment: { type: "plan", ref: p.id } });
  p.status = "drafted"; p.conversationId = conv.id; p.draftMessageId = "m_draft"; savePlan(p);
  const r = sendPlan("maya", p.id, "ok what if I came dec 4–6?");
  const e = db().events.find((x) => x.id === r.eventId)!;
  assert.deepEqual(e.invited, ["nadia"]);
  assert.equal(e.hostId, "maya");
  const asNadia = viewPlan("nadia", p)!;
  assert.equal(asNadia.role, "invited");
  assert.ok(!asNadia.sources.some((s) => s.kind === "model" || s.kind === "chat" || s.kind === "post"));
  assert.equal(asNadia.cost.ifNo, undefined === asNadia.cost.ifNo ? undefined : asNadia.cost.ifNo); // present in object, hidden in UI for invitees
  const before = db().notifications.filter((n) => n.userId === "maya").length;
  joinPlan("nadia", p.id, true);
  assert.ok(e.going.includes("nadia"));
  assert.equal(db().notifications.filter((n) => n.userId === "maya").length, before + 1);
  assert.throws(() => joinPlan("cole", p.id, true));
});

void (null as unknown as Plan);
