// "Order Up!": a restaurant rush. A menu (restaurant, ingredients, dishes, customers) is generated per topic;
// the game rules are fixed and shared by client and server.

export const ROUND_SECONDS = 75;
export const SEATS = 3;
export const COOK_SECONDS = 2.6; // time on the grill until ready
export const BURN_SECONDS = 4.5; // ready → burnt after this long
export const MAX_PLATE = 5;

export interface Ingredient {
  id: string;
  emoji: string;
  name: string;
  /** Must go on the grill before it can be plated. */
  cook?: boolean;
}
export interface Dish {
  name: string;
  items: string[]; // ingredient ids, 2-4
  price: number;
}
export interface Menu {
  interest: string;
  name: string; // restaurant name
  tagline: string;
  chef: { name: string; emoji: string; line: string };
  theme: { wall: string; wall2: string; counter: string; primary: string; accent: string };
  ingredients: Ingredient[];
  dishes: Dish[];
  customers: string[]; // emoji faces
}

// ---------- validation (LLM output and stored data) ----------
const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : d);
const str = (v: unknown, max: number, d = "") => (typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ").slice(0, max) : d);
const emoji = (v: unknown, d: string) => (typeof v === "string" && v.trim() && [...v.trim()].length <= 4 && !/[a-z0-9]/i.test(v) ? v.trim() : d);

export function sanitizeMenu(raw: unknown, interest: string): Menu | null {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const ingIn = Array.isArray(o.ingredients) ? o.ingredients : [];
  const ingredients: Ingredient[] = [];
  const seen = new Set<string>();
  for (const x of ingIn) {
    const r = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const id = str(r.id, 20).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const e = emoji(r.emoji, "");
    if (!id || !e || seen.has(id)) continue;
    seen.add(id);
    ingredients.push({ id, emoji: e, name: str(r.name, 16, id), cook: r.cook === true });
    if (ingredients.length === 8) break;
  }
  // at most two grill items keeps it fun, not frantic
  let cooks = 0;
  for (const i of ingredients) if (i.cook && ++cooks > 2) i.cook = false;
  if (ingredients.length < 4) return null;
  const ids = new Set(ingredients.map((i) => i.id));
  const dishes: Dish[] = [];
  for (const x of Array.isArray(o.dishes) ? o.dishes : []) {
    const r = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    const items = (Array.isArray(r.items) ? r.items : []).map((v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, "-")).filter((v) => ids.has(v)).slice(0, 4);
    if (items.length < 2) continue;
    const name = str(r.name, 24);
    if (!name || dishes.some((d) => d.name === name)) continue;
    const price = Math.round(Math.min(40, Math.max(4, Number(r.price) || items.length * 4)));
    dishes.push({ name, items, price });
    if (dishes.length === 6) break;
  }
  if (dishes.length < 3) return null;
  const t = (o.theme && typeof o.theme === "object" ? o.theme : {}) as Record<string, unknown>;
  const chef = (o.chef && typeof o.chef === "object" ? o.chef : {}) as Record<string, unknown>;
  const customers = (Array.isArray(o.customers) ? o.customers : []).map((c) => emoji(c, "")).filter(Boolean).slice(0, 8);
  return {
    interest,
    name: str(o.name, 26, `${interest} Kitchen`),
    tagline: str(o.tagline, 60, "Orders are piling up."),
    chef: { name: str(chef.name, 18, "Chef"), emoji: emoji(chef.emoji, "🧑‍🍳"), line: str(chef.line, 90, "Hands on deck, the dinner rush is here!") },
    theme: {
      wall: hex(t.wall, "#ffe4c4"),
      wall2: hex(t.wall2, "#ffc89a"),
      counter: hex(t.counter, "#8a5a3a"),
      primary: hex(t.primary, "#e8492f"),
      accent: hex(t.accent, "#2fa36b"),
    },
    ingredients,
    dishes,
    customers: customers.length >= 3 ? customers : ["🧑", "👩", "👨‍🦰", "👵", "🧔", "👧"],
  };
}

// ---------- the fixed customer schedule (same for everyone in a room) ----------
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Arrival {
  at: number; // seconds into the round
  dish: number; // index into menu.dishes
  face: string;
  patience: number; // seconds
}
export function schedule(menu: Menu, seed: number): Arrival[] {
  const r = rng(seed);
  // easier dishes (fewer items) first
  const order = menu.dishes.map((d, i) => ({ i, n: d.items.length })).sort((a, b) => a.n - b.n);
  const out: Arrival[] = [];
  let t = 0.8;
  while (t < ROUND_SECONDS - 6) {
    const f = t / ROUND_SECONDS;
    const pool = order.slice(0, Math.max(2, Math.ceil(order.length * (0.45 + f * 0.7))));
    const dish = pool[Math.floor(r() * pool.length)].i;
    const items = menu.dishes[dish].items.length;
    out.push({ at: t, dish, face: menu.customers[Math.floor(r() * menu.customers.length)], patience: 18 + items * 3 - f * 6 });
    t += Math.max(3.2, 7.5 - f * 5) * (0.8 + r() * 0.4);
  }
  return out;
}

/** Same multiset of ingredients (order on the plate doesn't matter). */
export function plateMatches(plate: string[], dish: Dish) {
  if (plate.length !== dish.items.length) return false;
  const a = [...plate].sort().join(","), b = [...dish.items].sort().join(",");
  return a === b;
}

// ---------- hand-made menus: instant, and the quality bar for generated ones ----------
export const PRESET_MENUS: Menu[] = [
  {
    interest: "burgers",
    name: "Bun Voyage",
    tagline: "Stack 'em high, serve 'em hot.",
    chef: { name: "Patty", emoji: "👩‍🍳", line: "Grill's hot, buns are toasted. Don't let 'em wait!" },
    theme: { wall: "#ffe7c2", wall2: "#ffc98f", counter: "#7a4a2a", primary: "#e8492f", accent: "#2fa36b" },
    ingredients: [
      { id: "bun", emoji: "🍞", name: "Bun" },
      { id: "patty", emoji: "🥩", name: "Patty", cook: true },
      { id: "cheese", emoji: "🧀", name: "Cheese" },
      { id: "lettuce", emoji: "🥬", name: "Lettuce" },
      { id: "tomato", emoji: "🍅", name: "Tomato" },
      { id: "fries", emoji: "🍟", name: "Fries" },
      { id: "egg", emoji: "🍳", name: "Egg", cook: true },
      { id: "onion", emoji: "🧅", name: "Onion" },
    ],
    dishes: [
      { name: "Plain Jane", items: ["bun", "patty"], price: 8 },
      { name: "Cheeseburger", items: ["bun", "patty", "cheese"], price: 12 },
      { name: "Garden Stack", items: ["bun", "lettuce", "tomato"], price: 10 },
      { name: "Sunrise Burger", items: ["bun", "patty", "egg"], price: 14 },
      { name: "The Works", items: ["bun", "patty", "cheese", "onion"], price: 18 },
      { name: "Fry Basket", items: ["fries", "cheese"], price: 7 },
    ],
    customers: ["🧑", "👩", "👨‍🦰", "👵", "🧔", "👧", "🧑‍🎤", "👮"],
  },
  {
    interest: "ramen",
    name: "Night Owl Noodles",
    tagline: "Slurp-worthy bowls till 2am.",
    chef: { name: "Taro", emoji: "🧑‍🍳", line: "Broth's been going since noon. Bowls up, let's move!" },
    theme: { wall: "#2b2140", wall2: "#4a2f5e", counter: "#a0522d", primary: "#ff5a4e", accent: "#ffcf4a" },
    ingredients: [
      { id: "noodles", emoji: "🍜", name: "Noodles", cook: true },
      { id: "egg", emoji: "🥚", name: "Egg" },
      { id: "pork", emoji: "🥓", name: "Chashu" },
      { id: "nori", emoji: "🟩", name: "Nori" },
      { id: "scallion", emoji: "🌿", name: "Scallion" },
      { id: "corn", emoji: "🌽", name: "Corn" },
      { id: "gyoza", emoji: "🥟", name: "Gyoza", cook: true },
      { id: "chili", emoji: "🌶️", name: "Chili" },
    ],
    dishes: [
      { name: "Shoyu Classic", items: ["noodles", "egg", "scallion"], price: 13 },
      { name: "Tonkotsu", items: ["noodles", "pork", "egg"], price: 15 },
      { name: "Miso Corn", items: ["noodles", "corn", "nori"], price: 12 },
      { name: "Fire Bowl", items: ["noodles", "chili", "pork", "scallion"], price: 18 },
      { name: "Gyoza Plate", items: ["gyoza", "scallion"], price: 8 },
      { name: "Late Night Combo", items: ["noodles", "gyoza", "egg"], price: 17 },
    ],
    customers: ["🧑", "👩‍💻", "🧑‍🎓", "👨‍🦱", "👩‍🦰", "🧛", "🥷", "🧑‍🚀"],
  },
  {
    interest: "tacos",
    name: "Taco 'Bout It",
    tagline: "Fresh tortillas, zero patience.",
    chef: { name: "Rosa", emoji: "👩‍🍳", line: "Tortillas on the comal. Line's out the door, vamos!" },
    theme: { wall: "#fff1d6", wall2: "#ffd38a", counter: "#3f8f6b", primary: "#e64a2e", accent: "#1f8fd6" },
    ingredients: [
      { id: "tortilla", emoji: "🫓", name: "Tortilla", cook: true },
      { id: "meat", emoji: "🍖", name: "Carne", cook: true },
      { id: "cheese", emoji: "🧀", name: "Queso" },
      { id: "avocado", emoji: "🥑", name: "Avocado" },
      { id: "salsa", emoji: "🍅", name: "Salsa" },
      { id: "lime", emoji: "🍋", name: "Lime" },
      { id: "onion", emoji: "🧅", name: "Onion" },
      { id: "beans", emoji: "🫘", name: "Beans" },
    ],
    dishes: [
      { name: "Street Taco", items: ["tortilla", "meat", "onion"], price: 10 },
      { name: "Quesadilla", items: ["tortilla", "cheese"], price: 8 },
      { name: "Guac & Chips", items: ["avocado", "lime", "salsa"], price: 9 },
      { name: "Loaded Taco", items: ["tortilla", "meat", "cheese", "salsa"], price: 16 },
      { name: "Bean Burrito", items: ["tortilla", "beans", "cheese"], price: 11 },
      { name: "Verde Special", items: ["tortilla", "avocado", "lime", "onion"], price: 14 },
    ],
    customers: ["🧑", "👩", "🤠", "👨‍🦳", "👩‍🎤", "🧔", "👧", "💃"],
  },
];
