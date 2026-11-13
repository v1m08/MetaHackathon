// Order Up!: run a themed restaurant for 75 seconds. Tap ingredients onto the plate (grill some first),
// tap a customer to serve. Same customers in the same order for everyone in the room.
import { BURN_SECONDS, COOK_SECONDS, MAX_PLATE, plateMatches, ROUND_SECONDS, schedule, SEATS, type Arrival, type Ingredient, type Menu } from "../../../shared/kitchen";
import { Audio } from "../engine/audio";
import { contrastText } from "../theme";
import { drawWall, foodSprite, personSprite, type Mood } from "./pixel";

/** A food item as pixel art. */
const food = (emoji: string, size: number, cls = "") => `<img class="px ${cls}" src="${foodSprite(emoji)}" width="${size}" height="${size}" alt="" draggable="false">`;

interface View {
  id: string;
  menu: Menu;
  seed: number;
  board: { name: string; score: number; served: number; me: boolean }[];
  me: { name: string; best: number; plays: number } | null;
}

const app = document.getElementById("app")!;
let currentMenu: Menu | null = null;
const audio = new Audio();
const params = new URLSearchParams(location.search);
const EMBED = params.has("embed");
const roomId = location.pathname.split("/").pop() ?? "";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const pid = (() => {
  const p = params.get("pid") ?? "";
  if (EMBED && /^[a-z0-9]{6,32}$/.test(p)) return p;
  try {
    let id = localStorage.getItem("sq.pid");
    if (!id) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
      localStorage.setItem("sq.pid", id);
    }
    return id;
  } catch {
    return "anon" + Math.random().toString(36).slice(2, 10);
  }
})();
const myName = (params.get("name") ?? "").slice(0, 16) || "Player";
const toChat = (msg: Record<string, unknown>) => {
  try {
    parent.postMessage({ source: "orderup", ...msg }, "*");
  } catch {
    /* not framed */
  }
};

async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`request failed (${r.status})`);
  return (await r.json()) as T;
}

function theme(m: Menu) {
  const s = document.documentElement.style;
  for (const [k, v] of Object.entries(m.theme)) s.setProperty(`--${k}`, v);
  s.setProperty("--on-primary", contrastText(m.theme.primary));
  // ink that reads on the wall
  s.setProperty("--wall-ink", contrastText(m.theme.wall));
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", m.theme.primary);
  document.title = m.name;
}

// ---------- the restaurant scene (static parts) ----------
function sceneHtml(m: Menu) {
  const hasGrill = m.ingredients.some((i) => i.cook);
  return `
    <div class="room">
      <div class="awning">
        <div class="hud">
          <span class="pill coins" id="coins">💰 $0</span>
          <span class="pill time" id="time">⏱ ${ROUND_SECONDS}</span>
          <span class="pill combo" id="combo"></span>
          <button class="icon" id="mute" aria-label="Sound on or off">${audio.muted ? "🔇" : "🔊"}</button>
          ${EMBED ? `<button class="icon" id="close" aria-label="Back to chat" style="margin-left:0">✕</button>` : ""}
        </div>
      </div>
      <canvas class="wall-art" aria-hidden="true"></canvas>
      <div class="menu-board" aria-label="Menu">
        <div class="mb-title">${esc(m.name)}</div>
        ${m.dishes
          .map((d) => `<div class="mb-row"><span class="mb-name">${esc(d.name)}</span><span class="mb-items">${d.items.map((id) => food(m.ingredients.find((i) => i.id === id)?.emoji ?? "❓", 18)).join("")}</span><span class="mb-price">$${d.price}</span></div>`)
          .join("")}
      </div>
      <div class="seats" id="seats">${Array.from({ length: SEATS }, (_, i) => `<div class="seat" data-seat="${i}"></div>`).join("")}</div>
      <div class="counter"></div>
      <div class="kitchen">
        <div class="station">
          <div class="grill ${hasGrill ? "" : "none"}" id="grill">${[0, 1].map((i) => `<button class="slot" data-slot="${i}" aria-label="Grill slot ${i + 1}"></button>`).join("")}</div>
          <div class="plate-wrap"><div class="plate" id="plate"></div><div class="plate-label" id="plabel">Tap ingredients to plate</div></div>
          <button class="trash" id="trash" aria-label="Clear plate">🗑️</button>
        </div>
        <div class="pantry">${m.ingredients
          .map((ing) => `<button class="ing" data-ing="${esc(ing.id)}"><span class="e">${food(ing.emoji, 40)}</span><span class="n">${esc(ing.name)}</span>${ing.cook ? `<span class="fire">🔥</span>` : ""}</button>`)
          .join("")}</div>
      </div>
    </div>`;
}

function paintWall(m: Menu) {
  const c = document.querySelector<HTMLCanvasElement>(".wall-art");
  if (c) drawWall(c, m.theme, m.ingredients.map((i) => i.emoji));
}

function wireCommon() {
  const menu = currentMenu;
  if (menu) requestAnimationFrame(() => paintWall(menu));
  document.getElementById("mute")?.addEventListener("click", (e) => {
    audio.unlock();
    (e.currentTarget as HTMLElement).textContent = audio.toggleMute() ? "🔇" : "🔊";
  });
  document.getElementById("close")?.addEventListener("click", () => toChat({ type: "close" }));
}

function floatAt(el: Element, text: string, bad = false) {
  const r = el.getBoundingClientRect();
  const f = document.createElement("div");
  f.className = `float${bad ? " bad" : ""}`;
  f.textContent = text;
  f.style.left = `${r.left + r.width / 2}px`;
  f.style.top = `${r.top}px`;
  f.style.transform = "translateX(-50%)";
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 950);
}
function toast(text: string) {
  const room = document.querySelector(".room")!;
  room.querySelector(".toast")?.remove();
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = text;
  room.appendChild(t);
  setTimeout(() => t.remove(), 1300);
}

// ---------- lobby ----------
function leadersHtml(v: View) {
  if (!v.board.length) return "";
  return `<p class="leaders">${v.board
    .slice(0, 3)
    .map((b) => `${esc(b.me ? "You" : b.name)} <b>${money(b.score)}</b>`)
    .join('<span class="sep">·</span>')}</p>`;
}

function lobby(v: View) {
  const m = v.menu;
  app.innerHTML = sceneHtml(m);
  const room = app.querySelector(".room")!;
  room.insertAdjacentHTML(
    "beforeend",
    `<div class="overlay" id="ov">
      <div class="chef">${m.chef.emoji}</div>
      <h1>${esc(m.name)}</h1>
      <p class="tag">${esc(m.tagline)}</p>
      <div class="dishes">${[...new Set(m.ingredients.slice(0, 5).map((i) => i.emoji))].map((e) => food(e, 40)).join("")}</div>
      <div class="actions">
        ${leadersHtml(v)}
        <button class="btn" id="go">${v.me ? "Play again" : "Open the restaurant"}</button>
        <button class="link" id="how">How to play</button>
      </div>
    </div>
    <div class="sheet" id="sheet" hidden><div class="card">
      <b>${esc(m.chef.emoji)} ${esc(m.chef.name)}:</b> ${esc(m.chef.line)}
      <ol>
        <li>Customers show their order in a bubble.</li>
        <li>Tap ingredients to put them on your plate. 🔥 items go on the grill first. Tap them when they glow, before they burn.</li>
        <li>Tap the customer to serve. Fast service earns tips, and serving in a row builds a combo.</li>
      </ol>
      <button class="btn" id="gotit" style="width:100%">Got it</button>
    </div></div>`,
  );
  wireCommon();
  const sheet = document.getElementById("sheet")!;
  document.getElementById("how")!.addEventListener("click", () => (sheet.hidden = false));
  document.getElementById("gotit")!.addEventListener("click", () => (sheet.hidden = true));
  document.getElementById("go")!.addEventListener("click", () => {
    audio.unlock();
    void play(v);
  });
}

// ---------- the round ----------
interface Cust {
  a: Arrival;
  left: number; // patience seconds left
  el: HTMLElement;
  who: number; // which pixel person
  mood: Mood;
}
const setMood = (c: Cust, mood: Mood) => {
  if (c.mood === mood) return;
  c.mood = mood;
  c.el.querySelector<HTMLImageElement>(".person")!.src = personSprite(c.who, mood);
};
interface Slot {
  ing: Ingredient;
  t: number; // seconds on the grill
}

async function play(v: View) {
  const m = v.menu;
  const byId = new Map(m.ingredients.map((i) => [i.id, i]));
  app.innerHTML = sceneHtml(m);
  wireCommon();
  const room = app.querySelector<HTMLElement>(".room")!;
  const $ = (id: string) => document.getElementById(id)!;
  const seatsEl = [...room.querySelectorAll<HTMLElement>(".seat")];
  const slotsEl = [...room.querySelectorAll<HTMLButtonElement>(".slot")];
  const plateEl = $("plate"), plabel = $("plabel"), coinsEl = $("coins"), timeEl = $("time"), comboEl = $("combo");

  // countdown
  const cd = document.createElement("div");
  cd.className = "countdown";
  room.appendChild(cd);
  for (const s of ["3", "2", "1", "Open!"]) {
    cd.innerHTML = `<span>${s}</span>`;
    audio.step(s === "Open!" ? 9 : 2);
    await sleep(s === "Open!" ? 500 : 600);
  }
  cd.remove();

  const arrivals = schedule(m, v.seed);
  let next = 0;
  const queue: { a: Arrival; who: number }[] = [];
  const seats: (Cust | null)[] = Array(SEATS).fill(null);
  const grill: (Slot | null)[] = [null, null];
  let plate: string[] = [];
  let coins = 0, combo = 0, bestCombo = 0, served = 0, lost = 0;
  let t = 0, running = true, lastTick = -1;

  const renderPlate = () => {
    plateEl.innerHTML = plate.map((id) => `<span>${food(byId.get(id)?.emoji ?? "❓", 38)}</span>`).join("");
    plabel.textContent = plate.length ? plate.map((id) => byId.get(id)?.name).join(" + ") : "Tap ingredients to plate";
    // highlight customers whose order is on the plate, and tick off what's there
    seats.forEach((c, i) => {
      seatsEl[i].classList.toggle("tap-hint", !!c && plateMatches(plate, m.dishes[c.a.dish]));
      if (!c) return;
      const left = [...plate];
      c.el.querySelectorAll<HTMLElement>(".items span").forEach((s) => {
        const k = left.indexOf(s.dataset.id!);
        s.classList.toggle("got", k >= 0);
        if (k >= 0) left.splice(k, 1);
      });
    });
  };
  const renderCoins = () => (coinsEl.textContent = `💰 ${money(coins)}`);
  const renderCombo = () => {
    comboEl.classList.toggle("on", combo >= 2);
    comboEl.textContent = `🔥 x${combo}`;
  };

  function seat(i: number, a: Arrival, who: number) {
    const dish = m.dishes[a.dish];
    const el = document.createElement("div");
    el.className = "cust enter";
    el.innerHTML = `<div class="bubble"><div class="dish-name">${esc(dish.name)}</div><div class="items">${dish.items.map((id) => `<span data-id="${esc(id)}">${food(byId.get(id)?.emoji ?? "❓", 28)}</span>`).join("")}</div><div class="patience"><i></i></div></div><img class="px person" src="${personSprite(who, "wait")}" width="64" height="88" alt="Customer" draggable="false">`;
    seatsEl[i].appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("enter")));
    seats[i] = { a, left: a.patience, el, who, mood: "wait" };
    audio.step(1);
    renderPlate();
  }
  function leave(i: number, happy: boolean) {
    const c = seats[i];
    if (!c) return;
    seats[i] = null;
    if (!happy) setMood(c, "angry");
    c.el.classList.add("leave");
    setTimeout(() => c.el.remove(), 400);
    seatsEl[i].classList.remove("tap-hint");
  }

  // ---------- input ----------
  room.querySelectorAll<HTMLButtonElement>(".ing").forEach((b) =>
    b.addEventListener("click", () => {
      if (!running) return;
      const ing = byId.get(b.dataset.ing!)!;
      if (ing.cook) {
        const free = grill.findIndex((s) => !s);
        if (free < 0) {
          toast("Grill's full");
          audio.thud();
          return;
        }
        grill[free] = { ing, t: 0 };
        audio.play("whoosh");
        return;
      }
      if (plate.length >= MAX_PLATE) return toast("Plate's full");
      plate.push(ing.id);
      audio.step(plate.length + 2);
      renderPlate();
    }),
  );
  slotsEl.forEach((el, i) =>
    el.addEventListener("click", () => {
      const s = grill[i];
      if (!running || !s) return;
      if (s.t >= COOK_SECONDS + BURN_SECONDS) {
        grill[i] = null;
        floatAt(el, "Tossed", true);
        audio.thud();
      } else if (s.t >= COOK_SECONDS) {
        if (plate.length >= MAX_PLATE) return toast("Plate's full");
        grill[i] = null;
        plate.push(s.ing.id);
        audio.step(plate.length + 4);
        renderPlate();
      } else {
        el.animate([{ transform: "translateX(-3px)" }, { transform: "translateX(3px)" }, { transform: "none" }], { duration: 160 });
      }
    }),
  );
  $("trash").addEventListener("click", () => {
    if (!plate.length) return;
    plate = [];
    renderPlate();
    audio.thud();
  });
  seatsEl.forEach((el, i) =>
    el.addEventListener("click", () => {
      const c = seats[i];
      if (!running || !c || !plate.length) return;
      const dish = m.dishes[c.a.dish];
      if (plateMatches(plate, dish)) {
        const frac = Math.max(0, c.left / c.a.patience);
        const tip = Math.round(dish.price * 0.6 * frac);
        combo++;
        bestCombo = Math.max(bestCombo, combo);
        const mult = 1 + Math.min(combo - 1, 4) * 0.25;
        const earned = Math.round((dish.price + tip) * mult);
        coins += earned;
        served++;
        plate = [];
        c.el.classList.add("served");
        setMood(c, "happy");
        floatAt(el, `+${money(earned)}${tip ? `  tip ${money(tip)}` : ""}`);
        audio.word(dish.items.length + 2, combo >= 3);
        navigator.vibrate?.(15);
        renderCoins();
        renderCombo();
        if (combo === 3 || combo === 6) toast(combo === 3 ? "🔥 On a roll!" : "🔥🔥 Kitchen legend!");
        setTimeout(() => leave(i, true), 450);
        renderPlate();
      } else {
        c.left = Math.max(0.5, c.left - c.a.patience * 0.25);
        c.el.classList.remove("wrong");
        void c.el.offsetWidth;
        c.el.classList.add("wrong");
        floatAt(el, "Not my order!", true);
        audio.thud();
      }
    }),
  );

  // ---------- loop ----------
  let last = performance.now();
  const frame = (now: number) => {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    t += dt;
    // arrivals
    while (next < arrivals.length && arrivals[next].at <= t) queue.push({ a: arrivals[next], who: v.seed % 997 + next++ });
    for (let i = 0; i < SEATS && queue.length; i++) if (!seats[i]) {
      const q = queue.shift()!;
      seat(i, q.a, q.who);
    }
    // patience
    seats.forEach((c, i) => {
      if (!c) return;
      c.left -= dt;
      const f = Math.max(0, c.left / c.a.patience);
      const bar = c.el.querySelector<HTMLElement>(".patience i")!;
      bar.style.transform = `scaleX(${f})`;
      bar.style.background = f > 0.5 ? "var(--accent)" : f > 0.25 ? "#f4a100" : "#e53935";
      if (c.mood !== "happy" && c.mood !== "angry") setMood(c, f < 0.3 ? "worried" : "wait");
      if (c.left <= 0) {
        lost++;
        combo = 0;
        renderCombo();
        floatAt(seatsEl[i], "Left hungry", true);
        audio.thud();
        leave(i, false);
      }
    });
    // grill
    grill.forEach((s, i) => {
      const el = slotsEl[i];
      if (!s) {
        if (el.dataset.state) {
          el.innerHTML = "";
          el.className = "slot";
          delete el.dataset.state;
        }
        return;
      }
      const was = s.t;
      s.t += dt;
      const state = s.t >= COOK_SECONDS + BURN_SECONDS ? "burnt" : s.t >= COOK_SECONDS ? "ready" : "cooking";
      if (el.dataset.state !== state) {
        el.dataset.state = state;
        el.className = `slot ${state}`;
        el.innerHTML = `<span>${food(s.ing.emoji, 36)}</span>${state === "cooking" ? `<svg viewBox="0 0 50 50"><circle class="ring" cx="25" cy="25" r="21" stroke-dasharray="132" stroke-dashoffset="132"/></svg>` : ""}`;
        if (state === "ready" && was < COOK_SECONDS) audio.step(10);
        if (state === "burnt") audio.thud();
      }
      if (state === "cooking") el.querySelector<SVGCircleElement>(".ring")?.setAttribute("stroke-dashoffset", String(132 * (1 - s.t / COOK_SECONDS)));
    });
    // clock
    const left = Math.max(0, ROUND_SECONDS - t);
    const sec = Math.ceil(left);
    if (sec !== lastTick) {
      lastTick = sec;
      timeEl.textContent = `⏱ ${sec}`;
      timeEl.classList.toggle("low", left <= 10);
      if (left <= 5 && sec > 0) audio.tick(true);
    }
    if (left <= 0) return void finish();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  async function finish() {
    running = false;
    audio.finish();
    toast("Closing time!");
    await sleep(1300);
    let after: View = v;
    try {
      after = await api<View>(`/api/k/${v.id}/score`, { pid, name: myName, score: coins, served, lost, combo: bestCombo });
    } catch {
      /* offline: still show results */
    }
    results(after, { coins, served, lost, bestCombo });
  }
}

// ---------- results ----------
function results(v: View, r: { coins: number; served: number; lost: number; bestCombo: number }) {
  const m = v.menu;
  const pos = v.board.findIndex((b) => b.me);
  const best = v.me?.best ?? r.coins;
  const place = v.board.length > 1 ? (pos === 0 ? " · took the lead" : ` · #${pos + 1} of ${v.board.length}`) : "";
  toChat({ type: "finished", ref: `k:${v.id}`, text: `played ${m.name} · ${money(r.coins)}${place}` });
  app.innerHTML = sceneHtml(m);
  app.querySelector(".room")!.insertAdjacentHTML(
    "beforeend",
    `<div class="overlay">
      <div style="font-weight:600;text-shadow:0 1px 8px rgba(0,0,0,.8)">Tonight's takings</div>
      <div class="big">${money(r.coins)}</div>
      <div class="stats"><div><b>${r.served}</b>served</div><div><b>${r.lost}</b>walked out</div><div><b>x${r.bestCombo}</b>best combo</div></div>
      ${r.coins < best ? `<p class="tag">Your best here: ${money(best)}</p>` : ""}
      ${v.board.length > 1 ? `<ol class="board">${v.board.slice(0, 5).map((b, k) => `<li class="${b.me ? "me" : ""}"><span>${k + 1}.</span><span class="who">${esc(b.me ? "You" : b.name)}</span><span>${money(b.score)}</span></li>`).join("")}</ol>` : ""}
      <div class="actions">
        <button class="btn" id="again">Play again</button>
        ${EMBED ? `<button class="btn ghost" id="back">Back to chat</button>` : ""}
      </div>
    </div>`,
  );
  wireCommon();
  document.getElementById("again")!.addEventListener("click", () => void play(v));
  document.getElementById("back")?.addEventListener("click", () => toChat({ type: "close" }));
}

// ---------- boot ----------
(async () => {
  try {
    const v = await api<View>(`/api/k/${roomId}?me=${pid}`);
    theme(v.menu);
    currentMenu = v.menu;
    lobby(v);
  } catch {
    app.innerHTML = `<div style="color:#fff;padding:40px 20px;text-align:center;font-family:var(--font)">This restaurant has closed. Start a new one from the chat.</div>`;
  }
})();
