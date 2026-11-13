// App shell: home → loading → title card → play → results.
// Multiplayer is async, GamePigeon style: every generated game lives in a room (/g/<id>). Anyone with the
// link plays the same game on the same course (shared seed), and the room keeps a leaderboard of each
// player's best. Paste the link in a group chat and everyone competes on one board.
// A `#g=` hash link (no server state) still works as an offline 1v1 "score to beat" challenge.
import { cleanText, normalizeInterest, sanitizeConfig, type GameConfig } from "../../shared/schema";
import { decodeShare, encodeShare } from "../../shared/share";
import { Audio } from "./engine/audio";
import { Runner, type RunResult } from "./engine/runner";
import { contrastText } from "./theme";
import { TEMPLATE_IMPLS } from "./templates";
import { loadFonts, playWordHunt, type WordHuntResult } from "./games/wordhunt";
import { wordPoints, type Puzzle } from "../../shared/wordhunt";

interface Row {
  name: string;
  score: number;
  plays: number;
  me: boolean;
}
interface Session {
  cfg: GameConfig;
  seed?: number;
  roomId?: string;
  board?: Row[];
  /** word hunt: the room's shared board */
  puzzle?: Puzzle;
  /** hash-link challenges only */
  scoreToBeat?: number;
}

const app = document.getElementById("app")!;
const audio = new Audio();
const params = new URLSearchParams(location.search);
const BOT = params.has("bot"); // ?bot=1 → the game plays itself (demos / screenshots)
let runner: Runner | null = null;
let best = 0;

const CHIPS = ["F1", "Basketball", "K-pop", "Baking", "Cats", "Space"];
const HOME_PALETTE = { background: "#121019", surface: "#221d30", primary: "#ff5d73", accent: "#ffd166", danger: "#ff4d6d", text: "#fff7ec" };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const fmt = (n: number) => n.toLocaleString();

// ---------- identity (per device) ----------
const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};
const playerId = (() => {
  let id = store.get("sidequest.pid");
  if (!id || !/^[a-z0-9]{6,32}$/.test(id)) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
    store.set("sidequest.pid", id);
  }
  return id;
})();
const getName = () => store.get("sidequest.name") ?? "";

// ---------- api ----------
async function api<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(path, body === undefined ? undefined : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}
const fetchRoom = (id: string) => api<{ id: string; config: unknown; seed: number; scores: Row[]; puzzle?: Puzzle }>(`/api/rooms/${id}?me=${playerId}`);
const postScore = (id: string, score: number) => api<{ scores: Row[] }>(`/api/rooms/${id}/scores`, { playerId, name: getName() || "Player", score });

// ---------- shell ----------
function applyTheme(p: GameConfig["palette"]) {
  const r = document.documentElement.style;
  for (const [k, v] of Object.entries(p)) r.setProperty(`--${k}`, v);
  r.setProperty("--on-primary", contrastText(p.primary));
  r.setProperty("--on-accent", contrastText(p.accent));
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", p.background);
}

function screen(html: string, cls = "") {
  runner?.destroy();
  runner = null;
  app.innerHTML = `<div class="screen ${cls}">${html}</div>`;
  return app.firstElementChild as HTMLElement;
}

const muteButton = () => `<button class="mute" aria-label="Toggle sound">${audio.muted ? "🔇" : "🔊"}</button>`;
function wireMute(root: HTMLElement) {
  root.querySelector(".mute")?.addEventListener("click", (ev) => {
    ev.stopPropagation();
    audio.unlock();
    (ev.currentTarget as HTMLElement).textContent = audio.toggleMute() ? "🔇" : "🔊";
  });
}

function boardHtml(rows: Row[], limit = 5) {
  if (!rows.length) return `<p class="empty">No scores yet. Set the bar.</p>`;
  const medal = ["🥇", "🥈", "🥉"];
  let shown = rows.slice(0, limit);
  const mine = rows.findIndex((r) => r.me);
  if (mine >= limit) shown = [...rows.slice(0, limit - 1), rows[mine]];
  return `<ol class="board">${shown
    .map((r) => {
      const i = rows.indexOf(r);
      return `<li class="${r.me ? "me" : ""}"><span class="pos">${medal[i] ?? i + 1}</span><span class="who">${esc(r.name)}${r.me ? " (you)" : ""}</span><span class="pts">${fmt(r.score)}</span></li>`;
    })
    .join("")}</ol>`;
}

const roomUrl = (id: string) => `${location.origin}/g/${id}`;

async function share(s: Session, text: string, toast: HTMLElement) {
  const url = s.roomId ? roomUrl(s.roomId) : `${location.origin}/#${await encodeShare({ config: s.cfg, scoreToBeat: s.scoreToBeat })}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: s.cfg.title, text, url });
      return;
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast.textContent = "Link copied! Paste it in the chat.";
  } catch {
    toast.textContent = url;
  }
  toast.hidden = false;
}

// ---------- home ----------
function home() {
  history.replaceState(null, "", "/");
  applyTheme(HOME_PALETTE);
  const el = screen(
    `<div class="home">
      <div class="logo">🎮</div>
      <h1>Sidequest</h1>
      <p class="sub">Type what you're into. Get a game made for it.<br/>Send it to the group chat. Top the board.</p>
      <form class="ask">
        <input name="i" maxlength="60" autocomplete="off" placeholder="What are you into?" />
        <button class="btn primary" type="submit">Play</button>
      </form>
      <div class="chips">${CHIPS.map((c) => `<button class="chip" data-c="${c}">${c}</button>`).join("")}</div>
    </div>`,
  );
  const form = el.querySelector("form")!;
  const input = form.querySelector("input")!;
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (input.value.trim()) load(input.value);
    else input.focus();
  });
  el.querySelectorAll<HTMLButtonElement>(".chip").forEach((b) => b.addEventListener("click", () => load(b.dataset.c!)));
}

// ---------- loading ----------
async function load(raw: string) {
  audio.unlock();
  const interest = normalizeInterest(raw) || "fun";
  const lines = [`Studying ${interest}…`, `Mixing a ${interest} palette…`, `Picking the right emoji…`, `Writing fan-approved trash talk…`, `Tuning the difficulty…`, `Almost there…`];
  const el = screen(`<div class="loading"><div class="spinner">🎲</div><p class="status">${esc(lines[0])}</p></div>`);
  let i = 0;
  const status = el.querySelector(".status")!;
  const tick = setInterval(() => (status.textContent = lines[(i = Math.min(lines.length - 1, i + 1))]), 1400);
  const r = await api<{ config: unknown; roomId?: string; seed?: number; puzzle?: Puzzle }>("/api/generate", { interest });
  clearInterval(tick);
  best = 0;
  const cfg = sanitizeConfig(r?.config ?? { interest, template: "catcher" }, interest); // never dead-end
  if (r?.roomId) {
    history.replaceState(null, "", `/g/${r.roomId}`);
    title({ cfg, seed: r.seed, roomId: r.roomId, board: [], puzzle: r.puzzle });
  } else {
    history.replaceState(null, "", "/#" + (await encodeShare({ config: cfg })));
    title({ cfg });
  }
}

// ---------- title card ----------
function title(s: Session) {
  applyTheme(s.cfg.palette);
  const display = s.cfg.wordhunt?.font ?? "Rubik";
  document.documentElement.style.setProperty("--display", `"${display}"`);
  document.documentElement.style.setProperty("--display-style", display === "Saira Condensed" || display === "Fraunces" ? "italic" : "normal");
  if (s.cfg.wordhunt) void loadFonts(s.cfg);
  const cfg = s.cfg;
  const mods = cfg.modifiers.map((m) => `<span class="mod">${esc(m.replace(/_/g, " "))}</span>`).join("");
  const leader = s.board?.[0];
  const banner = leader && !leader.me ? `<div class="challenge">👑 ${esc(leader.name)} leads with <b>${fmt(leader.score)}</b></div>` : s.scoreToBeat ? `<div class="challenge">Beat <b>${fmt(s.scoreToBeat)}</b> at ${esc(cfg.title)}</div>` : "";
  const el = screen(
    `${muteButton()}
    <div class="card title-card">
      ${banner}
      <div class="hero">${cfg.sprites.player}</div>
      <h1>${esc(cfg.title)}</h1>
      <p class="tagline">${esc(cfg.tagline)}</p>
      ${cfg.template === "wordhunt" ? "" : `<div class="mods">${mods}</div>`}
      <p class="how">${esc(cfg.howToPlay)}</p>
      ${s.roomId ? `<input class="name" maxlength="16" placeholder="Your name" value="${esc(getName())}" autocomplete="nickname" />` : ""}
      <button class="btn primary big start">Tap to start</button>
      ${s.roomId ? `<div class="board-wrap"><h2>Leaderboard</h2>${boardHtml(s.board ?? [])}</div><button class="btn ghost invite">Invite the group chat</button><p class="toast" hidden></p>` : ""}
      <button class="link new">New interest</button>
    </div>`,
    "themed scroll",
  );
  wireMute(el);
  const nameInput = el.querySelector<HTMLInputElement>(".name");
  el.querySelector(".start")!.addEventListener("click", () => {
    if (nameInput) {
      const n = cleanText(nameInput.value, 16);
      if (!n) {
        nameInput.classList.add("shake");
        nameInput.focus();
        setTimeout(() => nameInput.classList.remove("shake"), 400);
        return;
      }
      store.set("sidequest.name", n);
    }
    play(s);
  });
  el.querySelector(".invite")?.addEventListener("click", () => share(s, `Play ${cfg.title} with me. Top the leaderboard.`, el.querySelector(".toast")!));
  el.querySelector(".new")!.addEventListener("click", home);
  if (BOT) play(s);
}

// ---------- play ----------
function play(s: Session) {
  audio.unlock();
  if (s.cfg.template === "wordhunt" && s.puzzle) {
    const puzzle = s.puzzle;
    const el = screen(`${muteButton()}<div class="wh-host"></div>`, "themed playing");
    wireMute(el);
    void loadFonts(s.cfg).then(() =>
      playWordHunt(el.querySelector<HTMLElement>(".wh-host")!, s.cfg, puzzle, audio, { bot: BOT }).then((r) => {
        const par = wordHuntPar(puzzle);
        return results(s, { score: r.score, won: r.score >= par * 0.6, par }, r);
      }),
    );
    return;
  }
  const el = screen(`${muteButton()}<div class="stage"></div>`, "themed playing");
  wireMute(el);
  runner = new Runner(el.querySelector(".stage")!, audio);
  runner.run(s.cfg, TEMPLATE_IMPLS[s.cfg.template]!, (r) => void results(s, r), { seed: s.seed, bot: BOT });
}

/** A "great round" score: about an eighth of every common word on the board. */
const wordHuntPar = (p: Puzzle) => Math.min(20000, Math.max(6000, p.words.filter((w) => w.c).reduce((t, w) => t + wordPoints(w.w.length, false), 0) * 0.12));

function wordHuntSummary(s: Session, wh: WordHuntResult) {
  const p = s.puzzle!;
  const got = new Set(wh.found.map((f) => f.w));
  const longest = wh.found.reduce((a, f) => (f.w.length > a.length ? f.w : a), "");
  const missed = p.words.filter((w) => w.c && !got.has(w.w) && !p.themed.some((t) => t.word === w.w)).sort((a, b) => b.w.length - a.w.length).slice(0, 3).map((w) => w.w);
  return `
    <div class="whr-stats">
      <div><b>${wh.found.length}</b><span>words</span></div>
      <div><b>${esc(longest || "–")}</b><span>longest</span></div>
      <div><b>${wh.themedFound.length}/${p.themed.length}</b><span>${esc(s.cfg.interest)} words</span></div>
    </div>
    <ul class="whr-themed">${p.themed.map((t) => `<li class="${got.has(t.word) ? "got" : ""}"><b>${esc(t.word)}</b><span>${esc(t.hint)}</span></li>`).join("")}</ul>
    ${missed.length ? `<p class="whr-missed">Longest words you missed: ${missed.map(esc).join(", ")}</p>` : ""}`;
}

// ---------- results ----------
async function results(s: Session, r: RunResult, wh?: WordHuntResult) {
  const cfg = s.cfg;
  const frac = r.score / Math.max(1, r.par);
  const rank = cfg.copy.ranks[frac < 0.25 ? 0 : frac < 0.6 ? 1 : frac < 1 ? 2 : 3];
  const newBest = r.score > best;
  best = Math.max(best, r.score);
  let standing = "";
  if (s.roomId) {
    const res = await postScore(s.roomId, r.score);
    if (res) s.board = res.scores;
    const rows = s.board ?? [];
    const pos = rows.findIndex((x) => x.me);
    if (pos === 0 && rows.length > 1) standing = "You're in the lead 👑";
    else if (pos === 0) standing = "First on the board. Now send it.";
    else if (pos > 0) standing = `You're #${pos + 1} of ${rows.length} · ${fmt(rows[0].score - rows[pos].score + 1)} to take the lead`;
  } else if (s.scoreToBeat !== undefined) {
    standing = r.score > s.scoreToBeat ? `You beat ${fmt(s.scoreToBeat)}! 🎉` : `${fmt(s.scoreToBeat - r.score + 1)} short of ${fmt(s.scoreToBeat)}`;
  }
  const el = screen(
    `${muteButton()}
    <div class="card results">
      <p class="verdict">${esc(r.won ? cfg.copy.win : cfg.copy.lose)}</p>
      <div class="score">0</div>
      <div class="rank">${esc(rank)}</div>
      <p class="beat">${esc(standing || (newBest ? "Personal best" : `Best: ${fmt(best)}`))}</p>
      ${wh ? wordHuntSummary(s, wh) : ""}
      ${s.roomId ? `<div class="board-wrap">${boardHtml(s.board ?? [], 6)}</div>` : ""}
      <button class="btn primary big again">Play again</button>
      <button class="btn accent share">${s.roomId ? "Send to the group chat" : "Challenge a friend"}</button>
      <button class="link new">New interest</button>
      <p class="toast" hidden></p>
    </div>`,
    "themed scroll",
  );
  wireMute(el);
  const sEl = el.querySelector<HTMLElement>(".score")!;
  const t0 = performance.now();
  const count = (now: number) => {
    const k = Math.min(1, (now - t0) / 700);
    sEl.textContent = fmt(Math.round(r.score * (1 - (1 - k) ** 3)));
    if (k < 1) requestAnimationFrame(count);
  };
  requestAnimationFrame(count);
  el.querySelector(".again")!.addEventListener("click", () => play(s));
  el.querySelector(".new")!.addEventListener("click", home);
  el.querySelector(".share")!.addEventListener("click", () => {
    const text = `I scored ${fmt(r.score)} at ${cfg.title}. Beat that.`;
    void share(s.roomId ? s : { ...s, scoreToBeat: r.score }, text, el.querySelector(".toast")!);
  });
}

// ---------- boot ----------
async function boot() {
  try {
    await Promise.race([document.fonts.load('600 20px "Rubik"'), new Promise((r) => setTimeout(r, 1200))]);
  } catch {
    /* fall back to ui-rounded */
  }
  const room = location.pathname.match(/^\/g\/([a-z0-9]{4,12})$/);
  if (room) {
    const data = await fetchRoom(room[1]);
    if (data) return title({ cfg: sanitizeConfig(data.config), seed: data.seed, roomId: data.id, board: data.scores, puzzle: data.puzzle });
  }
  const shared = location.hash.length > 3 ? await decodeShare(location.hash) : null;
  if (shared) return title({ cfg: shared.config, scoreToBeat: shared.scoreToBeat });
  home();
}
window.addEventListener("hashchange", () => void boot());
void boot();
