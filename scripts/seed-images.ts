// npm run seed:images
// Writes labeled placeholder SVGs to public/seed (avatars + one per seeded photo/post). Teammates replace
// them with photos their friends agreed to share: same filename, or point imagePath at a .jpg in seed.ts.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FRIENDS, ME, PEOPLE, PHOTOS } from "@/data/hangout/seed";
import { SCENARIOS } from "@/data/hangout/scenarios";

const OUT = join(process.cwd(), "public", "seed");
const EMOJI: Record<string, string> = {
  "Ramen Ya": "🍜", "Mozart's Coffee": "☕", "Kerbey Lane Cafe": "🥞", "Pease Park": "🪿", "Spider House Cafe": "☕", "Zilker Park": "🥏",
  "Lincoln High": "🏈", "Bird Bakery": "🧁", "Jess's backyard": "🎉", "Alamo Drafthouse": "🎬", "Gregory Gym": "📊", "Barton Springs": "🏊",
  "Torchy's Tacos": "🌮", "Lady Bird Lake Trail": "🏃", Sweetgreen: "🥗",
};
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");
const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function photo(file: string, emoji: string, title: string, sub: string, caption?: string) {
  const h = hash(title) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},70%,82%)"/><stop offset="1" stop-color="hsl(${(h + 40) % 360},65%,66%)"/></linearGradient></defs>
  <rect width="600" height="450" fill="url(#g)"/>
  <circle cx="470" cy="90" r="120" fill="#fff" opacity=".18"/><circle cx="90" cy="400" r="140" fill="#fff" opacity=".12"/>
  <text x="300" y="215" font-size="130" text-anchor="middle">${emoji}</text>
  <text x="300" y="300" font-family="-apple-system, Segoe UI, Roboto, sans-serif" font-size="34" font-weight="700" fill="#1c1e21" text-anchor="middle">${esc(title)}</text>
  <text x="300" y="340" font-family="-apple-system, Segoe UI, Roboto, sans-serif" font-size="22" fill="#1c1e21" opacity=".7" text-anchor="middle">${esc(sub)}</text>
  ${caption ? `<text x="300" y="380" font-family="-apple-system, Segoe UI, Roboto, sans-serif" font-size="20" font-style="italic" fill="#1c1e21" opacity=".65" text-anchor="middle">“${esc(caption)}”</text>` : ""}
  <text x="584" y="436" font-family="-apple-system, sans-serif" font-size="13" fill="#1c1e21" opacity=".45" text-anchor="end">placeholder photo</text>
</svg>`;
  writeFileSync(join(OUT, "photos", file), svg);
}

function avatar(id: string, name: string) {
  const h = hash(id) % 360;
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  writeFileSync(
    join(OUT, "avatars", `${id}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><rect width="200" height="200" fill="hsl(${h},60%,62%)"/><circle cx="100" cy="82" r="38" fill="#fff" opacity=".28"/><path d="M38 186 C46 136 154 136 162 186 Z" fill="#fff" opacity=".28"/><text x="100" y="118" font-family="-apple-system, Segoe UI, Roboto, sans-serif" font-size="64" font-weight="700" fill="#fff" text-anchor="middle">${esc(initials)}</text></svg>`,
  );
}

mkdirSync(join(OUT, "photos"), { recursive: true });
mkdirSync(join(OUT, "avatars"), { recursive: true });
for (const p of [ME, ...FRIENDS, ...PEOPLE]) avatar(p.id, p.name);
for (const p of PHOTOS) photo(`${p.id}.svg`, EMOJI[p.place] ?? "📸", p.place, fmt(p.date), p.caption);
const TRIGGER_EMOJI: Record<string, string> = { reel_dev_goose: "🪿", post_jess_moved: "📦", post_chris_meme: "💼" };
for (const s of SCENARIOS) {
  const it = s.trigger.item;
  const file = it.imagePath?.split("/").pop();
  if (!file) continue;
  const place = "place" in it ? it.place : undefined;
  const text = "text" in it ? it.text : it.caption;
  photo(file, TRIGGER_EMOJI[it.id] ?? EMOJI[place ?? ""] ?? "📸", place ?? (s.trigger.kind === "reel" ? "Reel" : "New post"), "today", text.length > 44 ? `${text.slice(0, 42)}…` : text);
}
console.log(`Wrote placeholder images to ${OUT}`);
