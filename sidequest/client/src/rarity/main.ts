// Deep Cuts client. A pixel world runs behind every screen; the camera travels as you score.
// Home → (build) → lobby → 7 prompts (answer → reveal) → results with friends on the gauge.
import { fmt, ONLY_YOU_BONUS, SECONDS_PER_PROMPT, TIER_POINTS, withScene, type PublicPack, type Verdict } from "../../../shared/rarity";
import { Audio } from "../engine/audio";
import { mix } from "../engine/util";
import { contrastText } from "../theme";
import { SceneView, type Marker } from "./scene";

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

const ui = document.getElementById("ui")!;
const worldEl = document.getElementById("world")!;
const audio = new Audio();
const EXAMPLES = ["Rock climbing", "F1", "Sourdough", "Scuba diving", "Dinosaurs", "Space", "Coffee", "Taylor Swift"];

const HOME_WORLD: PublicPack = withScene({
  interest: "home",
  title: "Deep Cuts",
  tagline: "",
  host: { name: "", emoji: "🎙️", intro: "" },
  meter: { label: "Height", unit: "m", perPoint: 10, up: true, icon: "⭐" },
  tiers: ["Common", "Known", "Nice", "Deep cut", "Rare", "Legendary"],
  palette: { bg: "#7cc4f2", bg2: "#d8eefb", card: "#232838", primary: "#ff5d8f", accent: "#7cf2d0", text: "#ffffff" },
  font: "Rubik",
  scene: { kind: "trail", start: ["#7cc4f2", "#e3f4fb"], end: ["#ff9a5a", "#ffd39a"], ground: "#4f8a3a", props: ["🌲", "🍄", "🦋", "🌼"] },
  avatar: "🎒",
  verb: "Go",
  prompts: [],
});

// ---------- utils ----------
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
// Embedded in the messenger: identity comes from the chat app, and we talk to it with postMessage.
const params = new URLSearchParams(location.search);
const EMBED = params.has("embed");
const embedPid = params.get("pid") ?? "";
const embedName = (params.get("name") ?? "").slice(0, 16);
const toChat = (msg: Record<string, unknown>) => {
  try {
    parent.postMessage({ source: "deepcuts", ...msg }, "*");
  } catch {
    /* not framed */
  }
};
let justFinished = false;

const pid = (() => {
  if (EMBED && /^[a-z0-9]{6,32}$/.test(embedPid)) return embedPid;
  let id = store.get("sq.pid");
  if (!id || !/^[a-z0-9]{6,32}$/.test(id)) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
    store.set("sq.pid", id);
  }
  return id;
})();
const myName = () => (EMBED && embedName ? embedName : store.get("sq.name") ?? "");
const closeBtn = () => (EMBED ? `<button class="btn dark icon-btn" id="close" aria-label="Back to chat">✕</button>` : "");
function wireClose(el: HTMLElement) {
  el.querySelector("#close")?.addEventListener("click", () => toChat({ type: "close" }));
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}
const view = (id: string) => api<RoomView>(`/api/x/${id}?me=${pid}`);
const units = (p: PublicPack, points: number) => points * p.meter.perPoint;
const meterText = (p: PublicPack, points: number) => `${fmt(units(p, points))}${p.meter.unit}`;
const deeper = (p: PublicPack) => (p.meter.up ? "climb higher" : "go deeper");

// ---------- the world behind everything ----------
let scene: SceneView | null = null;
let sceneKey = "";
function setWorld(key: string, p: PublicPack) {
  const pal = p.palette;
  const root = document.documentElement.style;
  root.setProperty("--primary", pal.primary);
  root.setProperty("--accent", pal.accent);
  root.setProperty("--on-primary", contrastText(pal.primary));
  root.setProperty("--on-accent", contrastText(pal.accent));
  const tiers = ["#5a6072", mix("#2a3142", pal.accent, 0.45), mix("#2a3142", pal.accent, 0.75), pal.accent, mix(pal.accent, pal.primary, 0.6), pal.primary];
  tiers.forEach((c, i) => {
    root.setProperty(`--t${i + 1}`, c);
    root.setProperty(`--on-t${i + 1}`, contrastText(c));
  });
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", p.scene.start[0]);
  document.title = p.interest === "home" ? "Deep Cuts" : p.title;
  if (sceneKey !== key) {
    scene?.destroy();
    scene = new SceneView(worldEl, p);
    sceneKey = key;
  }
  return scene!;
}

function screen(html: string, cls = "") {
  ui.innerHTML = `<div class="center ${cls}" style="display:flex;flex-direction:column;flex:1;min-height:0">${html}</div>`;
  return ui.firstElementChild as HTMLElement;
}
const muteBtn = () => `<button class="btn dark icon-btn" id="mute" aria-label="Sound">${audio.muted ? "SND OFF" : "SND ON"}</button>`;
function wireMute(el: HTMLElement) {
  el.querySelector("#mute")?.addEventListener("click", (e) => {
    audio.unlock();
    (e.currentTarget as HTMLElement).textContent = audio.toggleMute() ? "SND OFF" : "SND ON";
  });
}
const markersFor = (v: RoomView): Marker[] => v.board.map((b) => ({ name: b.name, value: units(v.pack, b.score), me: b.me }));

// ---------- home ----------
function home(error = "") {
  history.replaceState(null, "", "/x");
  const s = setWorld("home", HOME_WORLD);
  s.setProgress(0, true);
  s.setMarkers([]);
  s.avatarVisible = true;
  const el = screen(`
    <div class="title-wrap pop">
      <h1 class="title">DEEP<br/>CUTS</h1>
      <p class="subtitle">Name the answer nobody else thinks of</p>
    </div>
    <div class="bottom stack pop" style="padding-right:56px">
      <form class="stack" id="f">
        <input class="field" id="i" maxlength="60" autocomplete="off" placeholder="What are you into?" aria-label="Your interest" />
        <button class="btn big" type="submit">Make the game</button>
      </form>
      <div class="chips">${EXAMPLES.map((x) => `<button class="chip" data-x="${esc(x)}">${esc(x)}</button>`).join("")}</div>
      ${error ? `<p class="error">${esc(error)}</p>` : ""}
    </div>`);
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
  const lines = [`Building a world for ${interest}`, "Casting your host", "Writing seven prompts", "Digging up deep cuts", "Ranking answers, obvious to legendary", "Checking the answer keys", "Almost there"];
  const el = screen(`<div class="making pop"><h1>${esc(interest)}</h1><p id="s" class="blink">${esc(lines[0])}</p><p id="t"></p></div>`);
  const s = el.querySelector("#s")!, t = el.querySelector("#t")!;
  const t0 = Date.now();
  const tick = setInterval(() => {
    const sec = Math.floor((Date.now() - t0) / 1000);
    s.textContent = lines[Math.min(lines.length - 1, Math.floor(sec / 12))];
    t.textContent = sec > 5 ? `${sec}s · new games take about a minute` : "";
    scene?.setProgress(sec * 22); // wander up the trail while waiting
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
  v.pack = withScene(v.pack);
  const s = setWorld(id, v.pack);
  if (v.me?.finished) return results(v);
  s.setProgress(units(v.pack, v.me?.score ?? 0), true);
  s.setMarkers(markersFor(v));
  lobby(v);
}

function tiersHtml(p: PublicPack, you = 0) {
  return `<div class="tiers">${p.tiers.map((n, i) => `<div class="tier ${you && i + 1 !== you ? "dim" : ""} ${i + 1 === you ? "you" : ""}" data-t="${i + 1}"><b>${TIER_POINTS[i]}</b>${esc(n)}</div>`).join("")}</div>`;
}
function boardHtml(v: RoomView, limit = 8) {
  return `<ul class="board">${v.board
    .slice(0, limit)
    .map((b, i) => `<li class="${b.me ? "me" : ""}"><span class="pos">${i + 1}.</span><span class="who">${esc(b.name)}${b.me ? " (you)" : ""}${b.answered < v.pack.prompts.length ? ` <span class="label">${b.answered}/${v.pack.prompts.length}</span>` : ""}</span><span class="pts">${meterText(v.pack, b.score)}</span></li>`)
    .join("")}</ul>`;
}

function lobby(v: RoomView) {
  const p = v.pack;
  const resume = v.me && v.me.done > 0;
  const el = screen(`
    <div class="hud"><span></span><span></span><div class="hud-right">${muteBtn()}${closeBtn()}</div></div>
    <div class="scroll" style="flex:1;padding-right:56px">
      <div class="title-wrap pop" style="margin-top:3vh">
        <h1 class="title" style="font-size:clamp(34px,10vw,64px)">${esc(p.title)}</h1>
        <p class="subtitle">${esc(p.tagline)}</p>
      </div>
      <div class="stack pop" style="margin-top:22px">
        <div class="panel speech"><span class="who">${esc(p.host.emoji)}</span><div><div class="label hot">${esc(p.host.name)}</div><p>${esc(p.host.intro)}</p></div></div>
        <div class="panel">
          <div class="label">${p.prompts.length} prompts · ${SECONDS_PER_PROMPT}s each · rarer answers ${deeper(p)}</div>
          <div style="margin-top:10px">${tiersHtml(p)}</div>
          <div class="label" style="margin-top:10px">Only you said it? +${ONLY_YOU_BONUS}</div>
        </div>
        ${v.board.length ? `<div class="panel"><div class="label">${v.board.length} playing</div><div style="margin-top:6px">${boardHtml(v, 6)}</div></div>` : ""}
      </div>
    </div>
    <div class="stack pop" style="padding-right:56px;margin-top:10px">
      ${EMBED ? "" : `<input class="field" id="name" maxlength="16" placeholder="Your name" autocomplete="nickname" value="${esc(v.me?.name && v.me.name !== "Player" ? v.me.name : myName())}" aria-label="Your name" />`}
      <button class="btn big" id="go">${resume ? `Keep going ${v.me!.done}/${p.prompts.length}` : "Start"}</button>
      ${EMBED ? "" : `<div class="row"><button class="btn dark wide" id="invite">Invite friends</button><button class="btn dark wide" id="new">New topic</button></div>`}
      <p class="toast" id="toast"></p>
    </div>`);
  wireMute(el);
  wireClose(el);
  const name = el.querySelector<HTMLInputElement>("#name") ?? Object.assign(document.createElement("input"), { value: myName() || "Player" });
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
  el.querySelector("#invite")?.addEventListener("click", () => share(v, `${p.title}: how deep do your ${p.interest} cuts go?`, el.querySelector("#toast")!));
  el.querySelector("#new")?.addEventListener("click", () => home());
}

function hud(v: RoomView, i: number, score: number, doneUpTo: number) {
  const p = v.pack;
  return `<div class="hud">
    <div class="panel thin meter-box"><div class="label">${esc(p.meter.label)}</div><div class="v" id="mv">${meterText(p, score)}</div></div>
    <div class="panel thin progress"><div class="pips">${p.prompts.map((_, k) => `<i class="pip ${k < doneUpTo ? "done" : k === i ? "now" : ""}"></i>`).join("")}</div><div class="label">Prompt ${i + 1} of ${p.prompts.length}</div></div>
    <div class="hud-right">${muteBtn()}<button class="btn dark icon-btn" id="quit">Quit</button></div>
  </div>`;
}

// ---------- play ----------
async function play(v: RoomView, i: number) {
  if (i < 0 || i >= v.pack.prompts.length) return results(await view(v.id));
  const p = v.pack;
  const pr = p.prompts[i];
  const open = await api<{ ok: boolean; secondsLeft: number; done: boolean }>(`/api/x/${v.id}/open`, { pid, name: myName(), i });
  if (open.done) return play(await view(v.id), i + 1);
  const score = v.me?.score ?? 0;
  scene?.setProgress(units(p, score));
  scene?.setMarkers(markersFor(v).map((m) => (m.me ? { ...m, value: units(p, score) } : m)));
  const C = 2 * Math.PI * 22;
  const el = screen(`
    ${hud(v, i, score, i)}
    <div class="panel prompt pop" style="margin-right:56px">
      <div class="label hot">${["Warm up", "Easy", "Getting deeper", "Deep", "Deeper", "Deep cuts only", "Final prompt"][Math.min(6, Math.round((i / Math.max(1, p.prompts.length - 1)) * 6))]}</div>
      <h1>${esc(pr.q)}</h1>
      ${pr.hint ? `<p class="hint">${esc(pr.hint)}</p>` : ""}
      <p class="sub">▼ rarer answers ${deeper(p)} ▼</p>
    </div>
    <div class="bottom" style="padding-right:56px">
      <p class="feedback" id="fb" aria-live="polite"></p>
      <form class="answer-bar" id="f">
        <div class="timer" id="timer"><svg viewBox="0 0 54 54"><circle class="track" cx="27" cy="27" r="22"/><circle class="left" id="arc" cx="27" cy="27" r="22" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg><span id="sec">${Math.ceil(open.secondsLeft)}</span></div>
        <input class="field" id="a" maxlength="60" autocomplete="off" autocapitalize="words" enterkeyhint="send" placeholder="Type one answer…" aria-label="Your answer" />
        <button class="btn dark icon-btn" type="button" id="pass">Pass</button>
        <button class="btn" type="submit" id="send">${esc(p.verb)}</button>
      </form>
      <div class="tries" id="tries" aria-label="Tries left"><i></i><i></i><i></i></div>
    </div>`);
  wireMute(el);
  el.querySelector("#quit")!.addEventListener("click", () => {
    done = true;
    void room(v.id);
  });
  const input = el.querySelector<HTMLInputElement>("#a")!;
  const send = el.querySelector<HTMLButtonElement>("#send")!;
  const fb = el.querySelector<HTMLElement>("#fb")!;
  const timer = el.querySelector<HTMLElement>("#timer")!;
  const arc = el.querySelector<SVGCircleElement>("#arc")!;
  const secEl = el.querySelector<HTMLElement>("#sec")!;
  const tries = [...el.querySelectorAll<HTMLElement>("#tries i")];
  input.focus();

  let done = false, busy = false, misses = 0;
  const endAt = performance.now() + open.secondsLeft * 1000;
  let lastSec = -1;
  const frame = (now: number) => {
    if (done) return;
    const left = Math.max(0, (endAt - now) / 1000);
    arc.style.strokeDashoffset = String(C * (1 - left / SECONDS_PER_PROMPT));
    const sec = Math.ceil(left);
    if (sec !== lastSec) {
      lastSec = sec;
      secEl.textContent = String(sec);
      timer.classList.toggle("low", left < 6);
      if (left < 5.5 && sec > 0) audio.tick(true);
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
      fb.className = "feedback checking blink";
      fb.textContent = "Checking…";
    }
    let verdict: Verdict;
    try {
      verdict = await api<Verdict>(`/api/x/${v.id}/answer`, { pid, name: myName(), i, text, giveUp });
    } catch {
      verdict = { ok: false, locked: false, reason: "Connection hiccup, try again" };
    }
    busy = false;
    if (done) return;
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
    if (t && !busy) void finish(false, t);
  });
  el.querySelector("#pass")!.addEventListener("click", () => !busy && finish(true));
}

// ---------- reveal: the camera travels by your points ----------
async function reveal(v: RoomView, i: number, verdict: Verdict, typed: string) {
  const p = v.pack;
  const fresh = await view(v.id).catch(() => v);
  fresh.pack = withScene(fresh.pack);
  const pv = fresh.prompts[i];
  const t = verdict.tier ?? 0;
  const hit = verdict.ok && t > 0;
  const same = verdict.same ?? [];
  const before = v.me?.score ?? 0;
  const after = fresh.me?.score ?? before;
  const last = i === p.prompts.length - 1;
  const gained = after - before;
  const el = screen(`
    ${hud(fresh, i, before, i + 1)}
    <div class="panel reveal pop ${hit ? "" : "miss"}" style="margin-right:56px">
      <div class="q">${esc(p.prompts[i].q)}</div>
      <h1>${esc(hit ? verdict.answer! : typed || "No answer")}</h1>
      ${hit ? tiersHtml(p, t) : `<p class="note">${esc(verdict.reason ?? "Time's up")}</p>`}
      ${hit ? `<p class="gain" id="gain" style="margin:12px 0 0;opacity:0">+${fmt(units(p, gained))}${esc(p.meter.unit)} · ${esc(p.tiers[t - 1])}</p>` : ""}
      ${hit && verdict.note ? `<p class="note">${esc(verdict.note)}</p>` : ""}
      ${hit ? `<p class="social">${same.length ? `Same as ${esc(same.join(", "))}. No bonus.` : pv.friends.length ? `<span class="only">Only you</span> +${ONLY_YOU_BONUS} bonus` : `First to answer. Unique answers get +${ONLY_YOU_BONUS}.`}</p>` : ""}
      ${pv.gem && pv.gem.a !== verdict.answer ? `<div class="gem"><span>💎</span><span>Deepest cut: <b>${esc(pv.gem.a)}</b>${pv.gem.note ? `. ${esc(pv.gem.note)}` : ""}</span></div>` : ""}
      ${pv.friends.length ? `<div class="friends">${pv.friends.map((f) => `<span class="fa"><small>${esc(f.name)}</small>${esc(f.a || "pass")}</span>`).join("")}</div>` : ""}
    </div>
    <div class="bottom" style="padding-right:56px"><button class="btn big" id="next">${last ? "See where you landed" : "Next prompt"}</button></div>`);
  wireMute(el);
  el.querySelector("#quit")!.addEventListener("click", () => void room(v.id));
  const next = el.querySelector<HTMLButtonElement>("#next")!;
  next.addEventListener("click", () => {
    if (last) justFinished = true;
    void play(fresh, i + 1);
  });
  if (hit) {
    // light the tier, then travel
    const tiers = [...el.querySelectorAll<HTMLElement>(".tier")];
    tiers.forEach((x) => x.classList.add("dim"));
    for (let k = 0; k < t; k++) {
      await sleep(110);
      tiers[k].classList.remove("dim");
      audio.step(k * 2);
    }
    for (let k = 0; k < t - 1; k++) tiers[k].classList.add("dim");
    if (t >= 5) audio.word(7, true);
    else audio.word(3 + t, false);
    navigator.vibrate?.(t >= 5 ? [15, 40, 25] : 12);
    const gain = el.querySelector<HTMLElement>("#gain");
    if (gain) gain.style.opacity = "1";
  } else audio.thud();
  scene?.setProgress(units(p, after));
  scene?.setMarkers(markersFor(fresh));
  const mv = el.querySelector<HTMLElement>("#mv");
  if (mv && after !== before) {
    const start = performance.now();
    const roll = (now: number) => {
      const k = Math.min(1, (now - start) / 900);
      mv.textContent = meterText(p, before + (after - before) * (1 - (1 - k) ** 3));
      if (k < 1) requestAnimationFrame(roll);
      else mv.classList.add("bump");
    };
    requestAnimationFrame(roll);
  }
  next.focus();
}

// ---------- results ----------
let poll = 0;
function results(v: RoomView) {
  clearInterval(poll);
  v.pack = withScene(v.pack);
  const p = v.pack;
  const me = v.me!;
  scene?.setProgress(units(p, me.score));
  scene?.setMarkers(markersFor(v));
  const pos = v.board.findIndex((b) => b.me);
  const others = v.board.length - 1;
  const standing =
    others <= 0 ? "Send it to the group chat. See who digs deeper." : pos === 0 ? `You lead ${others} friend${others > 1 ? "s" : ""}. For now.` : `#${pos + 1} of ${v.board.length} · ${esc(v.board[0].name)} is ${meterText(p, v.board[0].score - me.score)} ahead`;
  if (justFinished) {
    justFinished = false;
    toChat({ type: "finished", room: v.id, score: me.score, reached: meterText(p, me.score), icon: p.meter.icon, title: p.title, rank: pos + 1, players: v.board.length });
  }
  const el = screen(`
    <div class="hud"><span></span><span></span><div class="hud-right">${muteBtn()}${closeBtn()}</div></div>
    <div class="scroll" style="flex:1;padding-right:56px">
      <div class="total pop">
        <div class="label" style="color:#fff;text-shadow:2px 2px 0 #000">${esc(p.meter.label)} reached</div>
        <div class="big">${meterText(p, me.score)}</div>
        <p class="standing">${standing}</p>
      </div>
      <div class="stack pop" style="margin-top:22px">
        <button class="btn big" id="share">${EMBED ? "Back to chat" : "Send to the group chat"}</button>
        <p class="toast" id="toast"></p>
        ${v.board.length > 1 ? `<div class="panel"><div class="label">Leaderboard</div><div style="margin-top:6px">${boardHtml(v)}</div></div>` : ""}
        <div class="answers">${p.prompts
          .map((pr, i) => {
            const x = v.prompts[i];
            const m = x.mine;
            const chip = m && m.a ? `<span class="mine" style="background:var(--t${m.tier});color:var(--on-t${m.tier})">${esc(m.a)}<small>${esc(p.tiers[m.tier - 1])} ${m.points + (m.onlyYou ? ONLY_YOU_BONUS : 0)}</small></span>${m.onlyYou ? `<span class="only">Only you</span>` : ""}` : `<span class="mine" style="background:rgba(255,255,255,.08)">${esc(m?.raw ? `${m.raw} ✕` : "Passed")}</span>`;
            return `<div class="panel ans"><div class="q">${esc(pr.q)}</div><div class="mine-line">${chip}</div>
              ${x.friends.length ? `<div class="friends">${x.friends.map((f) => `<span class="fa"><small>${esc(f.name)}</small>${esc(f.a || "pass")}</span>`).join("")}</div>` : ""}
              ${x.gem ? `<p class="gemline">💎 ${esc(x.gem.a)}${x.gem.note ? `: ${esc(x.gem.note)}` : ""}</p>` : ""}</div>`;
          })
          .join("")}</div>
        ${EMBED ? "<div style=\"height:20px\"></div>" : `<button class="btn dark wide" id="new" style="margin:8px 0 20px">Make a game about something else</button>`}
      </div>
    </div>`);
  wireMute(el);
  wireClose(el);
  el.querySelector("#share")!.addEventListener("click", () =>
    EMBED ? toChat({ type: "close" }) : share(v, `${p.title}: I reached ${meterText(p, me.score)} ${p.meter.icon}. How deep do your ${p.interest} cuts go?`, el.querySelector("#toast")!),
  );
  el.querySelector("#new")?.addEventListener("click", () => {
    clearInterval(poll);
    home();
  });
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
