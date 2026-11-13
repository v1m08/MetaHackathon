# Demo runbook

Branch `demo-stage`. Five people in one group chat play today's game, unlock a real Event, then play a Sketch Off together. Everything below was run on this branch; the timings are from live Muse runs on Nov 13.

## Start it (two terminals)

```bash
npm install
npm run build && npm run start      # the app, http://localhost:3000 (also reachable from phones on the same Wi-Fi)
npm run sidequest                   # the game server, :5180  (second terminal)
```

Live Muse needs `MODEL_API_KEY` in `.env.local`. To run with no model at all: `AI_MODE=mock npm run start` and `AI_MODE=mock npm run sidequest`.

If port 3000 is taken, start with `npx next start -p 3100` and prefix the prep command with `DEMO_BASE=http://localhost:3100`.

## Stage it (one command, also between runs)

```bash
npm run demo:prep -- --sketch Austin
```

It resets the seed, has Muse write today's game for the group chat (about 15 s), plays it once as Nina (off stage), makes sure the "Austin" Sketch Off opens instantly, and prints one link per player.

| Flag | What it does |
|---|---|
| `--preplay 0` | Nobody plays ahead. All five on stage are needed to unlock the Event. |
| `--preplay 1` (default) | Nina plays ahead. The Event unlocks on the fourth person on stage, so one flaky phone does not sink it. |
| `--dm` | Also stages the Maya and Jordan DM: Jordan has played, it is Maya's turn. |
| `--sketch <topic>` | Makes a Sketch Off topic ready (about 15 s for a new one). Repeatable. |
| `--no-reset` | Prints the current state and links without touching anything. |

## The five players

Group chat: **Zilker Sunday 🏐** (`c_volleyball`, eight members). On stage: **jordan, sam, devon, tyler, grace**. Off stage: nina, ethan, marcus.

Each person opens their own link, printed by the prep script:

```
http://<laptop-ip>:3000/messages/c_volleyball?as=jordan     (sam, devon, tyler, grace likewise)
```

Phones must be on the same Wi-Fi as the laptop. If the venue Wi-Fi isolates devices, tether the laptop to a phone hotspot. On one laptop, five browser windows with the five links work the same way.

## The journey

| # | Who | Do | What the room sees |
|---|---|---|---|
| 1 | all | Open the link. (Or open `/notifications?as=<name>` and tap "Today's game is ready in Zilker Sunday 🏐".) | The chat, with **Today's game** already in it, tagged **Live**. Nobody started it; everyone was notified. Score bar: 58, 🔥 4 days, "Event unlocks at 60". |
| 2 | all | Tap **Play**, spread 10 points over the three real things, tap **Lock in & see results**. | The card counts up: 2, 3, 4 of 8 played. |
| 3 | fourth to finish | (nothing extra) | Score 61, 🔥 5 days, and an **Event card unlocks** in everyone's chat with its reason ("32 of 50 points went to this in today's Wager, ..."). |
| 4 | all | Tap **I'm in**. | Faces appear on the card. Open the event: they are going. |
| 5 | presenter | Tap **+**, pick **Sketch Off**, tap **Austin ⚡**. | A Sketch Off card lands in the chat. |
| 6 | all | Tap **Draw**, then **Draw your word**. Draw for 30 s, tap **I'm done**, then guess the others. | Each drawing gets an AI guess in about 2 s ("the AI said triangle"), a leaderboard, and a "played ..." line per person in the chat. |
| 7 | presenter | Open `/dev/play`, then `/dev/context`, then `/dev/ai`. | Why code chose the topic and format, what it refused from Muse's draft, the score parts; the Sketch Off session ingested with who played; every prompt and its cost. |

On the Wager, any spread works. If the room puts points on the group ("Cheap Eats ATX") only, a different event unlocks; it is still an Event.

**Optional, one person (needs `--dm`):** open `/?as=maya`. Messenger home shows the Hangout card ("Jordan already played today. Your turn!"). Open the chat with Jordan, play, and the streak goes 2 to 3, the score 64 to 68, and an Event unlocks. Put 0 points on the group there, or the Group card unlocks instead. Jordan's critter is celebrating back in the Hangout.

## Measured (live, this laptop)

| Call | Time | Cost |
|---|---|---|
| Today's game, one chat (`muse-spark-1.3`) | 13 to 19 s | about $0.014 |
| Unlock card line (`muse-ember-1.0`) | about 2 s | under $0.001 |
| Sketch Off, new topic | 16 s | |
| Sketch Off, AI guess on a drawing (vision) | about 2 s | |
| Ghost Run, new topic | 19 s | |
| Order Up!, new topic | 23 s | |
| Deep Cuts, new topic with its generated backdrop | 94 s | about $0.28 |

So: stage today's game before you walk on, and tap ⚡ topics on stage. Ready on this laptop now: Sketch Off (animals, space, movies, Austin), Ghost Run (rock climbing, f1, skiing, pickleball), Order Up! (burgers, ramen, tacos, boba), Deep Cuts (indie bands, Austin landmarks). The first four of each list ship with the repo; the rest live in `sidequest/.cache` on this machine.

## If something goes wrong

| Symptom | Do this |
|---|---|
| Muse is slow or down | Restart both servers with `AI_MODE=mock`, rerun the prep. Same journey, template wording, cards tagged Mock. On an API error or a full budget the app falls back to mock by itself. |
| No game card in the chat | Rerun `npm run demo:prep`. It drops on the first open of the day; the prep does that for you. |
| A phone cannot reach the app | Same Wi-Fi? Try the hotspot. `npm run start` listens on all interfaces. |
| "Game server isn't running" in the tray | Start `npm run sidequest`. Phones reach it on port 5180 of the same address. |
| Event photos are grey blocks | The placeholder photo host is unreachable. Run `npm run warm` once on a network where it loads; the prep script says how many load. |
| Budget guard refuses | Raise `MODEL_BUDGET_USD` in `.env.local` and restart. |
| Someone played the wrong thing | Rerun the prep. It takes about 20 s live. |

## What is not real

- The drop is triggered by the first open of the chat that day (the prep script does it), not by a scheduler.
- The drop notification is in-app (the Notifications tab and its badge). Nothing reaches a locked phone.
- Sketch Off and the other Sidequest games are started by a person from the tray.
- There are two scores: the chat score in the thread (daily game) and the connection score in `/dev/context` (Sidequest play). They use the same weights and thresholds and are not merged.
- The people, chats, events and photos are seeded.
