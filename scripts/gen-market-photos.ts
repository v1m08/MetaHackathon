// One-off: generates the Marketplace food listing photos with the Muse image model and saves them in
// public/seed/market/ so the demo never depends on a placeholder-photo host. Skips names that already have a file.
// It writes PNGs; the listings use 800px JPEGs (convert, then delete the PNG).
//   npx tsx scripts/gen-market-photos.ts
import "../src/server/net";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateImage } from "../sidequest/server/llm";

const STYLE = "Casual phone photo for a local marketplace listing, natural window light, on a home kitchen counter, slightly imperfect framing, appetizing, realistic, no text, no logos, no people, no hands.";
const SHOTS: Record<string, string> = {
  tamales: "A dozen homemade tamales in corn husks stacked in a foil tray, two unwrapped showing red chile pork filling, a small container of salsa verde beside it.",
  mochi: "A white bakery box with twelve homemade mochi in four colors: green matcha, purple ube, grey black sesame, pink strawberry, dusted with starch.",
  puffpuff: "A foil party tray piled with golden round Nigerian puff-puff fried dough balls, a small glass jar of reddish-brown suya spice next to it.",
  manoushe: "A flatbread kit on a counter: eight dough balls on a floured tray, a jar of green za'atar herb mix with olive oil, a tub of white labneh, one baked za'atar flatbread.",
  dosa: "A large jar of white fermented dosa batter, a container of orange sambar, a small tub of white coconut chutney, and one crisp golden dosa folded on a steel plate.",
  kimchi: "A large glass jar of red napa cabbage kimchi with a handwritten-style blank label, next to a smaller jar of dark red gochujang marinade.",
  hotsauce: "Five small 2 oz hot sauce bottles in a row with different colored sauces from yellow-orange to deep red and one green, on a wooden bar top.",
  croissants: "A kraft bakery box with six fresh golden croissants, three plain and three pain au chocolat, flaky layers visible.",
  griddle: "A used 22 inch black tabletop propane flat-top griddle on a patio table, seasoned dark steel surface, two metal spatulas resting on it.",
};

(async () => {
  for (const [name, shot] of Object.entries(SHOTS)) {
    const file = join(process.cwd(), "public", "seed", "market", `${name}.png`);
    if (existsSync(file) || existsSync(file.replace(/\.png$/, ".jpg"))) {
      console.log(`• ${name} exists, skipping`);
      continue;
    }
    try {
      const png = await generateImage(`${shot} ${STYLE}`, { size: "1024x1024", task: "market.photo" });
      writeFileSync(file, png);
      console.log(`✓ ${name} (${Math.round(png.length / 1024)} KB)`);
    } catch (e) {
      console.error(`✗ ${name}: ${(e as Error).message}`);
    }
  }
})();
