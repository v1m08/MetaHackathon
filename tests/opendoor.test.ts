// Open Door: tier reach, disclosure scrubbing, anonymity, request state machine. Code paths only, no model.
//   npm test
import assert from "node:assert/strict";
import test from "node:test";

import { signalPosts } from "@/data/signals";
import { gatherSignals } from "@/lib/travel/availability";
import { anonymise, requestsFor, scrubHostAnswer, viewRequest } from "@/lib/travel/negotiate";
import { connectionFacts, doorOpenTo, openDoorOf, reachTier, setOpenDoor } from "@/lib/travel/openDoor";
import { travelStore, type OpenDoorRequest } from "@/lib/travel/store";
import { db, getUser, resetDb } from "@/server/db";

resetDb();

test("open door tiers are enforced by the graph, not the model", () => {
  assert.equal(reachTier("cole", "maya"), "friends"); // direct friend
  assert.equal(reachTier("ruben", "maya"), "fof"); // via jordan
  assert.equal(reachTier("ella", "maya"), "fof"); // via hannah
  assert.equal(doorOpenTo("andre", "ruben").open, false); // andre: friends only; ruben is not his friend
  assert.equal(doorOpenTo("cole", "maya").open, true);
  // flip a policy and reach changes immediately
  const simone = getUser("simone")!;
  const before = doorOpenTo("simone", "maya"); // simone is fof via aisha, tier fof → open
  assert.equal(before.open, true);
  setOpenDoor(simone, { tier: "friends" });
  assert.equal(doorOpenTo("simone", "maya").open, false);
  setOpenDoor(simone, { tier: "fof" });
  // legacy fields follow the policy
  setOpenDoor(simone, { on: false });
  assert.equal(simone.openToHosting, false);
  setOpenDoor(simone, { on: true });
  assert.equal(simone.openToHosting, true);
  assert.ok(openDoorOf(simone).policy.length > 20);
});

test("every seeded policy is in words, and non-couch offers never count as hosting", () => {
  const hosts = db().users.filter((u) => u.openDoor?.on);
  assert.ok(hosts.length >= 25, `${hosts.length} open doors`);
  for (const h of hosts) assert.ok(h.openDoor!.policy.split(" ").length >= 8, `${h.id} policy too short`);
  const wes = getUser("wes")!; // show-around only
  assert.equal(wes.openToHosting, false);
  assert.ok(openDoorOf(wes).offers.includes("show-around"));
  const tiers = new Set(hosts.map((h) => h.openDoor!.tier));
  assert.ok(tiers.size >= 2, "policies vary by tier");
});

test("the scrubber removes schedule reasons, third-party names, addresses and quotes from the host's own posts", () => {
  const cole = getUser("cole")!;
  const { answer, removed } = scrubHostAnswer(cole, {
    decision: "conditions",
    conditions: ["one guest only because my sister is staying", "text me at 214-555-0199"],
    fitReasons: [{ text: "fits", evidence: "plano east people and their friends" }, { text: "made up", evidence: "loves jazz brunch" }],
    note: `Can't do Dec 18 since it's my sister's wedding. Harper says hi. I live at 1234 Greenville Ave. ${signalPosts[0].text.slice(0, 60)}`,
  }, { start: "2026-12-11", end: "2026-12-13" });
  assert.ok(!/sister/.test(answer.note), answer.note);
  assert.ok(!/wedding/.test(answer.note));
  assert.ok(!/Harper/.test(answer.note), "third-party name removed");
  assert.ok(!/Greenville Ave/.test(answer.note), "address removed");
  assert.ok(!/214-555/.test(answer.conditions.join(" ")), "phone removed");
  assert.ok(!/because/.test(answer.conditions[0]));
  assert.equal(answer.fitReasons.length, 1, "unsupported fit reason dropped");
  assert.ok(removed.length >= 4, removed.join("\n"));
});

test("the traveler's agent can never send the traveler's name", () => {
  const maya = getUser("maya")!;
  const out = anonymise(maya, "Hi! Maya Chen here, maya.chen on here, Chen family. can Maya stay?");
  assert.ok(!/maya|chen/i.test(out), out);
});

test("availability signals never include anyone's chats with third parties", () => {
  // maya asks about ruben: ruben chats with jordan, not with maya → no chat signals, only visible posts/RSVPs
  const sigs = gatherSignals("maya", "ruben", ["2026-12-04", "2026-12-05", "2026-12-06"]);
  assert.ok(sigs.every((s) => s.kind !== "chat" && s.kind !== "reply"));
  // maya asks about kai: their DM is a shared conversation, so kai's own lines count
  const kai = gatherSignals("maya", "kai", ["2026-12-11", "2026-12-12", "2026-12-13"]);
  assert.ok(kai.some((s) => s.kind === "chat" && /fort worth/i.test(s.text)));
  // ruben's friends-only posts are not signals for maya (not a friend)
  assert.ok(sigs.every((s) => s.kind !== "post"));
});

test("request views hide identities until revealed, and the host never sees the traveler's private turns", () => {
  const r: OpenDoorRequest = { id: "odr_t", travelerId: "maya", hostId: "cole", tier: "friends", ask: { start: "2026-12-11", end: "2026-12-13", guests: 1, offer: "" }, status: "proposed", decision: "yes", conditions: [], fit: { reasons: [{ text: "x", side: "traveler", evidence: "y" }], score: 1 }, anon: { forHost: "A friend wants to stay", forTraveler: "A host says yes" }, turns: [{ i: 0, at: 0, from: "traveler", kind: "ask", text: "To Cole's agent: hi", payload: {} }, { i: 1, at: 0, from: "host", kind: "answer", text: "yes" }], mode: "test", costUsd: 0, createdAt: "" };
  travelStore().requests.unshift(r);
  assert.ok(!requestsFor("cole").includes(r), "host does not see a request the traveler hasn't accepted");
  r.travelerAccepted = true;
  assert.ok(requestsFor("cole").includes(r));
  const hostView = viewRequest("cole", r)!;
  assert.equal(hostView.other, null);
  assert.equal(hostView.anon, "A friend wants to stay");
  assert.ok(hostView.turns.every((t) => t.from !== "traveler"), "traveler's asks hidden from host");
  assert.ok(hostView.fit.every((f) => f.side === "host"), "traveler style hidden before reveal");
  assert.equal(viewRequest("harper", r), null, "third parties see nothing");
  r.revealedAt = new Date().toISOString();
  assert.equal(viewRequest("cole", r)!.other?.name, "Maya Chen");
  assert.ok(connectionFacts("cole", "maya").some((f) => /Plano/.test(f)));
  travelStore().requests.length = 0;
});
