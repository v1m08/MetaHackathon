// Writes CREDITS.md from src/data/media.json (photo sources and licences). node scripts/credits.mjs
import { readFileSync, writeFileSync } from "node:fs";
const media = JSON.parse(readFileSync("src/data/media.json", "utf8"));
const rows = Object.values(media)
  .sort((a, b) => a.city.localeCompare(b.city) || a.id.localeCompare(b.id))
  .map((m) => `| ${m.city} | \`${m.id}\` | [${m.title.replace(/\|/g, "\\|")}](${m.pageUrl}) | ${m.author.replace(/\|/g, "\\|")} | ${m.license} |`);
const out = `# CREDITS

## City photos

All photos that appear in posts and Reels from other cities come from Wikimedia Commons under open licences, picked by \`scripts/media-pick.mjs\` and served through the app's caching image proxy. Each caption in the seed was written after Muse's image understanding described the photo (\`src/data/mediaIndex.json\`), so captions describe what is actually visible. Attribution per photo:

| City | Seed id | File (Commons) | Author | Licence |
|---|---|---|---|---|
${rows.join("\n")}

Licence texts: CC BY / CC BY-SA (creativecommons.org/licenses), CC0 (creativecommons.org/publicdomain/zero/1.0), Public domain as marked on Commons.

## Everything else

- Avatars: pravatar.cc placeholder portraits. Other placeholder photos (covers, home-city posts, listings): picsum.photos. Both served through \`/api/img\`.
- Icons: [Lucide](https://lucide.dev) (ISC). The "facebook" wordmark is plain text; no Meta brand assets are used.
- Model: Meta Muse via the Meta Model API (muse-spark-1.3 for the agent, muse-ember-1.0 for image understanding).
- People, posts, events and messages are fictional.
`;
writeFileSync("CREDITS.md", out);
console.log(`CREDITS.md: ${rows.length} photos credited`);
