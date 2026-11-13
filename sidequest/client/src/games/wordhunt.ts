// Word hunt: swipe across touching letters on a 5x5 board to make words in 80 seconds.
// Themed words for the interest are hidden on the board and score double.
//
// This is the house-style reference: chunky keycap tiles on a themed table surface, one rising note per
// tile while swiping, and feedback that answers the player's action instead of shouting.
import type { GameConfig } from "../../../shared/schema";
import { adjacent, CELLS, MIN_LEN, ROUND_SECONDS, SIZE, wordPoints, type Puzzle } from "../../../shared/wordhunt";
import { Audio } from "../engine/audio";
import { contrastText } from "../theme";
import { WORDHUNT_CSS } from "./wordhunt.css";

export interface WordHuntResult {
  score: number;
  found: { w: string; pts: number; themed: boolean }[];
  themedFound: string[];
}

type State = "idle" | "building" | "word" | "themed" | "repeat";

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.ceil(s) % 60)).padStart(2, "0")}`;
const fmtPts = (n: number) => n.toLocaleString();
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

let cssInjected = false;
function injectCss() {
  if (cssInjected) return;
  cssInjected = true;
  const s = document.createElement("style");
  s.textContent = WORDHUNT_CSS;
  document.head.appendChild(s);
}

export function loadFonts(cfg: GameConfig) {
  const display = cfg.wordhunt?.font ?? "Rubik";
  const fam = (f: string, spec: string) => `family=${f.replace(/ /g, "+")}:${spec}`;
  const families = [fam("Rubik", "wght@500;600;700;800")];
  if (display !== "Rubik") families.push(display === "Saira Condensed" || display === "Fraunces" ? fam(display, "ital,wght@0,600;0,800;1,700;1,800") : fam(display, "wght@400;700"));
  const href = `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
  if (!document.querySelector(`link[href="${href}"]`)) {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    document.head.appendChild(l);
  }
  return Promise.race([
    Promise.all([document.fonts.load(`800 40px "Rubik"`), document.fonts.load(`800 40px "${display}"`)]).catch(() => undefined),
    new Promise((r) => setTimeout(r, 1500)),
  ]);
}

/** Mount a round into `host`. Resolves when the round ends. */
export function playWordHunt(host: HTMLElement, cfg: GameConfig, puzzle: Puzzle, audio: Audio, opts: { bot?: boolean } = {}): Promise<WordHuntResult> {
  injectCss();
  const wh = cfg.wordhunt!;
  const p = cfg.palette;
  const valid = new Map(puzzle.words.map((x) => [x.w, x.c]));
  const themedSet = new Map(puzzle.themed.map((t) => [t.word, t.hint]));
  const themedTotal = puzzle.themed.length;
  const stateColor: Record<Exclude<State, "idle">, string> = { building: "#e4e9f2", word: p.accent, themed: p.primary, repeat: "#ffc84a" };

  host.innerHTML = `
    <div class="wh" data-surface="${wh.surface}" style="--display:'${wh.font}'">
      <div class="wh-table" aria-hidden="true"></div>
      <header class="wh-top">
        <div class="wh-score"><span class="wh-num" data-score>0</span><span class="wh-unit">points</span></div>
        <div class="wh-clock" data-clock>${fmtClock(ROUND_SECONDS)}</div>
      </header>
      <div class="wh-theme" aria-label="Theme words found">
        <span class="wh-theme-label">${esc(cfg.interest)} words</span>
        <span class="wh-theme-dots">${puzzle.themed.map(() => `<i></i>`).join("")}</span>
      </div>
      <div class="wh-stage">
        <div class="wh-bubble" data-bubble aria-live="polite"><span class="wh-bubble-word"></span><span class="wh-bubble-pts"></span></div>
        <div class="wh-tray">
          <svg class="wh-path" aria-hidden="true"><polyline /></svg>
          <div class="wh-grid">${puzzle.board.map((ch, i) => `<div class="wh-tile" data-i="${i}" style="--d:${(Math.floor(i / SIZE) * 0.06 + (i % SIZE) * 0.02).toFixed(2)}s"><div class="wh-face">${ch}</div></div>`).join("")}</div>
          <div class="wh-lights" aria-hidden="true">${"<i></i>".repeat(5)}</div>
        </div>
        <div class="wh-hint" data-hint></div>
        <div class="wh-feed" data-feed></div>
      </div>
      <canvas class="wh-fx"></canvas>
    </div>`;

  const root = host.querySelector<HTMLElement>(".wh")!;
  const grid = root.querySelector<HTMLElement>(".wh-grid")!;
  const tray = root.querySelector<HTMLElement>(".wh-tray")!;
  const tiles = [...root.querySelectorAll<HTMLElement>(".wh-tile")];
  const poly = root.querySelector<SVGPolylineElement>(".wh-path polyline")!;
  const svg = root.querySelector<SVGSVGElement>(".wh-path")!;
  const bubble = root.querySelector<HTMLElement>("[data-bubble]")!;
  const bubbleWord = bubble.querySelector<HTMLElement>(".wh-bubble-word")!;
  const bubblePts = bubble.querySelector<HTMLElement>(".wh-bubble-pts")!;
  const scoreEl = root.querySelector<HTMLElement>("[data-score]")!;
  const clockEl = root.querySelector<HTMLElement>("[data-clock]")!;
  const hintEl = root.querySelector<HTMLElement>("[data-hint]")!;
  const feed = root.querySelector<HTMLElement>("[data-feed]")!;
  const dots = [...root.querySelectorAll<HTMLElement>(".wh-theme-dots i")];
  const lights = [...root.querySelectorAll<HTMLElement>(".wh-lights i")];
  const fx = new Fx(root.querySelector("canvas")!);

  root.style.setProperty("--word", stateColor.word);
  root.style.setProperty("--themed", stateColor.themed);
  root.style.setProperty("--repeat", stateColor.repeat);
  root.style.setProperty("--on-word", contrastText(stateColor.word));
  root.style.setProperty("--on-themed", contrastText(stateColor.themed));

  let path: number[] = [];
  let state: State = "idle";
  let score = 0, shownScore = 0;
  let running = false, ended = false;
  let endAt = 0;
  const found: WordHuntResult["found"] = [];
  const foundSet = new Set<string>();
  const themedFound: string[] = [];
  let hintTimer = 0, bubbleTimer = 0;

  // ---------- selection ----------
  const word = () => path.map((i) => puzzle.board[i]).join("");
  function classify(): State {
    const w = word();
    if (!path.length) return "idle";
    if (w.length < MIN_LEN || !valid.has(w)) return "building";
    if (foundSet.has(w)) return "repeat";
    return themedSet.has(w) ? "themed" : "word";
  }
  function paint() {
    state = classify();
    tiles.forEach((t, i) => {
      const on = path.includes(i);
      t.classList.toggle("on", on);
      t.dataset.state = on ? state : "";
    });
    const pts = tray.getBoundingClientRect();
    const centers = path.map((i) => {
      const r = tiles[i].getBoundingClientRect();
      return `${r.left + r.width / 2 - pts.left},${r.top + r.height / 2 - pts.top + 2}`;
    });
    poly.setAttribute("points", centers.join(" "));
    svg.dataset.state = state;
    clearTimeout(bubbleTimer);
    if (path.length) {
      const w = word();
      bubble.dataset.state = state;
      bubble.classList.add("show");
      bubble.classList.remove("shake", "fade");
      bubbleWord.textContent = w;
      bubblePts.textContent = state === "word" || state === "themed" ? `+${fmtPts(wordPoints(w.length, state === "themed"))}` : state === "repeat" ? wh.labels.repeat : "";
    }
  }
  function add(i: number) {
    if (path.includes(i)) {
      // sliding back onto the previous tile undoes the last letter
      if (path.length >= 2 && path[path.length - 2] === i) {
        path.pop();
        audio.unstep(path.length);
        paint();
      }
      return;
    }
    if (path.length && !adjacent(path[path.length - 1], i)) return;
    path.push(i);
    audio.step(path.length - 1);
    navigator.vibrate?.(5);
    paint();
  }

  function submit() {
    const w = word();
    const st = state;
    const cells = [...path];
    path = [];
    if (!w) return paint();
    if (st === "word" || st === "themed") {
      const themed = st === "themed";
      const pts = wordPoints(w.length, themed);
      score += pts;
      foundSet.add(w);
      found.push({ w, pts, themed });
      audio.word(w.length, themed);
      navigator.vibrate?.(themed ? [12, 40, 20] : 14);
      // tiles pop in order, the line stays a beat so the word reads
      cells.forEach((i, k) => {
        const t = tiles[i];
        t.dataset.state = st;
        t.classList.remove("pop");
        void t.offsetWidth;
        t.style.setProperty("--k", String(k));
        t.classList.add("pop");
      });
      const center = rectCenter(tiles[cells[Math.floor(cells.length / 2)]]);
      fx.burst(center.x, center.y, themed ? [p.primary, "#ffffff", p.accent] : [p.accent, "#ffffff"], themed ? 46 : 14 + w.length * 3, themed ? 1.4 : 1);
      if (themed) {
        themedFound.push(w);
        const dot = dots[themedFound.length - 1];
        dot?.classList.add("got");
        showHint(w, themedSet.get(w) ?? "");
      }
      addFeed(w, themed, pts);
      bubble.dataset.state = st;
      bubbleWord.textContent = themed ? wh.labels.themed : w;
      bubblePts.textContent = `+${fmtPts(pts)}`;
      bubble.classList.add("show", "win");
      bubbleTimer = window.setTimeout(() => bubble.classList.remove("show", "win"), 650);
      tray.classList.remove("bump");
      void tray.offsetWidth;
      tray.classList.add("bump");
    } else {
      if (st === "repeat") audio.repeat();
      else if (w.length >= MIN_LEN) audio.thud();
      bubble.classList.add(w.length >= MIN_LEN ? "shake" : "fade");
      cells.forEach((i) => {
        const t = tiles[i];
        t.classList.remove("nope");
        void t.offsetWidth;
        if (w.length >= MIN_LEN) t.classList.add("nope");
      });
      bubbleTimer = window.setTimeout(() => bubble.classList.remove("show", "shake", "fade"), 380);
    }
    tiles.forEach((t) => t.classList.remove("on"));
    poly.setAttribute("points", "");
    window.setTimeout(() => tiles.forEach((t) => !t.classList.contains("on") && (t.dataset.state = "")), 420);
  }

  function showHint(w: string, hint: string) {
    clearTimeout(hintTimer);
    hintEl.innerHTML = `<b>${esc(w)}</b>${hint ? esc(hint) : ""}`;
    hintEl.classList.add("show");
    hintTimer = window.setTimeout(() => hintEl.classList.remove("show"), 2600);
  }

  function addFeed(w: string, themed: boolean, pts: number) {
    const chip = document.createElement("span");
    chip.className = `wh-chip${themed ? " themed" : ""}`;
    chip.innerHTML = `${esc(w)}<small>${fmtPts(pts)}</small>`;
    feed.prepend(chip);
    while (feed.children.length > 6) feed.lastElementChild!.remove();
  }

  const rectCenter = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  // ---------- input: circular hit zones so diagonals don't grab neighbours; interpolate fast swipes ----------
  let last: { x: number; y: number } | null = null;
  function tileAt(x: number, y: number): number {
    const g = grid.getBoundingClientRect();
    const cw = g.width / SIZE, ch = g.height / SIZE;
    const c = Math.floor((x - g.left) / cw), r = Math.floor((y - g.top) / ch);
    if (c < 0 || r < 0 || c >= SIZE || r >= SIZE) return -1;
    const cx = g.left + (c + 0.5) * cw, cy = g.top + (r + 0.5) * ch;
    return Math.hypot(x - cx, y - cy) < cw * 0.43 ? r * SIZE + c : -1;
  }
  function track(x: number, y: number) {
    const from = last ?? { x, y };
    const steps = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) / 8));
    for (let s = 1; s <= steps; s++) {
      const i = tileAt(from.x + ((x - from.x) * s) / steps, from.y + ((y - from.y) * s) / steps);
      if (i >= 0 && i !== path[path.length - 1]) add(i);
    }
    last = { x, y };
  }
  let pointer: number | null = null;
  const down = (e: PointerEvent) => {
    if (!running || pointer !== null) return;
    e.preventDefault();
    audio.unlock();
    pointer = e.pointerId;
    grid.setPointerCapture(e.pointerId);
    last = null;
    path = [];
    track(e.clientX, e.clientY);
  };
  const move = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    e.preventDefault();
    for (const ev of e.getCoalescedEvents?.() ?? [e]) track(ev.clientX, ev.clientY);
  };
  const up = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    pointer = null;
    last = null;
    if (running) submit();
  };
  grid.addEventListener("pointerdown", down);
  grid.addEventListener("pointermove", move);
  grid.addEventListener("pointerup", up);
  grid.addEventListener("pointercancel", up);
  const block = (e: Event) => e.preventDefault();
  root.addEventListener("touchmove", block, { passive: false });

  // ---------- clock + score roll ----------
  let raf = 0;
  let lastTick = -1;
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    fx.update();
    if (shownScore !== score) {
      shownScore += Math.ceil((score - shownScore) * 0.18);
      if (Math.abs(score - shownScore) < 3) shownScore = score;
      scoreEl.textContent = fmtPts(shownScore);
    }
    if (!running) return;
    const left = Math.max(0, (endAt - now) / 1000);
    clockEl.textContent = fmtClock(left);
    const sec = Math.ceil(left);
    if (left <= 10 && sec !== lastTick) {
      lastTick = sec;
      clockEl.classList.add("urgent");
      clockEl.classList.remove("beat");
      void clockEl.offsetWidth;
      clockEl.classList.add("beat");
      if (sec > 0) audio.tick(sec <= 5);
    }
    if (left <= 0) finish();
  };
  raf = requestAnimationFrame(frame);

  let resolveRound!: (r: WordHuntResult) => void;
  const done = new Promise<WordHuntResult>((r) => (resolveRound = r));

  function finish() {
    if (ended) return;
    ended = true;
    running = false;
    path = [];
    paint();
    bubble.classList.remove("show");
    audio.finish();
    root.classList.add("over");
    tiles.forEach((t, i) => t.style.setProperty("--d", `${((SIZE - 1 - Math.floor(i / SIZE)) * 0.05 + (i % SIZE) * 0.015).toFixed(2)}s`));
    window.setTimeout(() => {
      cancelAnimationFrame(raf);
      grid.removeEventListener("pointerdown", down);
      root.removeEventListener("touchmove", block);
      fx.dispose();
      resolveRound({ score, found, themedFound });
    }, 1300);
  }

  // ---------- start: deal the tiles, then start lights (pit lane) or a short count ----------
  const start = () => {
    running = true;
    endAt = performance.now() + ROUND_SECONDS * 1000;
    root.classList.add("live");
    if (opts.bot) runBot();
  };
  root.classList.add("deal");
  for (let r = 0; r < SIZE; r++) audio.clack(0.12 + r * 0.06);
  const dealt = 520;
  if (wh.surface === "pitlane") {
    // five red lights, then lights out
    lights.forEach((l, k) =>
      window.setTimeout(() => {
        l.classList.add("on");
        audio.beep(false);
      }, dealt + 120 + k * 280),
    );
    window.setTimeout(() => {
      root.classList.add("go");
      audio.beep(true);
      start();
    }, dealt + 120 + 5 * 280 + 260);
  } else {
    window.setTimeout(start, dealt + 250);
  }

  // ---------- bot (?bot=1): plays real words so the round can be watched / captured ----------
  function runBot() {
    const pool = puzzle.words.filter((x) => x.c).map((x) => x.w).sort(() => Math.random() - 0.5);
    pool.sort((a, b) => Number(themedSet.has(b)) - Number(themedSet.has(a)));
    const go = async () => {
      for (const w of pool) {
        if (!running) return;
        const cells = pathFor(w);
        if (!cells || foundSet.has(w)) continue;
        for (const i of cells) {
          if (!running) return;
          add(i);
          await sleep(85);
        }
        await sleep(160);
        submit();
        await sleep(450);
      }
    };
    void go();
  }
  function pathFor(w: string): number[] | null {
    const used = new Array(CELLS).fill(false);
    const out: number[] = [];
    const dfs = (i: number, k: number): boolean => {
      if (used[i] || puzzle.board[i] !== w[k]) return false;
      out.push(i);
      if (k === w.length - 1) return true;
      used[i] = true;
      for (let j = 0; j < CELLS; j++) if (adjacent(i, j) && dfs(j, k + 1)) return true;
      used[i] = false;
      out.pop();
      return false;
    };
    for (let i = 0; i < CELLS; i++) if (dfs(i, 0)) return out;
    return null;
  }

  return done;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- particles: small, quick, only on found words ----------
interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  shape: 0 | 1;
}
class Fx {
  private ctx: CanvasRenderingContext2D;
  private ps: P[] = [];
  private dpr = Math.min(2, window.devicePixelRatio || 1);
  private onResize = () => this.resize();
  private lastT = performance.now();
  constructor(private c: HTMLCanvasElement) {
    this.ctx = c.getContext("2d")!;
    this.resize();
    window.addEventListener("resize", this.onResize);
  }
  private resize() {
    this.c.width = innerWidth * this.dpr;
    this.c.height = innerHeight * this.dpr;
  }
  burst(x: number, y: number, colors: string[], n: number, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (120 + Math.random() * 380) * power;
      const life = 0.5 + Math.random() * 0.5;
      this.ps.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 160 * power, life, max: life, size: 4 + Math.random() * 5, color: colors[i % colors.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, shape: Math.random() < 0.5 ? 0 : 1 });
    }
  }
  update() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of this.ps) {
      p.life -= dt;
      p.vy += 900 * dt;
      p.vx *= 1 - 1.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = Math.min(1, a * 1.6);
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.shape === 0) ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    this.ps = this.ps.filter((p) => p.life > 0);
  }
  dispose() {
    window.removeEventListener("resize", this.onResize);
  }
}
