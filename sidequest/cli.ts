// Sidequest game server for the Messenger chat games (Deep Cuts and Order Up!).
//
//   npm run sidequest                          start the server (games are created from Messenger's "+" button)
//   npm run sidequest -- "rock climbing"       also print a Deep Cuts link for a topic
//   npm run sidequest -- --cook "ramen"        also print an Order Up! link for a restaurant
//   --port 5181                                use another port
import "./server/env";
import { env, liveEnabled } from "./server/env";
import { createKRoom, generateMenu } from "./server/kitchen";
import { spentUsd } from "./server/llm";
import { generatePack } from "./server/rarity/generate";
import { cachedPack, cachePack, createXRoom } from "./server/rarity/rooms";
import { isOurServer, lanAddress, startServer } from "./server/serve";

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const portIdx = args.indexOf("--port");
const port = portIdx >= 0 ? Number(args[portIdx + 1]) : Number(process.env.SIDEQUEST_PORT) || 5180;
const topics = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--port");
const c = { dim: "\x1b[2m", bold: "\x1b[1m", cyan: "\x1b[36m", green: "\x1b[32m", yellow: "\x1b[33m", reset: "\x1b[0m" };

function printLink(path: string) {
  console.log(`  ${c.green}http://localhost:${port}${path}${c.reset}`);
  const lan = lanAddress();
  if (lan) console.log(`  ${c.dim}phones on the same wifi:${c.reset} ${c.cyan}http://${lan}:${port}${path}${c.reset}`);
  console.log();
}

async function main() {
  console.log(`\n${c.bold}🎮 Sidequest${c.reset} ${c.dim}— Deep Cuts + Order Up! for Messenger${c.reset}`);
  console.log(`${c.dim}   model: ${liveEnabled() ? `${env.model} (spent $${spentUsd().toFixed(2)} of $${env.budgetUsd - env.reserveUsd})` : "no API key: only cached topics work"}${c.reset}`);
  if (await isOurServer(port)) console.log(`${c.dim}   already running on :${port}${c.reset}\n`);
  else {
    try {
      await startServer(port);
      console.log(`${c.dim}   serving on http://localhost:${port}${c.reset}\n`);
    } catch (err) {
      console.error(`   could not start on :${port}: ${(err as Error).message}. Try --port 5181.`);
      process.exit(1);
    }
  }

  for (const topic of topics) {
    const t0 = performance.now();
    try {
      if (flag("--cook")) {
        const room = createKRoom(await generateMenu(topic));
        console.log(`  🍳 ${c.bold}${room.menu.name}${c.reset} ${c.dim}(${((performance.now() - t0) / 1000).toFixed(0)}s)${c.reset}`);
        printLink(`/k/${room.id}`);
      } else {
        const pack = cachedPack(topic) ?? (await generatePack(topic, (s) => console.log(`  ${c.dim}${s}…${c.reset}`))).pack;
        cachePack(pack);
        const room = createXRoom(pack);
        console.log(`  ${pack.host.emoji} ${c.bold}${pack.title}${c.reset} ${c.dim}(${((performance.now() - t0) / 1000).toFixed(0)}s)${c.reset}`);
        printLink(`/x/${room.id}`);
      }
    } catch (e) {
      console.log(`  ${c.yellow}couldn't make ${JSON.stringify(topic)}: ${(e as Error).message}${c.reset}\n`);
    }
  }
  if (!topics.length) console.log(`  Open a Messenger chat and tap ${c.bold}+${c.reset} to start a game.\n`);
}

void main();
