# Sidequest: chat games for Messenger

Two group-chat games you start from a Messenger thread. Each one is themed by an AI to whatever topic you
pick, and everyone in the chat plays the same game and competes on one leaderboard (async, GamePigeon style).

- **Deep Cuts.** Seven "name a ___" prompts about your topic. Any correct answer counts, rarer answers score
  more, and an answer nobody else in the chat gave earns a bonus. You travel through a pixel world as you score.
- **Order Up!** Run a restaurant themed to your topic for 75 seconds. Build dishes from the pantry (some
  go on the grill first), serve customers before they lose patience, and earn tips and combos.

## Run it

```bash
nvm use                  # Node 22 (see .nvmrc)
npm run dev              # the Messenger app on :3000
npm run sidequest        # the game server on :5180 (second terminal)
```

Open a thread (e.g. `localhost:3000/messages/c_maya_jordan`), tap **+**, pick a game and a topic. Add
`?as=jordan` in another window to play as a second person. Optional direct links from the terminal:
`npm run sidequest -- "rock climbing"` (Deep Cuts) or `npm run sidequest -- --cook "ramen"` (Order Up!).

## Where things are

| | Deep Cuts | Order Up! |
|---|---|---|
| Game page | `client/rarity.html`, `client/src/rarity/` (`scene.ts` = pixel world) | `client/kitchen.html`, `client/src/kitchen/` (`pixel.ts` = art) |
| AI generation | `server/rarity/generate.ts` (world, prompts, answer keys, answer judge) | `server/kitchen.ts` (menu) |
| Rooms + scores | `server/rarity/rooms.ts` | `server/kitchen.ts` |
| Shared rules | `shared/rarity.ts` | `shared/kitchen.ts` (rules, customer schedule, preset menus) |

Shared: `server/serve.ts` (routes), `server/llm.ts` (Meta Model API call + budget ledger), `server/env.ts`,
`shared/text.ts` (text cleanup, readable colors), `client/src/engine/audio.ts` (sound effects).
In the Messenger app: `src/components/ChatGames.tsx` (cards, tray, player) and the thread page.

The model call reads `MODEL_API_KEY`, `MODEL_API_BASE_URL` and `MODEL_TEXT` from the repo's `.env.local`;
every call is booked in `.ai-ledger.json` against `MODEL_BUDGET_USD`. Generated topics are cached in
`sidequest/.cache/` (packs, menus, rooms), so a topic is only generated once.
