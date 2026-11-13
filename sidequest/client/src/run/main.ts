// Ghost Run: race through the topic's pixel world in three lanes. Tap left/right (or swipe, or arrow keys)
// to switch lanes, dodge hazards, grab boosts. Your friends' best runs race alongside you as ghosts.
import { buildCourse, COURSE_LENGTH, LANES, SAMPLE_MS, type Course, type Row } from "../../../shared/run";
import type { PublicPack } from "../../../shared/rarity";
import { Audio } from "../engine/audio";
import { SceneView } from "../rarity/scene";
import { contrastText } from "../theme";

interface Ghost {
  name: string;
  time: number;
  samples: number[];
}
interface View {
  id: string;
  course: Course;
  seed: number;
  board: { name: string; time: number; me: boolean }[];
  ghosts: Ghost[];
  me: { name: string; best: number | null; plays: number } | null;
}

const ui = document.getElementById("ui")!;
const worldEl = document.getElementById("world")!;
const tagsEl = document.getElementById("tags")!;
const audio = new Audio();
const params = new URLSearchParams(location.search);
const EMBED = params.has("embed");
const roomId = location.pathname.split("/").pop() ?? "";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const secs = (t: number) => `${t.toFixed(t < 100 ? 2 : 1)}s`;
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
    parent.postMessage({ source: "ghostrun", ...msg }, "*");
  } catch {
    /* not framed */
  }
};
async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`request failed (${r.status})`);
  return (await r.json()) as T;
}

// ---------- the world (shared renderer with Deep Cuts) ----------
let view: SceneView;
function worldFor(c: Course): PublicPack {
  const up = c.scene.kind !== "ocean" && c.scene.kind !== "dig";
  return {
    interest: c.interest,
    title: c.title,
    tagline: c.tagline,
    scene: c.scene,
    avatar: c.avatar,
    verb: "Go",
    host: { name: "", emoji: "", intro: "" },
    meter: { label: "", unit: "m", perPoint: 1, up, icon: "" },
    tiers: ["", "", "", "", "", ""],
    palette: { bg: c.scene.start[0], bg2: c.scene.start[1], card: "#232838", primary: c.palette.primary, accent: c.palette.accent, text: "#ffffff" },
    font: "Rubik",
    prompts: [],
  };
}
function theme(c: Course) {
  const s = document.documentElement.style;
  s.setProperty("--primary", c.palette.primary);
  s.setProperty("--accent", c.palette.accent);
  s.setProperty("--on-primary", contrastText(c.palette.primary));
  document.title = c.title;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", c.scene.start[0]);
}
const laneGap = () => Math.max(14, Math.min(26, view.artW * 0.17));
const laneX = (pos: number, lane: number) => view.pathX(pos) + (lane - 1) * laneGap();

function screen(html: string) {
  ui.innerHTML = `<div class="center">${html}</div>`;
  return ui.firstElementChild as HTMLElement;
}
const topBar = (extra = "") => `<div class="top"><div class="grow">${extra}</div><button class="icon" id="mute" aria-label="Sound on or off">${audio.muted ? "🔇" : "🔊"}</button>${EMBED ? `<button class="icon" id="close" aria-label="Back to chat">✕</button>` : ""}</div>`;
function wireTop(el: HTMLElement) {
  el.querySelector("#mute")?.addEventListener("click", (e) => {
    audio.unlock();
    (e.currentTarget as HTMLElement).textContent = audio.toggleMute() ? "🔇" : "🔊";
  });
  el.querySelector("#close")?.addEventListener("click", () => toChat({ type: "close" }));
}
const leadersHtml = (v: View) =>
  v.board.length
    ? `<p class="leaders">${v.board
        .slice(0, 3)
        .map((b) => `<span class="${b.me ? "me" : ""}">${esc(b.me ? "You" : b.name)} <b>${secs(b.time)}</b></span>`)
        .join('<span class="sep">·</span>')}</p>`
    : "";

/** Draw the static course (used behind the lobby and results too). */
function drawCourse(rows: Row[], c: Course, opts: { player?: { pos: number; lane: number }; ghosts?: { pos: number; lane: number }[]; t?: number } = {}) {
  return (ctx: CanvasRenderingContext2D, t: number) => {
    const H = view.artH;
    // lane guides
    const cam = opts.player?.pos ?? 0;
    for (let y = 0; y < H; y += 6) {
      const pos = cam + (view.screenY(cam) - y) * (c.scene.kind === "ocean" || c.scene.kind === "dig" ? -1 : 1);
      for (const k of [0.5, 1.5]) {
        const x = view.pathX(pos) + (k - 1) * laneGap();
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(Math.round(x), y, 1, 3);
      }
    }
    // finish line
    const fy = view.screenY(COURSE_LENGTH);
    if (fy > -10 && fy < H + 10) {
      const cx = view.pathX(COURSE_LENGTH), half = laneGap() * 1.7;
      for (let x = -half; x < half; x += 2) for (let r = 0; r < 2; r++) {
        ctx.fillStyle = (Math.floor(x / 2) + r) % 2 ? "#ffffff" : "#111111";
        ctx.fillRect(Math.round(cx + x), Math.round(fy + r * 2), 2, 2);
      }
    }
    // hazards and boosts
    for (const r of rows) {
      const y = view.screenY(r.pos);
      if (y < -12 || y > H + 12 || (r as Row & { done?: boolean }).done) continue;
      const x = laneX(r.pos, r.lane);
      if (r.kind === "boost") {
        ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.15 * Math.sin(t * 8)})`;
        ctx.fillRect(Math.round(x - 6), Math.round(y - 6), 12, 12);
        view.drawEmoji(r.emoji, x, y, 11);
      } else {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(Math.round(x - 5), Math.round(y + 5), 10, 2);
        view.drawEmoji(r.emoji, x, y, 13);
      }
    }
    // ghosts, then you
    for (const g of opts.ghosts ?? []) view.drawEmoji(c.avatar, laneX(g.pos, g.lane), view.screenY(g.pos), 15, 0.42);
    if (opts.player) {
      const x = laneX(opts.player.pos, opts.player.lane), y = view.screenY(opts.player.pos);
      // a bright ring so you never confuse yourself with a ghost
      ctx.fillStyle = c.palette.accent;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(Math.round(x - 7), Math.round(y + 7), 14, 2);
      ctx.fillRect(Math.round(x - 9), Math.round(y + 5), 2, 2);
      ctx.fillRect(Math.round(x + 7), Math.round(y + 5), 2, 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(Math.round(x - 1), Math.round(y - 13), 3, 2);
      ctx.fillRect(Math.round(x), Math.round(y - 11), 1, 1);
      view.drawEmoji(c.avatar, x, y + Math.sin((opts.t ?? t) * 14) * 0.6, 17);
    }
  };
}

// ---------- lobby ----------
function lobby(v: View) {
  const c = v.course;
  const rows = buildCourse(c, v.seed);
  view.setCam(0);
  view.overlay = drawCourse(rows, c, { player: { pos: 0, lane: 1 } });
  worldEl.classList.add("dim");
  tagsEl.innerHTML = "";
  const n = v.ghosts.length;
  const el = screen(`
    ${topBar()}
    <h1 class="title">${esc(c.title)}</h1>
    <p class="sub">${esc(c.tagline)}</p>
    <div class="bottom">
      ${leadersHtml(v)}
      <button class="btn" id="go">${v.me?.best ? "Race again" : n ? `Race ${n} ghost${n > 1 ? "s" : ""}` : "Set the time"}</button>
      <button class="link" id="how">How to play</button>
    </div>
    <div class="sheet" id="sheet" hidden><div class="panel">
      <b>${esc(c.avatar)} ${esc(c.title)}</b>
      <ol>
        <li>Tap the left or right side (or swipe) to switch lanes.</li>
        <li>Dodge ${c.obstacles.join(" ")}. Hitting one slows you right down.</li>
        <li>Grab ${esc(c.boost)} for a burst of speed.</li>
        <li>Your friends' best runs race beside you as ghosts. Fastest time in the chat wins.</li>
      </ol>
      <button class="btn" id="gotit">Got it</button>
    </div></div>`);
  wireTop(el);
  const sheet = el.querySelector<HTMLElement>("#sheet")!;
  el.querySelector("#how")!.addEventListener("click", () => (sheet.hidden = false));
  el.querySelector("#gotit")!.addEventListener("click", () => (sheet.hidden = true));
  el.querySelector("#go")!.addEventListener("click", () => {
    audio.unlock();
    void race(v);
  });
}

// ---------- the race ----------
async function race(v: View) {
  const c = v.course;
  const rows = buildCourse(c, v.seed).map((r) => ({ ...r, done: false }));
  const ghosts = v.ghosts.map((g) => ({ ...g, pos: 0, lane: 1 }));
  const me = { pos: 0, lane: 1, shownLane: 1 };
  worldEl.classList.remove("dim");
  const el = screen(`
    <div class="hud">
      <div class="panel clock" id="clock">0.00s</div>
      <div class="panel bar"><div class="track" id="track">${ghosts.map(() => `<i class="g"></i>`).join("")}<i id="me"></i></div><div class="lbl"><span>${esc(c.interest)}</span><span id="place"></span></div></div>
      <button class="icon" id="mute" aria-label="Sound on or off">${audio.muted ? "🔇" : "🔊"}</button>
      ${EMBED ? `<button class="icon" id="close" aria-label="Back to chat">✕</button>` : ""}
    </div>
    <p class="hint" id="hint">Tap left or right to switch lanes</p>`);
  wireTop(el);
  const clock = el.querySelector<HTMLElement>("#clock")!, place = el.querySelector<HTMLElement>("#place")!;
  const dots = [...el.querySelectorAll<HTMLElement>("#track i")];
  const hint = el.querySelector<HTMLElement>("#hint")!;
  tagsEl.innerHTML = ghosts.map((g) => `<span class="tag">${esc(g.name)}</span>`).join("");
  const tags = [...tagsEl.querySelectorAll<HTMLElement>(".tag")];

  let t = 0, running = false, speed = 0, boostLeft = 0, stumble = 0;
  const samples: number[] = [];
  let nextSample = 0;
  view.setCam(0);
  view.overlay = drawCourse(rows, c, {});
  // live overlay closure reads the current state
  view.overlay = (ctx, tt) => drawCourse(rows, c, { player: { pos: me.pos, lane: me.shownLane }, ghosts, t: tt })(ctx, tt);

  // input: tap halves, swipe, keys
  const move = (d: number) => {
    if (!running) return;
    const n = Math.max(0, Math.min(LANES - 1, me.lane + d));
    if (n !== me.lane) {
      me.lane = n;
      audio.tick(false);
      hint.style.opacity = "0";
    }
  };
  let sx = 0, sy = 0;
  const down = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    sx = e.clientX;
    sy = e.clientY;
  };
  const up = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const dx = e.clientX - sx;
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(e.clientY - sy)) move(Math.sign(dx));
    else move(e.clientX < innerWidth / 2 ? -1 : 1);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "a") move(-1);
    if (e.key === "ArrowRight" || e.key === "d") move(1);
  };
  addEventListener("pointerdown", down);
  addEventListener("pointerup", up);
  addEventListener("keydown", key);
  const cleanup = () => {
    removeEventListener("pointerdown", down);
    removeEventListener("pointerup", up);
    removeEventListener("keydown", key);
  };

  // countdown
  const cd = document.createElement("div");
  cd.className = "count";
  document.body.appendChild(cd);
  for (const s of ["3", "2", "1", "GO"]) {
    cd.innerHTML = `<span>${s}</span>`;
    audio.step(s === "GO" ? 9 : 3);
    await sleep(s === "GO" ? 450 : 650);
  }
  cd.remove();
  running = true;

  const banner = (text: string) => {
    const b = document.createElement("div");
    b.className = "banner";
    b.textContent = text;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 900);
  };

  await new Promise<void>((done) => {
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const f = me.pos / COURSE_LENGTH;
      const target = (64 + 20 * f) * (boostLeft > 0 ? 1.6 : 1);
      if (stumble > 0) {
        stumble -= dt;
        speed = Math.min(speed, 20);
      }
      speed += (target - speed) * Math.min(1, dt * (stumble > 0 ? 0.5 : 2.2));
      boostLeft = Math.max(0, boostLeft - dt);
      me.pos += speed * dt;
      me.shownLane += (me.lane - me.shownLane) * Math.min(1, dt * 16);
      view.setCam(me.pos);
      // collisions
      for (const r of rows) {
        if (r.done || r.lane !== me.lane || Math.abs(r.pos - me.pos) > 7) continue;
        r.done = true;
        if (r.kind === "obstacle") {
          stumble = 0.9;
          boostLeft = 0;
          view.shake = 1;
          audio.thud();
          navigator.vibrate?.(30);
        } else {
          boostLeft = 1.3;
          audio.play("whoosh");
          audio.word(4, false);
          banner(c.callouts[Math.floor(Math.random() * c.callouts.length)]);
        }
      }
      // ghosts follow their recorded runs
      const idx = Math.floor((t * 1000) / SAMPLE_MS);
      ghosts.forEach((g, k) => {
        const n = g.samples.length / 2;
        const i = Math.min(idx, n - 1);
        if (n > 0) {
          const nextI = Math.min(i + 1, n - 1);
          const frac = (t * 1000) / SAMPLE_MS - idx;
          g.pos = g.samples[i * 2] + (g.samples[nextI * 2] - g.samples[i * 2]) * Math.max(0, Math.min(1, frac));
          g.lane += (g.samples[i * 2 + 1] - g.lane) * Math.min(1, dt * 12);
        }
        if (idx >= n && n > 0) g.pos = COURSE_LENGTH + 10;
        dots[k].style.left = `${Math.min(100, (g.pos / COURSE_LENGTH) * 100)}%`;
        const tag = tags[k];
        const y = view.screenY(g.pos), x = laneX(g.pos, g.lane);
        const on = y > 4 && y < view.artH - 4;
        tag.style.display = on ? "" : "none";
        if (on) {
          tag.style.left = `${x * view.cssPx}px`;
          tag.style.top = `${(y - 10) * view.cssPx}px`;
        }
      });
      dots[dots.length - 1].style.left = `${Math.min(100, (me.pos / COURSE_LENGTH) * 100)}%`;
      const ahead = ghosts.filter((g) => g.pos > me.pos).length;
      place.textContent = ghosts.length ? `${ordinal(ahead + 1)} of ${ghosts.length + 1}` : "";
      clock.textContent = secs(t);
      if (t * 1000 >= nextSample) {
        samples.push(Math.round(me.pos), me.lane);
        nextSample += SAMPLE_MS;
      }
      if (me.pos >= COURSE_LENGTH) {
        running = false;
        cleanup();
        return done();
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  audio.finish();
  banner(c.finish);
  tagsEl.innerHTML = "";
  await sleep(1100);
  let after = v;
  try {
    after = await api<View>(`/api/r/${v.id}/score`, { pid, name: myName, time: t, samples });
  } catch {
    /* offline: still show results */
  }
  results(after, t);
}
const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

// ---------- results ----------
function results(v: View, time: number) {
  const c = v.course;
  const pos = v.board.findIndex((b) => b.me);
  const best = v.me?.best ?? time;
  const place = v.board.length > 1 ? ` · ${ordinal(pos + 1)} of ${v.board.length}` : "";
  toChat({ type: "finished", ref: `r:${v.id}`, text: `finished in ${secs(time)}${place}` });
  view.setCam(COURSE_LENGTH);
  view.overlay = drawCourse(buildCourse(c, v.seed), c, { player: { pos: COURSE_LENGTH, lane: 1 } });
  worldEl.classList.add("dim");
  const standing =
    v.board.length <= 1 ? "Send it to the chat. Your time is the one to beat." : pos === 0 ? `Fastest of ${v.board.length}. For now.` : `#${pos + 1} of ${v.board.length} · ${esc(v.board[0].name)} is ${(v.board[pos].time - v.board[0].time).toFixed(2)}s faster`;
  const el = screen(`
    ${topBar()}
    <div class="total">
      <div class="lbl">${esc(c.finish)}</div>
      <div class="big">${secs(time)}</div>
      <p class="standing">${Math.round(time * 100) / 100 > best ? `Your best: ${secs(best)} · ` : ""}${standing}</p>
    </div>
    ${v.board.length > 1 ? `<ol class="board panel">${v.board.slice(0, 5).map((b, k) => `<li class="${b.me ? "me" : ""}"><span>${k + 1}.</span><span class="who">${esc(b.me ? "You" : b.name)}</span><span class="t">${secs(b.time)}</span></li>`).join("")}</ol>` : ""}
    <div class="bottom">
      <button class="btn" id="again">Race again</button>
      ${EMBED ? `<button class="btn ghost" id="back">Back to chat</button>` : ""}
    </div>`);
  wireTop(el);
  el.querySelector("#again")!.addEventListener("click", async () => {
    const fresh = await api<View>(`/api/r/${v.id}?me=${pid}`).catch(() => v);
    void race(fresh);
  });
  el.querySelector("#back")?.addEventListener("click", () => toChat({ type: "close" }));
}

// ---------- boot ----------
(async () => {
  try {
    const v = await api<View>(`/api/r/${roomId}?me=${pid}`);
    theme(v.course);
    view = new SceneView(worldEl, worldFor(v.course), { gauge: false });
    view.avatarVisible = false;
    lobby(v);
  } catch {
    ui.innerHTML = `<div style="padding:40px 20px;text-align:center">This race has ended. Start a new one from the chat.</div>`;
  }
})();
