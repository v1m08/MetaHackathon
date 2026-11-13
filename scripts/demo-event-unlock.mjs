// Sets up the Event unlock moment in the volleyball chat so you only have to play one game yourself.
// Start a game in c_volleyball first (+ → Order Up! → Tacos), then run `npm run demo:events`. Four members finish the newest
// game card (two chat after, which the score counts as banter), leaving the chat just under 60. Your finish as the 5th
// locks in today's streak and unlocks Events. Usage: npm run demo:events [-- --you sam] [--base http://localhost:3000]
const args = Object.fromEntries(process.argv.slice(2).join(" ").split("--").filter(Boolean).map((a) => a.trim().split(/\s+/)));
const BASE = args.base ?? "http://localhost:3000";
const YOU = args.you ?? "sam";
const CHAT = "c_volleyball";
const SCRIPTED = ["devon", "nina", "marcus", "tyler"];
const BANTER = new Set(["marcus", "tyler"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(path, user, init = {}) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { "content-type": "application/json", "x-user-id": user } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status} ${body.error ?? ""}`);
  return body;
}
const say = (user, text, attachment) => call(`/api/conversations/${CHAT}/messages`, user, { method: "POST", body: JSON.stringify({ text, attachment }) });

const conv = await call(`/api/conversations/${CHAT}`, YOU).catch((e) => {
  console.error(`Couldn't reach the app at ${BASE} (${e.message}). Is \`npm run dev\` running?`);
  process.exit(1);
});
const card = [...conv.messages].reverse().find((m) => m.attachment?.type === "sqgame");
if (!card) {
  console.error("No game card in the volleyball chat yet. Start one first: + → Order Up! → Tacos.");
  process.exit(1);
}
const ref = card.attachment.ref;
const interest = card.text.replace(/^🎮\s*[^:]+:\s*/, "");
const done = new Set(conv.messages.filter((m) => m.attachment?.type === "sqgamelog" && m.attachment.ref === ref).map((m) => m.senderId));
if (done.has(YOU)) console.warn(`Heads up: ${YOU} already finished this game. Start a fresh one so your finish is the one that counts.`);

for (const u of SCRIPTED.filter((id) => id !== YOU && !done.has(id))) {
  await say(u, `played ${interest} · $${150 + Math.floor(Math.random() * 80)}`, { type: "sqgamelog", ref });
  console.log(`✓ ${u} finished ${interest}`);
  if (BANTER.has(u)) {
    await sleep(50);
    await say(u, u === "marcus" ? "gg that was close 😤" : "rematch tonight?");
    console.log(`  ${u}: chatted after the game (banter)`);
  }
  await sleep(50);
}

const check = await call(`/api/conversations/${CHAT}/event-picks?ref=${encodeURIComponent(ref)}`, SCRIPTED.at(-1));
console.log(`\nChat now: ${check.show ? "Events already open" : check.reason}`);
console.log(`Now play it as ${YOU} and close the game: ${BASE}/messages/${CHAT}?as=${YOU}`);
