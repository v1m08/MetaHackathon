// Rarity trivia client. Home → (generate) → lobby → 7 prompts (answer, reveal) → results with friends.
import { fmt, SECONDS_PER_PROMPT, TIER_POINTS, ONLY_YOU_BONUS, type PublicPack, type Verdict } from "../../../shared/rarity";
import { Audio } from "../engine/audio";
import { mix } from "../engine/util";
import { contrastText } from "../theme";

interface PromptView {
  mine: { a: string; raw: string; tier: number; points: number; onlyYou: boolean } | null;
  friends: { name: string; a: string; tier: number; onlyYou: boolean }[];
  gem?: { a: string; note?: string };
  count: number;
}
interface RoomView {
  id: string;
  pack: PublicPack;
  me: { name: string; done: number; finished: boolean; score: number } | null;
  board: { name: string; score: number; answered: number; me: boolean }[];
  prompts: PromptView[];
}

const app = document.getElementById("app")!;
const audio = new Audio();
const EXAMPLES = ["Rock climbing", "F1", "Sourdough", "Taylor Swift", "Ancient Rome", "Pokémon", "Coffee", "Skateboarding"];

// ---------- small utils ----------
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};
const pid = (() => {
  let id = store.get("sq.pid");
  if (!id || !/^[a-z0-9]{6,32}$/.test(id)) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
    store.set("sq.pid", id);
  }
  return id;
})();
const myName = () => store.get("sq.name") ?? "";

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}
const view = (id: string) => api<RoomView>(`/api/x/${id}?me=${pid}`);

function render(html: string) {
  app.innerHTML = `<div class="col enter">${html}</div>`;
  window.scrollTo(0, 0);
  return app.firstElementChild as HTMLElement;
}

// ---------- theming: the world restyles everything ----------
function applyWorld(p: PublicPack | null) {
  const root = document.documentElement.style;
  const pal = p?.palette ?? { bg: "#14161f", bg2: "#1f2433", card: "#232838", primary: "#ffb020", accent: "#6ee7b7", text: "#f6f3ee" };
  for (const [k, v] of Object.entries(pal)) root.setProperty(`--${k}`, v);
  root.setProperty("--on-primary", contrastText(pal.primary));
  root.setProperty("--on-accent", contrastText(pal.accent));
  // six tier colors from quiet to loud, each with readable text
  const tiers = [mix(pal.card, pal.text, 0.22), mix(pal.card, pal.accent, 0.35), mix(pal.card, pal.accent, 0.6), pal.accent, mix(pal.accent, pal.primary, 0.6), pal.primary];
  tiers.forEach((c, i) => {
    root.setProperty(`--t${i + 1}`, c);
    root.setProperty(`--on-t${i + 1}`, contrastText(c));
  });
  const font = p?.font ?? "Rubik";
  root.setProperty("--display", `"${font}"`);
  if (font !== "Rubik") {
    const href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, "+")}:wght@400;700;800&display=swap`;
    if (!document.querySelector(`link[href="${href}"]`)) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = href;
      document.head.appendChild(l);
    }
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", pal.bg);
  document.title = p ? p.title : "Sidequest";
}
const tierStyle = (t: number) => `background:var(--t${t});color:var(--on-t${t})`;
const meterText = (p: PublicPack, points: number) => `${fmt(points * p.meter.perPoint)}${p.meter.unit ? ` ${p.meter.unit}` : ""}`;

function ladderHtml(p: PublicPack, you?: number, mini = false) {
  return `<div class="ladder${mini ? " mini" : ""}">${p.tiers
    .map((name, i) => `<div class="rung" data-t="${i + 1}"><span>${esc(name)}</span><small>${TIER_POINTS[i]}</small></div>`)
    .join("")}</div>`.replace(/data-t="(\d)"/g, (m, t) => (you && Number(t) === you ? `${m} data-you` : m));
}

// ---------- home ----------
function home(error = "") {
  applyWorld(null);
  history.replaceState(null, "", "/x");
  const el = render(`
    <div class="home-hero">
      <div class="mark">🔎</div>
      <h1>Deep Cuts</h1>
      <p>Pick something you're into. Name the answers nobody else thinks of. Send it to the group chat.</p>
    </div>
    <form class="col" id="f">
      <input class="field" id="i" maxlength="60" autocomplete="off" placeholder="What are you into?" aria-label="Your interest" />
      <button class="btn" type="submit">Make the game</button>
    </form>
    <div class="chips">${EXAMPLES.map((x) => `<button class="chip" data-x="${esc(x)}">${esc(x)}</button>`).join("")}</div>
    ${error ? `<p class="error">${esc(error)}</p>` : ""}`);
  const input = el.querySelector<HTMLInputElement>("#i")!;
  el.querySelector("form")!.addEventListener("submit", (e) => {
    e.preventDefault();
    if (input.value.trim()) void make(input.value.trim());
    else input.focus();
  });
  el.querySelectorAll<HTMLButtonElement>(".chip").forEach((b) => b.addEventListener("click", () => make(b.dataset.x!)));
}

async function make(interest: string) {
  audio.unlock();
  const lines = [
    `Building a world around ${interest}`,
    "Casting your host",
    "Writing seven prompts",
    "Digging up the deep cuts",
    "Ranking answers from obvious to legendary",
    "Checking the answer keys",
    "Almost there",
  ];
  const el = render(`<div class="making"><div class="spin">⛏️</div><h2 style="margin-top:18px">${esc(interest)}</h2><p id="s">${esc(lines[0])}…</p><p id="t" style="font-size:13px"></p></div>`);
  const s = el.querySelector("#s")!, t = el.querySelector("#t")!;
  const t0 = Date.now();
  const tick = setInterval(() => {
    const sec = Math.floor((Date.now() - t0) / 1000);
    s.textContent = `${lines[Math.min(lines.length - 1, Math.floor(sec / 12))]}…`;
    t.textContent = sec > 4 ? `${sec}s · new games take about a minute, then they're instant` : "";
  }, 500);
  try {
    const { id } = await api<{ id: string }>("/api/x/new", { interest });
    clearInterval(tick);
    history.pushState(null, "", `/x/${id}`);
    await room(id);
  } catch (e) {
    clearInterval(tick);
    home((e as Error).message);
  }
}

// ---------- lobby ----------
async function room(id: string) {
  let v: RoomView;
  try {
    v = await view(id);
  } catch {
    return home("That game link doesn't exist anymore. Make a new one.");
  }
  applyWorld(v.pack);
  if (v.me?.finished) return results(v);
  lobby(v);
}

function boardHtml(v: RoomView, limit = 8) {
  if (!v.board.length) return "";
  const medal = ["🥇", "🥈", "🥉"];
  return `<ul class="board">${v.board
    .slice(0, limit)
    .map(
      (b, i) =>
        `<li class="${b.me ? "me" : ""}"><span class="pos">${medal[i] ?? i + 1}</span><span class="who">${esc(b.name)}${b.me ? " (you)" : ""}${
          b.answered < v.pack.prompts.length ? ` <span class="sub">· ${b.answered}/${v.pack.prompts.length}</span>` : ""
        }</span><span class="pts">${meterText(v.pack, b.score)}</span></li>`,
    )
    .join("")}</ul>`;
}

function lobby(v: RoomView) {
  const p = v.pack;
  const resume = v.me && v.me.done > 0;
  const leader = v.board.find((b) => !b.me);
  const el = render(`
    <div class="lobby-head">
      <div class="host-badge">${esc(p.host.emoji)}</div>
      <h1>${esc(p.title)}</h1>
      <p class="tag">${esc(p.tagline)}</p>
    </div>
    <div class="speech"><b>${esc(p.host.name)}</b>${esc(p.host.intro)}</div>
    <div class="card how">
      <span>✍️</span><span><b>${p.prompts.length} prompts, ${SECONDS_PER_PROMPT} seconds each.</b> Name anything that fits.</span>
      <span>💎</span><span><b>Rarer answers climb higher.</b> Obvious ones barely count.</span>
      <span>👀</span><span><b>Only you said it?</b> +${ONLY_YOU_BONUS} bonus. Same as a friend? No bonus.</span>
    </div>
    ${ladderHtml(p, undefined, true)}
    ${leader ? `<p class="section-title">${esc(leader.name)} leads with ${meterText(p, leader.score)} ${esc(p.meter.icon)}</p>${boardHtml(v, 5)}` : ""}
    <input class="field" id="name" maxlength="16" placeholder="Your name" autocomplete="nickname" value="${esc(v.me?.name && v.me.name !== "Player" ? v.me.name : myName())}" aria-label="Your name" />
    <button class="btn" id="go">${resume ? `Keep going (${v.me!.done}/${p.prompts.length})` : "Start"}</button>
    <button class="btn alt" id="invite">Invite the group chat</button>
    <p class="toast" id="toast"></p>
    <button class="link" id="new">Make a game about something else</button>`);
  el.querySelectorAll(".rung").forEach((r) => r.classList.add("lit"));
  const name = el.querySelector<HTMLInputElement>("#name")!;
  el.querySelector("#go")!.addEventListener("click", () => {
    const n = name.value.trim().slice(0, 16);
    if (!n) {
      name.classList.remove("shake");
      void name.offsetWidth;
      name.classList.add("shake");
      name.focus();
      return;
    }
    store.set("sq.name", n);
    audio.unlock();
    void play(v, v.prompts.findIndex((x) => !x.mine));
  });
  el.querySelector("#invite")!.addEventListener("click", () => share(v, `${p.title}: how deep do your ${p.interest} cuts go?`, el.querySelector("#toast")!));
  el.querySelector("#new")!.addEventListener("click", () => home());
}

// ---------- play ----------
async function play(v: RoomView, i: number) {
  if (i < 0 || i >= v.pack.prompts.length) return results(await view(v.id));
  const p = v.pack;
  const pr = p.prompts[i];
  const open = await api<{ ok: boolean; secondsLeft: number; done: boolean }>(`/api/x/${v.id}/open`, { pid, name: myName(), i });
  if (open.done) return play(await view(v.id), i + 1);
  const score = v.me?.score ?? 0;
  const el = render(`
    <div class="topbar">
      <div class="pips">${p.prompts.map((_, k) => `<i class="pip ${k < i ? "done" : k === i ? "now" : ""}"></i>`).join("")}</div>
      <div class="meter">${esc(p.meter.icon)} <span>${meterText(p, score)}</span></div>
    </div>
    <div class="card prompt-card">
      <div class="k">${i + 1} of ${p.prompts.length}</div>
      <h2>${esc(pr.q)}</h2>
      ${pr.hint ? `<p class="hint">${esc(pr.hint)}</p>` : ""}
      <div class="clock" id="clock"><i></i></div>
    </div>
    <form class="answer-row" id="f">
      <input class="field" id="a" maxlength="60" autocomplete="off" autocapitalize="words" enterkeyhint="send" placeholder="Your answer" aria-label="Your answer" />
      <button class="btn" type="submit" id="send">Go</button>
    </form>
    <div class="tries" id="tries"><i></i><i></i><i></i></div>
    <p class="feedback" id="fb" aria-live="polite"></p>
    <button class="link giveup" id="pass">Pass</button>`);
  const input = el.querySelector<HTMLInputElement>("#a")!;
  const send = el.querySelector<HTMLButtonElement>("#send")!;
  const fb = el.querySelector<HTMLElement>("#fb")!;
  const clock = el.querySelector<HTMLElement>("#clock")!;
  const bar = clock.querySelector("i")!;
  const tries = [...el.querySelectorAll<HTMLElement>("#tries i")];
  input.focus();

  let done = false, busy = false, misses = 0;
  const endAt = performance.now() + open.secondsLeft * 1000;
  let lastSec = -1;
  const frame = (now: number) => {
    if (done) return;
    const left = Math.max(0, (endAt - now) / 1000);
    bar.style.transform = `scaleX(${left / SECONDS_PER_PROMPT})`;
    clock.classList.toggle("low", left < 6);
    const sec = Math.ceil(left);
    if (left < 5.5 && sec !== lastSec && sec > 0) {
      lastSec = sec;
      audio.tick(true);
    }
    if (left <= 0 && !busy) return void finish(true);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  async function finish(giveUp: boolean, text = "") {
    if (done) return;
    busy = true;
    send.disabled = true;
    if (!giveUp) {
      fb.className = "feedback checking";
      fb.textContent = "Checking…";
    }
    let verdict: Verdict;
    try {
      verdict = await api<Verdict>(`/api/x/${v.id}/answer`, { pid, name: myName(), i, text, giveUp });
    } catch {
      verdict = { ok: false, locked: false, reason: "Connection hiccup, try again" };
    }
    busy = false;
    if (verdict.locked) {
      done = true;
      return reveal(v, i, verdict, text);
    }
    misses++;
    tries.forEach((t, k) => t.classList.toggle("used", k < misses));
    audio.thud();
    fb.className = "feedback";
    fb.textContent = verdict.reason ?? "Not on the list";
    input.classList.remove("shake");
    void input.offsetWidth;
    input.classList.add("shake");
    send.disabled = false;
    input.select();
    if (performance.now() >= endAt) void finish(true);
  }

  el.querySelector("#f")!.addEventListener("submit", (e) => {
    e.preventDefault();
    const t = input.value.trim();
    if (!t || busy) return;
    void finish(false, t);
  });
  el.querySelector("#pass")!.addEventListener("click", () => !busy && finish(true));
}

// ---------- reveal ----------
async function reveal(v: RoomView, i: number, verdict: Verdict, typed: string) {
  const p = v.pack;
  const fresh = await view(v.id).catch(() => v);
  const pv = fresh.prompts[i];
  const t = verdict.tier ?? 0;
  const hit = verdict.ok && t > 0;
  const same = verdict.same ?? [];
  const before = v.me?.score ?? 0;
  const after = fresh.me?.score ?? before;
  const last = i === p.prompts.length - 1;
  const el = render(`
    <div class="topbar">
      <div class="pips">${p.prompts.map((_, k) => `<i class="pip ${k <= i ? "done" : ""}"></i>`).join("")}</div>
      <div class="meter">${esc(p.meter.icon)} <span id="m">${meterText(p, before)}</span></div>
    </div>
    <div class="reveal">
      <div class="verdict ${hit ? "" : "miss"}">
        <div class="your">${esc(p.prompts[i].q)}</div>
        <h2>${esc(hit ? verdict.answer! : typed ? typed : "No answer")}</h2>
        ${hit ? `<span class="tier-name" id="tn" style="${tierStyle(t)};opacity:0">${esc(p.tiers[t - 1])}</span>` : `<p class="note">${esc(verdict.reason ?? "Time's up")}</p>`}
      </div>
      ${hit ? ladderHtml(p, t) : ""}
      ${hit && verdict.note ? `<p class="note">${esc(verdict.note)}</p>` : ""}
      ${hit ? `<p class="same">${same.length ? `Same as ${esc(same.join(", "))}. No bonus.` : pv.friends.length ? `<span class="only">Only you</span> nobody else said it (+${ONLY_YOU_BONUS})` : "First to answer. If nobody matches you, that's +" + ONLY_YOU_BONUS + "."}</p>` : ""}
      ${pv.gem && pv.gem.a !== verdict.answer ? `<div class="card gem"><span class="g">💎</span><p>Deepest cut on the list: <b>${esc(pv.gem.a)}</b>${pv.gem.note ? `. ${esc(pv.gem.note)}` : ""}</p></div>` : ""}
      ${pv.friends.length ? `<p class="section-title">What friends said</p><div class="friends">${pv.friends.map((f) => `<span class="fa" data-t="${f.tier}"><small>${esc(f.name)}</small><b>${esc(f.a || "pass")}</b></span>`).join("")}</div>` : ""}
      <button class="btn" id="next">${last ? "See results" : "Next prompt"}</button>
    </div>`);
  // climb the ladder to the player's tier, one rung at a time
  if (hit) {
    const rungs = [...el.querySelectorAll<HTMLElement>(".rung")];
    for (let k = 0; k < t; k++) {
      await sleep(k === 0 ? 120 : 140);
      rungs[k].classList.add("lit");
      audio.step(k * 2);
    }
    rungs[t - 1].classList.add("you");
    const tn = el.querySelector<HTMLElement>("#tn");
    if (tn) tn.style.opacity = "1";
    if (t >= 5) audio.word(7, true);
    else audio.word(3 + t, false);
    navigator.vibrate?.(t >= 5 ? [15, 40, 25] : 12);
  } else audio.thud();
  const m = el.querySelector<HTMLElement>("#m")!;
  if (after !== before) {
    m.textContent = meterText(p, after);
    m.classList.add("bump");
  }
  const next = el.querySelector<HTMLButtonElement>("#next")!;
  next.focus();
  next.addEventListener("click", () => void play(fresh, i + 1));
}

// ---------- results ----------
let poll = 0;
function results(v: RoomView) {
  clearInterval(poll);
  const p = v.pack;
  const me = v.me!;
  const pos = v.board.findIndex((b) => b.me);
  const others = v.board.length - 1;
  const standing =
    others <= 0 ? "Send it to the group chat and see who digs deeper." : pos === 0 ? `You're leading ${others} friend${others > 1 ? "s" : ""}. For now.` : `#${pos + 1} of ${v.board.length}. ${esc(v.board[0].name)} is ahead by ${meterText(p, v.board[0].score - me.score)}.`;
  const el = render(`
    <div class="card total">
      <div style="font-size:40px">${esc(p.host.emoji)}</div>
      <div class="big">${meterText(p, me.score)}</div>
      <div class="unit">${esc(p.meter.label)} ${esc(p.meter.icon)} · ${fmt(me.score)} points</div>
      <p class="standing">${standing}</p>
    </div>
    <button class="btn" id="share">Send to the group chat</button>
    <p class="toast" id="toast"></p>
    ${v.board.length > 1 ? `<p class="section-title">Leaderboard</p>${boardHtml(v)}` : ""}
    <p class="section-title">Your answers</p>
    <div class="rows">${p.prompts
      .map((pr, i) => {
        const x = v.prompts[i];
        const mine = x.mine;
        return `<div class="card row">
          <div class="q">${esc(pr.q)}</div>
          <div class="mine-line">${mine && mine.a ? `<span class="mine" style="${tierStyle(mine.tier)}">${esc(mine.a)} <small>${esc(p.tiers[mine.tier - 1])} · ${mine.points + (mine.onlyYou ? ONLY_YOU_BONUS : 0)}</small></span>${mine.onlyYou ? `<span class="only">Only you</span>` : ""}` : `<span class="mine" style="background:var(--line)">${esc(mine?.raw ? `${mine.raw} (not accepted)` : "Passed")}</span>`}</div>
          ${x.friends.length ? `<div class="friends">${x.friends.map((f) => `<span class="fa" data-t="${f.tier}"><small>${esc(f.name)}</small><b>${esc(f.a || "pass")}</b></span>`).join("")}</div>` : ""}
          ${x.gem ? `<p class="note" style="text-align:left;margin-top:8px">💎 ${esc(x.gem.a)}${x.gem.note ? `: ${esc(x.gem.note)}` : ""}</p>` : ""}
        </div>`;
      })
      .join("")}</div>
    <button class="link" id="new">Make a game about something else</button>`);
  el.querySelector("#share")!.addEventListener("click", () => share(v, `${p.title}: I reached ${meterText(p, me.score)} ${p.meter.icon}. How deep do your ${p.interest} cuts go?`, el.querySelector("#toast")!));
  el.querySelector("#new")!.addEventListener("click", () => {
    clearInterval(poll);
    home();
  });
  // friends keep playing: refresh quietly
  const sig = JSON.stringify(v.board) + v.prompts.map((x) => x.friends.length).join();
  poll = window.setInterval(async () => {
    if (document.hidden) return;
    const n = await view(v.id).catch(() => null);
    if (n && JSON.stringify(n.board) + n.prompts.map((x) => x.friends.length).join() !== sig) results(n);
  }, 12000);
}

async function share(v: RoomView, text: string, toast: Element) {
  const url = `${location.origin}/x/${v.id}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: v.pack.title, text, url });
      return;
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast.textContent = "Link copied. Paste it in the chat.";
  } catch {
    toast.textContent = url;
  }
}

// ---------- boot ----------
function boot() {
  const m = location.pathname.match(/^\/x\/([a-z0-9]{4,12})$/);
  if (m) void room(m[1]);
  else home();
}
addEventListener("popstate", boot);
boot();
