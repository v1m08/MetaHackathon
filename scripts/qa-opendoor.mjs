// End-to-end QA of the Open Door demo path through the API: reset → style → discover (cached) → coordinate labels →
// negotiate → traveler accept → host sees anon card (no name) → host accept → reveal → host confirm → DM with context.
const BASE = "http://localhost:3000";
const H = (u) => ({ "content-type": "application/json", "x-user-id": u });
const post = (p, b, u) => fetch(`${BASE}${p}`, { method: "POST", headers: H(u), body: JSON.stringify(b) }).then((r) => r.json());
const get = (p, u) => fetch(`${BASE}${p}`, { headers: H(u) }).then((r) => r.json());
async function sse(p, b, u) {
  const text = await (await fetch(`${BASE}${p}`, { method: "POST", headers: H(u), body: JSON.stringify(b) })).text();
  let result, error, n = 0;
  for (const chunk of text.split("\n\n")) { const ev = chunk.match(/^event: (.+)$/m)?.[1]; const data = chunk.match(/^data: (.+)$/m)?.[1]; if (ev === "step" || ev === "turn") n++; if (ev === "result") result = JSON.parse(data); if (ev === "error") error = JSON.parse(data).message; }
  return { result, error, n };
}
const check = (ok, msg) => { console.log(`${ok ? "OK  " : "FAIL"} ${msg}`); if (!ok) process.exitCode = 1; };
const t0 = Date.now();
await post("/api/admin/reset", {}, "maya");
const st = await post("/api/me/travel-style", {}, "maya");
check(st.style?.lines?.length >= 3, `travel style: ${st.style?.lines?.length} lines, ${st.style?.mode}`);
const d = await sse("/api/travel/discover", { start: "2026-12-11", end: "2026-12-13", budget: 140 }, "maya");
check(!d.error && d.result?.trips?.length, `discover: ${d.result?.mode} ${d.result?.trips?.map((t) => t.cityName).join(",")} (${d.n} steps)`);
const trip = d.result.trips.find((t) => t.city === "dallas") ?? d.result.trips[0];
check(trip.ride || trip.city !== "dallas", `dallas trip has a ride: ${trip.ride?.driver.name ?? "none"} · $${trip.prices.ifYes.total}`);
const c = await get(`/api/travel/coordinate?tripId=${trip.id}`, "maya");
check(c.dates?.people?.every((p) => p.label), `coordinate labels: ${c.dates.people.map((p) => `${p.name.split(" ")[0]}=${p.label}`).join(", ")}`);
check(!c.dates.people.some((p) => p.role === "driver" && p.status === "busy"), "driver is not marked busy for the trip city");
const n = await sse("/api/opendoor/negotiate", { tripId: trip.id }, "maya");
check(!n.error && n.result, `negotiate: ${n.result?.mode} ${(n.result?.latencyMs / 1000).toFixed(0)}s $${n.result?.costUsd?.toFixed(3)} · ${n.result?.summary}`);
const proposed = (n.result?.requests ?? []).filter((r) => r.status === "proposed");
check(proposed.length >= 1, `${proposed.length} anonymous match(es)`);
const req = proposed[0];
const hostId = req.hostId;
// host must NOT see anything before the traveler accepts
const hostBefore = await get("/api/opendoor/requests", hostId);
check(!hostBefore.requests.some((r) => r.id === req.id), "host sees nothing before the traveler accepts");
const a1 = await post(`/api/opendoor/requests/${req.id}`, { action: "accept" }, "maya");
check(a1.status === "traveler_accepted", `traveler accepted → ${a1.status}`);
const hostView = (await get("/api/opendoor/requests", hostId)).requests.find((r) => r.id === req.id);
check(hostView && hostView.other === null && !/maya/i.test(JSON.stringify(hostView)), `host sees an anonymous card: "${hostView?.anon}"`);
const a2 = await post(`/api/opendoor/requests/${req.id}`, { action: "accept" }, hostId);
check(a2.status === "revealed" && a2.other?.name === "Maya Chen" && a2.connectionFacts.length > 0, `host accepted → revealed: ${a2.other?.name} · ${a2.connectionFacts.join(" · ")}`);
const travView = (await get("/api/opendoor/requests", "maya")).requests.find((r) => r.id === req.id);
check(travView?.other?.id === hostId, `traveler now sees the host: ${travView?.other?.name}`);
const a3 = await post(`/api/opendoor/requests/${req.id}`, { action: "confirm" }, hostId);
check(!!a3.conversationId, `host confirmed → chat ${a3.conversationId}`);
const convs = await get("/api/conversations", "maya");
const conv = convs.find((x) => x.id === a3.conversationId);
check(!!conv && /Open Door/.test(conv.last?.text ?? ""), `traveler's Messenger shows the context line: "${conv?.last?.text?.slice(0, 80)}"`);
// a third party sees nothing
const third = await get("/api/opendoor/requests", "harper");
check(!third.requests.some((r) => r.id === req.id), "third party sees nothing");
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
