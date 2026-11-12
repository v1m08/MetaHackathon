// Picks openly licensed photos from Wikimedia Commons for each seeded scene, downloads them into the
// app's image cache (through /api/img so the app can serve them offline) and writes src/data/media.json
// with source, author and licence for CREDITS.md. Deterministic: re-running keeps existing picks.
//   node scripts/media-pick.mjs            (server must be running on :3000 for the cache warm)
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const OUT = new URL("../src/data/media.json", import.meta.url);
const UA = { "user-agent": "fb-hackathon-seed-builder/0.1 (hackathon demo; contact via repo)" };
const FREE = /^(CC0|CC BY( |-)?(SA )?\d(\.\d)?|CC BY-SA \d(\.\d)?|Public domain|PDM|GFDL)/i;

// id, city, search query. Captions are written AFTER the vision model has described the chosen photo.
export const SCENES = [
  // Nashville
  ["nash-broadway", "nashville", "Broadway Nashville lights"],
  ["nash-hotchicken", "nashville", "Nashville hot chicken"],
  ["nash-bluebird", "nashville", "Bluebird Cafe Nashville"],
  ["nash-pedestrian-bridge", "nashville", "John Seigenthaler Pedestrian Bridge Nashville"],
  ["nash-ryman", "nashville", "Ryman Auditorium interior"],
  ["nash-parthenon", "nashville", "Parthenon Centennial Park Nashville"],
  ["nash-east", "nashville", "East Nashville"],
  ["nash-skyline", "nashville", "Nashville skyline Cumberland River"],
  // Atlanta
  ["atl-beltline", "atlanta", "Atlanta BeltLine Eastside Trail"],
  ["atl-ponce", "atlanta", "Ponce City Market Atlanta"],
  ["atl-piedmont", "atlanta", "Piedmont Park skyline Atlanta"],
  ["atl-krog", "atlanta", "Krog Street Tunnel graffiti"],
  ["atl-waffle", "atlanta", "Waffle House restaurant"],
  ["atl-botanical", "atlanta", "Atlanta Botanical Garden"],
  // Denver
  ["den-redrocks", "denver", "Red Rocks Amphitheatre"],
  ["den-union", "denver", "Denver Union Station"],
  ["den-rino", "denver", "River North Art District Denver mural"],
  ["den-flatirons", "denver", "Flatirons Boulder Colorado hike"],
  ["den-brewery", "denver", "beer flight tasting glasses"],
  ["den-snow-trail", "denver", "Rocky Mountain National Park trail"],
  // Chicago
  ["chi-bean", "chicago", "Chicago from under the Cloud Gate"],
  ["chi-riverwalk", "chicago", "Chicago Riverwalk"],
  ["chi-deepdish", "chicago", "Chicago deep dish pizza"],
  ["chi-lakefront", "chicago", "Chicago lakefront trail skyline"],
  ["chi-l-train", "chicago", "Chicago L train Loop elevated"],
  ["chi-secondcity", "chicago", "Second City comedy Chicago"],
  // New Orleans
  ["nola-beignets", "new-orleans", "Beignets Cafe Du Monde"],
  ["nola-frenchmen", "new-orleans", "Frenchmen Street New Orleans"],
  ["nola-streetcar", "new-orleans", "St. Charles streetcar New Orleans"],
  ["nola-balcony", "new-orleans", "French Quarter balcony New Orleans"],
  ["nola-brass", "new-orleans", "second line New Orleans brass band"],
  ["nola-crawfish", "new-orleans", "crawfish boil"],
  // Los Angeles
  ["la-griffith", "los-angeles", "Griffith Observatory Los Angeles"],
  ["la-venice", "los-angeles", "Venice Beach skate park"],
  ["la-ktown", "los-angeles", "Korean barbecue grill table"],
  ["la-tacos", "los-angeles", "taco truck Los Angeles al pastor"],
  ["la-runyon", "los-angeles", "Runyon Canyon view"],
  // New York
  ["nyc-brooklyn-bridge", "new-york", "Brooklyn Bridge walkway"],
  ["nyc-pizza", "new-york", "New York pizza slice"],
  ["nyc-highline", "new-york", "High Line park New York"],
  ["nyc-subway", "new-york", "New York subway platform"],
  ["nyc-dumbo", "new-york", "DUMBO Manhattan Bridge view"],
  // Texas + nearby
  ["dal-deepellum", "dallas", "Deep Ellum murals Dallas"],
  ["dal-klyde", "dallas", "Klyde Warren Park Dallas"],
  ["dal-state-fair", "dallas", "State Fair of Texas Big Tex"],
  ["hou-space", "houston", "Space Center Houston Saturn V"],
  ["hou-viet", "houston", "banh mi Houston"],
  ["hou-rodeo", "houston", "Houston Livestock Show and Rodeo"],
  ["sa-riverwalk", "san-antonio", "San Antonio River Walk night"],
  ["sa-pearl", "san-antonio", "Pearl Brewery San Antonio"],
  ["sa-missions", "san-antonio", "Mission San Jose San Antonio"],
  ["marfa-prada", "marfa", "Prada Marfa Valentine Texas"],
  ["marfa-sky", "marfa", "Milky Way night sky Texas desert"],
  ["marfa-chinati", "marfa", "Chinati Foundation Marfa"],
  // Austin (home) — a few for the demo user's own taste signals
  ["atx-barton", "austin", "Barton Springs Pool"],
  ["atx-greenbelt", "austin", "Barton Creek Greenbelt trail"],
  ["atx-tacos", "austin", "breakfast tacos Austin"],
];

async function search(q) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.search = new URLSearchParams({ action: "query", format: "json", generator: "search", gsrsearch: q, gsrnamespace: "6", gsrlimit: "12", prop: "imageinfo", iiprop: "url|extmetadata|size|mime", iiurlwidth: "1024", iiextmetadatafilter: "LicenseShortName|Artist|ImageDescription" }).toString();
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(25000) });
      const j = await r.json();
      return Object.values(j.query?.pages ?? {}).sort((a, b) => a.index - b.index);
    } catch (e) {
      console.log("  retry", attempt + 1, "for", q, "—", e.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  return [];
}
const strip = (s = "") => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

function pick(pages) {
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || ii.mime !== "image/jpeg") continue;
    const ratio = ii.width / ii.height;
    if (ii.width < 1000 || ratio < 0.6 || ratio > 2.1) continue;
    const lic = strip(ii.extmetadata?.LicenseShortName?.value);
    if (!FREE.test(lic)) continue;
    return { title: p.title.replace(/^File:/, ""), pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`, url: ii.thumburl.split("?")[0], width: ii.thumbwidth, height: ii.thumbheight, author: strip(ii.extmetadata?.Artist?.value) || "unknown", license: lic, description: strip(ii.extmetadata?.ImageDescription?.value).slice(0, 200) };
  }
  return null;
}

const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const out = { ...existing };
let picked = 0;
for (const [id, city, q] of SCENES) {
  if (out[id]) continue;
  const res = pick(await search(q));
  if (!res) {
    console.log("✗", id, "no suitable result for", q);
    continue;
  }
  out[id] = { id, city, query: q, ...res };
  picked++;
  console.log("✓", id, "←", res.title, "|", res.license, "|", res.author);
}
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`\n${Object.keys(out).length}/${SCENES.length} scenes have photos (${picked} new). Warming the app cache…`);
let ok = 0;
for (const m of Object.values(out)) {
  try {
    const r = await fetch(`http://localhost:3000/api/img?u=${encodeURIComponent(m.url)}`, { signal: AbortSignal.timeout(30000) });
    if (r.ok) ok++;
    else console.log("cache miss", m.id, r.status);
  } catch (e) {
    console.log("cache error", m.id, e.message);
  }
}
console.log(`cached ${ok}/${Object.keys(out).length}`);
