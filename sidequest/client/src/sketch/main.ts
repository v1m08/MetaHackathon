// Sketch Off: draw your word from the topic on a pixel canvas (30 s). The AI takes a guess right away, then
// friends guess it later. You guess theirs too. Points for fast guesses and for drawings people get.
import { BRUSH, DRAW_SECONDS, GRID, GUESS_SECONDS, INK, MAX_GUESS_ROUNDS, type SketchPack, type Stroke } from "../../../shared/sketch";
import { Audio } from "../engine/audio";
import { drawWall } from "../kitchen/pixel";
import { contrastText } from "../theme";
import { renderStrokes, strokesCanvas } from "./draw";

interface DrawingView {
  id: string;
  artist: string;
  own: boolean;
  strokes: Stroke[];
  length: number;
  word?: string;
  ai?: { guess: string; correct: boolean } | null;
  guessed?: { correct: boolean; points: number };
  correctGuesses: number;
}
interface View {
  id: string;
  pack: Omit<SketchPack, "words">;
  me: { name: string; word?: string; drew: boolean; score: number } | null;
  board: { name: string; score: number; me: boolean }[];
  drawings: DrawingView[];
}

const ui = document.getElementById("ui")!;
const audio = new Audio();
const params = new URLSearchParams(location.search);
const EMBED = params.has("embed");
const roomId = location.pathname.split("/").pop() ?? "";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pid = (() => {
  const p = params.get("pid") ?? "";
  if (EMBED && /^[a-z0-9]{6,32}$/.test(p)) return p;
  try {
    let id = localStorage.getItem("sq.pid");
    if (!id) localStorage.setItem("sq.pid", (id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("")));
    return id;
  } catch {
    return "anon" + Math.random().toString(36).slice(2, 10);
  }
})();
const myName = (params.get("name") ?? "").slice(0, 16) || "Player";
const toChat = (msg: Record<string, unknown>) => {
  try {
    parent.postMessage({ source: "sketchoff", ...msg }, "*");
  } catch {
    /* not framed */
  }
};
async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`request failed (${r.status})`);
  return (await r.json()) as T;
}
const view = () => api<View>(`/api/s/${roomId}?me=${pid}`);

// ---------- the studio (pixel art backdrop) ----------
function studio(p: View["pack"]) {
  const s = document.documentElement.style;
  s.setProperty("--primary", p.palette.primary);
  s.setProperty("--accent", p.palette.accent);
  s.setProperty("--on-primary", contrastText(p.palette.primary));
  document.title = p.title;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", p.palette.wall2);
  const c = document.getElementById("studio") as HTMLCanvasElement;
  drawWall(c, { wall: p.palette.wall, wall2: p.palette.wall2, counter: "#8a5a3a", accent: p.palette.accent }, ["🖌️", "🎨", "✏️"]);
}

function screen(html: string) {
  ui.innerHTML = `<div class="center">${html}</div>`;
  ui.scrollTop = 0;
  return ui.firstElementChild as HTMLElement;
}
const icons = () => `<button class="icon" id="mute" aria-label="Sound on or off">${audio.muted ? "🔇" : "🔊"}</button>${EMBED ? `<button class="icon" id="close" aria-label="Back to chat">✕</button>` : ""}`;
function wireTop(el: HTMLElement) {
  el.querySelector("#mute")?.addEventListener("click", (e) => {
    audio.unlock();
    (e.currentTarget as HTMLElement).textContent = audio.toggleMute() ? "🔇" : "🔊";
  });
  el.querySelector("#close")?.addEventListener("click", () => toChat({ type: "close" }));
}
const toGuess = (v: View) => v.drawings.filter((d) => !d.own && !d.guessed).slice(-MAX_GUESS_ROUNDS);
const leadersHtml = (v: View) =>
  v.board.length
    ? `<p class="leaders">${v.board
        .slice(0, 3)
        .map((b) => `<span class="${b.me ? "me" : ""}">${esc(b.me ? "You" : b.name)} <b>${b.score}</b></span>`)
        .join('<span class="sep">·</span>')}</p>`
    : "";

// ---------- lobby ----------
function lobby(v: View) {
  const p = v.pack;
  const waiting = toGuess(v).length;
  const cta = !v.me?.drew ? "Draw your word" : waiting ? `Guess ${waiting} drawing${waiting > 1 ? "s" : ""}` : "See the gallery";
  const el = screen(`
    <div class="top"><div class="grow"></div>${icons()}</div>
    <div class="host">${esc(p.host.emoji)}</div>
    <h1 class="title" style="margin-top:10px">${esc(p.title)}</h1>
    <p class="sub">${esc(p.tagline)}</p>
    <div class="bottom">
      ${leadersHtml(v)}
      <button class="btn" id="go">${cta}</button>
      <button class="link" id="how">How to play</button>
    </div>
    <div class="sheet" id="sheet" hidden><div class="panel">
      <b>${esc(p.host.emoji)} ${esc(p.host.name)}:</b> ${esc(p.host.line)}
      <ol>
        <li>You get a secret word about ${esc(p.interest)}. Draw it in ${DRAW_SECONDS} seconds. No letters!</li>
        <li>The AI takes a guess straight away. Fool it and it's on you, get it guessed and you score.</li>
        <li>Guess your friends' drawings. The faster you get it, the more points.</li>
      </ol>
      <button class="btn" id="gotit">Got it</button>
    </div></div>`);
  wireTop(el);
  const sheet = el.querySelector<HTMLElement>("#sheet")!;
  el.querySelector("#how")!.addEventListener("click", () => (sheet.hidden = false));
  el.querySelector("#gotit")!.addEventListener("click", () => (sheet.hidden = true));
  el.querySelector("#go")!.addEventListener("click", () => {
    audio.unlock();
    if (!v.me?.drew) void draw(v);
    else if (waiting) void guessRound(v, toGuess(v), 0);
    else results(v, false);
  });
}

// ---------- draw ----------
async function draw(v: View) {
  const turn = await api<{ word: string; tier: number }>(`/api/s/${v.id}/turn`, { pid, name: myName });
  const el = screen(`
    <div class="top"><div class="grow"><span class="chip">✏️ <span class="timer" id="timer">${DRAW_SECONDS}</span></span></div>${icons()}</div>
    <div class="panel prompt pop"><div class="k">Draw this · keep it secret</div><div class="w">${esc(turn.word)}</div></div>
    <div class="paper"><canvas id="cv" width="${GRID}" height="${GRID}" aria-label="Drawing canvas"></canvas></div>
    <div class="tools">${INK.map((c, i) => `<button class="ink ${i === 0 ? "on" : ""} ${i === INK.length - 1 ? "eraser" : ""}" data-ink="${i}" style="background:${c}" aria-label="${i === INK.length - 1 ? "Eraser" : `Color ${i + 1}`}"></button>`).join("")}</div>
    <div class="tools">
      <button class="tool on" data-brush="0">Thin</button><button class="tool" data-brush="1">Thick</button>
      <button class="tool" id="undo">↶ Undo</button><button class="tool" id="clear">Clear</button>
    </div>
    <div class="bottom" style="margin-top:4px"><button class="btn" id="done">I'm done</button></div>`);
  wireTop(el);
  const cv = el.querySelector<HTMLCanvasElement>("#cv")!;
  const g = cv.getContext("2d")!;
  const strokes: Stroke[] = [];
  let ink = 0, brush = 0, cur: Stroke | null = null;
  const redraw = () => renderStrokes(g, strokes);
  const cell = (e: PointerEvent) => {
    const r = cv.getBoundingClientRect();
    return [Math.max(0, Math.min(GRID - 1, Math.floor(((e.clientX - r.left) / r.width) * GRID))), Math.max(0, Math.min(GRID - 1, Math.floor(((e.clientY - r.top) / r.height) * GRID)))];
  };
  cv.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    const [x, y] = cell(e);
    cur = [ink, brush, [x, y]];
    strokes.push(cur);
    redraw();
  });
  cv.addEventListener("pointermove", (e) => {
    if (!cur) return;
    for (const ev of e.getCoalescedEvents?.() ?? [e]) {
      const [x, y] = cell(ev);
      const p = cur[2];
      if (p[p.length - 2] !== x || p[p.length - 1] !== y) p.push(x, y);
    }
    redraw();
  });
  const end = () => (cur = null);
  cv.addEventListener("pointerup", end);
  cv.addEventListener("pointercancel", end);
  el.querySelectorAll<HTMLButtonElement>(".ink").forEach((b) =>
    b.addEventListener("click", () => {
      ink = Number(b.dataset.ink);
      el.querySelectorAll(".ink").forEach((x) => x.classList.toggle("on", x === b));
      audio.tick(false);
    }),
  );
  el.querySelectorAll<HTMLButtonElement>("[data-brush]").forEach((b) =>
    b.addEventListener("click", () => {
      brush = Number(b.dataset.brush);
      el.querySelectorAll("[data-brush]").forEach((x) => x.classList.toggle("on", x === b));
    }),
  );
  el.querySelector("#undo")!.addEventListener("click", () => {
    strokes.pop();
    redraw();
  });
  el.querySelector("#clear")!.addEventListener("click", () => {
    strokes.length = 0;
    redraw();
  });

  // timer
  const timer = el.querySelector<HTMLElement>("#timer")!;
  const endAt = performance.now() + DRAW_SECONDS * 1000;
  let submitted = false;
  const submit = async () => {
    if (submitted) return;
    submitted = true;
    end();
    const big = document.createElement("canvas");
    big.width = big.height = 256;
    const bg = big.getContext("2d")!;
    bg.imageSmoothingEnabled = false;
    bg.drawImage(strokesCanvas(strokes, "#ffffff"), 0, 0, 256, 256);
    screen(`<div class="top"><div class="grow"></div>${icons()}</div>
      <div class="paper" style="margin-top:6vh"><canvas id="mine" width="${GRID}" height="${GRID}"></canvas></div>
      <p class="verdict pop" id="ai">🤖 The AI is looking at your masterpiece…</p>`);
    renderStrokes(document.querySelector<HTMLCanvasElement>("#mine")!.getContext("2d")!, strokes);
    let res: { ai?: { guess: string; correct: boolean } | null; word?: string } = {};
    try {
      res = await api(`/api/s/${v.id}/draw`, { pid, name: myName, strokes, png: big.toDataURL("image/png") });
    } catch {
      /* keep going */
    }
    const aiEl = document.getElementById("ai")!;
    if (res.ai?.correct) {
      aiEl.innerHTML = `🤖 The AI got it: <b>${esc(res.ai.guess)}</b>! +50`;
      audio.word(6, true);
    } else if (res.ai) {
      aiEl.innerHTML = `🤖 The AI thinks it's… <b>${esc(res.ai.guess)}</b>`;
      audio.thud();
    } else aiEl.textContent = "Saved. Your friends will guess it next.";
    await sleep(1800);
    const fresh = await view().catch(() => v);
    const next = toGuess(fresh);
    if (next.length) void guessRound(fresh, next, 0);
    else results(fresh, true);
  };
  el.querySelector("#done")!.addEventListener("click", () => void submit());
  const tick = () => {
    if (submitted) return;
    const left = Math.max(0, (endAt - performance.now()) / 1000);
    timer.textContent = String(Math.ceil(left));
    timer.classList.toggle("low", left < 6);
    if (left <= 0) return void submit();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- guess ----------
async function guessRound(v: View, list: DrawingView[], k: number) {
  if (k >= list.length) return results(await view().catch(() => v), true);
  const d = list[k];
  const open = await api<{ secondsLeft: number }>(`/api/s/${v.id}/open`, { pid, name: myName, drawing: d.id });
  const el = screen(`
    <div class="top"><div class="grow"><span class="chip">⏱ <span class="timer" id="timer">${Math.ceil(open.secondsLeft)}</span></span></div>${icons()}</div>
    <div class="panel prompt pop"><div class="k">${esc(d.artist)} drew… (${k + 1} of ${list.length})</div><div class="blanks">${"_ ".repeat(d.length).trim()}</div></div>
    <div class="paper"><canvas id="cv" width="${GRID}" height="${GRID}"></canvas></div>
    <p class="verdict" id="fb"></p>
    <form class="row" id="f"><input class="field" id="g" maxlength="30" autocomplete="off" placeholder="Your guess" aria-label="Your guess" /><button class="btn" style="flex:0 0 96px" type="submit">Guess</button></form>
    <button class="link" id="skip">Skip</button>`);
  wireTop(el);
  const g = el.querySelector<HTMLCanvasElement>("#cv")!.getContext("2d")!;
  const input = el.querySelector<HTMLInputElement>("#g")!;
  const fb = el.querySelector<HTMLElement>("#fb")!;
  const timer = el.querySelector<HTMLElement>("#timer")!;
  input.focus();
  // replay the drawing stroke by stroke
  const t0 = performance.now();
  const replay = (now: number) => {
    const f = Math.min(1, (now - t0) / 2600);
    renderStrokes(g, d.strokes, f);
    if (f < 1) requestAnimationFrame(replay);
  };
  requestAnimationFrame(replay);

  let done = false;
  const endAt = performance.now() + open.secondsLeft * 1000;
  const finish = async (res: { correct?: boolean; points?: number; word?: string }) => {
    done = true;
    if (res.correct) {
      fb.innerHTML = `Nailed it: <b>${esc(res.word ?? "")}</b> · +${res.points}`;
      audio.word(6, true);
      navigator.vibrate?.(15);
    } else {
      fb.innerHTML = `It was <b>${esc(res.word ?? "")}</b>`;
      audio.thud();
    }
    renderStrokes(g, d.strokes, 1);
    await sleep(1600);
    void guessRound(v, list, k + 1);
  };
  el.querySelector("#f")!.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || done) return;
    const res = await api<{ correct: boolean; done: boolean; points?: number; word?: string }>(`/api/s/${v.id}/guess`, { pid, name: myName, drawing: d.id, text });
    if (res.done) return finish(res);
    fb.textContent = "Nope, keep going";
    input.classList.remove("shake");
    void input.offsetWidth;
    input.classList.add("shake");
    input.select();
    audio.tick(true);
  });
  const giveUp = async () => {
    if (done) return;
    const res = await api<{ word?: string }>(`/api/s/${v.id}/guess`, { pid, name: myName, drawing: d.id, giveUp: true });
    void finish({ correct: false, word: res.word });
  };
  el.querySelector("#skip")!.addEventListener("click", () => void giveUp());
  const tick = () => {
    if (done) return;
    const left = Math.max(0, (endAt - performance.now()) / 1000);
    timer.textContent = String(Math.ceil(left));
    timer.classList.toggle("low", left < 6);
    if (left <= 0) return void giveUp();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---------- results ----------
function results(v: View, justPlayed: boolean) {
  const p = v.pack;
  const me = v.me;
  const pos = v.board.findIndex((b) => b.me);
  if (justPlayed && me) {
    const place = v.board.length > 1 ? (pos === 0 ? " · took the lead" : ` · #${pos + 1} of ${v.board.length}`) : "";
    toChat({ type: "finished", ref: `s:${v.id}`, text: `played ${p.title} · ${me.score} pts${place}` });
  }
  const mine = v.drawings.find((d) => d.own);
  const seen = v.drawings.filter((d) => d.own || d.guessed);
  const el = screen(`
    <div class="top"><div class="grow"></div>${icons()}</div>
    <div class="total"><div class="lbl">Your points</div><div class="big">${me?.score ?? 0}</div></div>
    ${leadersHtml(v)}
    ${mine ? `<p class="verdict">${mine.correctGuesses ? `${mine.correctGuesses} friend${mine.correctGuesses > 1 ? "s" : ""} guessed your drawing` : "Nobody's guessed your drawing yet"}${mine.ai ? ` · the AI said <b>${esc(mine.ai.guess)}</b>` : ""}</p>` : ""}
    <div class="gallery">${seen
      .map(
        (d, i) => `<div class="card"><canvas data-i="${i}" width="${GRID}" height="${GRID}"></canvas>
          <div class="cap">${esc(d.word ?? "")}</div>
          <div class="meta">${d.own ? "Your drawing" : `by ${esc(d.artist)}${d.guessed ? (d.guessed.correct ? ` · +${d.guessed.points}` : " · missed") : ""}`}</div></div>`,
      )
      .join("")}</div>
    <div class="bottom" style="margin-top:14px">
      ${EMBED ? `<button class="btn" id="back">Back to chat</button>` : `<button class="btn" id="home">Back</button>`}
    </div>`);
  wireTop(el);
  el.querySelectorAll<HTMLCanvasElement>(".card canvas").forEach((c) => renderStrokes(c.getContext("2d")!, seen[Number(c.dataset.i)].strokes, 1, "#fffdf8"));
  el.querySelector("#back")?.addEventListener("click", () => toChat({ type: "close" }));
  el.querySelector("#home")?.addEventListener("click", () => lobby(v));
}

// ---------- boot ----------
(async () => {
  try {
    const v = await view();
    studio(v.pack);
    addEventListener("resize", () => studio(v.pack));
    lobby(v);
  } catch {
    ui.innerHTML = `<div style="padding:40px 20px;text-align:center">This game has ended. Start a new one from the chat.</div>`;
  }
})();
