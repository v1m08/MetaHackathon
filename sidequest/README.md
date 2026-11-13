# Sidequest

Type an interest in the terminal and get a link to a short minigame themed to it. Send the link to a
friend or a group chat: everyone plays the same game on the same course and competes on one leaderboard
(async, GamePigeon style).

```bash
npm run sidequest                          # interactive: asks "What are you into?" in a loop
npm run sidequest -- "F1 and cooking"      # one interest, then keeps serving and asking
npm run sidequest:test                     # fuzz + headless bot + fallback + link tests (no network)
```

The CLI starts a server on `:5180`, or reuses one that is already running. For each interest it prints:

- `http://localhost:5180/g/<room>`: open it on this machine.
- `http://<lan-ip>:5180/g/<room>`: open it on phones on the same wifi.

Flags: `--fresh` (skip the config cache), `--offline` (keyword fallback, no API call), `--open` (open
in a browser), `--port 5181`, `--no-serve`. Add `?bot=1` to any game URL to watch it play itself.

## How it works

- **Generation** ([server/generate.ts](server/generate.ts)): interest → cache → Muse Spark (JSON mode,
  one repair retry) → `sanitizeConfig` → offline keyword fallback. It never fails: every input ends in a
  playable game. Configs are cached in `sidequest/.cache/configs.json`, so the same interest gives the
  same game.
- **The LLM never writes code.** It picks one of 4 hand-built templates (`dodger`, `shot`, `catcher`,
  `trivia`) and fills in theme, emoji sprites, fan copy, modifiers and tuning. The system prompt is
  generated from [shared/registry.ts](shared/registry.ts).
- **`sanitizeConfig`** ([shared/schema.ts](shared/schema.ts)) repairs anything field by field: clamps
  tuning to 0–1, enforces palette contrast, single-emoji sprites, string limits, allowed modifiers, and
  a profanity filter.
- **Multiplayer = rooms** ([server/rooms.ts](server/rooms.ts)): each generated game is a room with a
  shared seed and a leaderboard (each player's best score, name stored per device). Rooms persist in
  `sidequest/.cache/rooms.json`. A `/#g=…` hash link (config in the URL, no server state) still works
  as an offline 1v1 "score to beat" challenge.
- **Engine** ([client/src/engine](client/src/engine)): Canvas 2D, fixed-timestep loop, unified
  pointer/keyboard input, screen shake, particles, hit stop, floating text, synthesized WebAudio sound
  effects, and emoji sprite cache.

## Env

These are read from the repo's `.env.local`: `MODEL_API_KEY` (or `META_API_KEY`), `MODEL_API_BASE_URL`,
`MODEL_TEXT`. Optional: `SIDEQUEST_MODEL` (e.g. `muse-ember-1.0` for faster, cheaper calls) and
`SIDEQUEST_TIMEOUT_MS` (default 25000). Every live call is booked in the shared `.ai-ledger.json` and
refused once `MODEL_BUDGET_USD - MODEL_BUDGET_RESERVE_USD` is spent.

## Known limits

- Spark takes about 9–15 s per new interest (cached interests are instant). This misses the spec's 5 s
  goal. Ember is faster but the copy is weaker; a streaming or two-stage call is the next step.
- Leaderboards trust the client's score (no anti-cheat), and rooms live on whichever machine runs the
  server. Friends outside your wifi need it deployed or tunneled.
- Not built yet: `rhythm` and `runner` templates, live custom mechanics.
