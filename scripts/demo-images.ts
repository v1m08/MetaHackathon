// Generates the photos for the SF demo cast (posts, profile covers, event covers) with the Meta image model and
// saves them as compressed JPEGs in public/demo/. Run once; existing images are skipped.
//   npx tsx scripts/demo-images.ts
import "../sidequest/server/env";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateImage } from "../sidequest/server/llm";

const OUT = join(__dirname, "..", "public", "demo");
const STYLE = "Candid smartphone photo, natural colors, realistic, no text, no watermark.";

export const DEMO_IMAGES: Record<string, string> = {
  "tam-sunrise": "Sunrise from the summit of Mount Tamalpais above a sea of fog, golden light, Bay Area hills poking through the clouds.",
  "lands-end": "The Lands End coastal trail in San Francisco with cypress trees and the Golden Gate Bridge in the distance, late afternoon.",
  "mission-peak": "Hiker's view from the top of Mission Peak in Fremont at golden hour, dry golden grass hills and the East Bay below.",
  "burrito": "A huge foil-wrapped Mission-style burrito cut in half on a red tray in a San Francisco taqueria.",
  "dolores": "Friends' picnic blanket at Dolores Park on a sunny day with the San Francisco skyline behind, dogs and people in the background.",
  "fog-sutro": "Karl the Fog rolling over San Francisco hills toward Sutro Tower at dusk.",
  "off-the-grid": "Evening food truck market at Fort Mason in San Francisco with string lights and people in line.",
  "lake-merritt": "Lake Merritt in Oakland at sunset with the necklace of lights and people walking the path.",
  "bart": "Inside a BART train car in the Bay Area, morning commute, motion blur through the window.",
  "golden-gate": "The Golden Gate Bridge from Battery Spencer with fog under the deck, wide shot.",
  "event-lands-end": "Golden hour group hike at Lands End San Francisco, the Mile Rock labyrinth by the ocean, wide landscape.",
  "event-burrito-crawl": "Colorful Mission District street in San Francisco with murals and taquerias, sunny afternoon, wide landscape.",
};

async function main() {
  mkdirSync(OUT, { recursive: true });
  const todo = Object.entries(DEMO_IMAGES).filter(([k]) => !existsSync(join(OUT, `${k}.jpg`)));
  console.log(`${todo.length} to generate`);
  // a few at a time: each one takes 15-35s
  for (let i = 0; i < todo.length; i += 4) {
    await Promise.all(
      todo.slice(i, i + 4).map(async ([key, prompt]) => {
        try {
          const png = await generateImage(`${prompt} ${STYLE}`, { task: "demo.image" });
          const tmp = join(OUT, `${key}.png`);
          writeFileSync(tmp, png);
          // ~100-200KB JPEGs so phones load them fast over the tunnel
          execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "72", "-Z", "1000", tmp, "--out", join(OUT, `${key}.jpg`)], { stdio: "ignore" });
          unlinkSync(tmp);
          console.log(`✓ ${key}`);
        } catch (e) {
          console.log(`✗ ${key}: ${(e as Error).message}`);
        }
      }),
    );
  }
}
main();
