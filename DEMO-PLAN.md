# DEMO-PLAN

Demo: Fri Nov 13, 10:30am PST. 5 min (problem, one live journey, how Muse powers it, how we built it) + 3 min Q&A.

**Status, Fri 02:10 PST: built on branch `demo-stage`, up to date with `main` (`d79135b`). `main` itself is untouched.** How to run it is in [DEMO-RUNBOOK.md](DEMO-RUNBOOK.md).

## 1. What this branch is

`main` as of 01:01 (Sidequest with four games and the context engine), plus the daily AI Chat Games that main deleted, plus the Hangout streaks screen.

`main` on its own can only show a game somebody starts by hand. The automatic drop, the chat score in the thread, the streak and the "here is a real thing to do" card live in the daily Chat Games code that main removed (`eeb657c`). This branch brings that back next to Sidequest instead of in place of it.

## 2. What changed after the plan was approved

- **Pulled the new games.** Ghost Run, Sketch Off, the game picker with Auto, generated Deep Cuts backdrops (`875e903`).
- **Pulled the context engine's scoring** (`a90628a`): a 0-100 connection score, Austin-day streaks and multi-factor ranking over Sidequest sessions.
- **Merged main again at `d79135b` (PR #3).** apnahata's `e0eae97` supports all four Sidequest games in the context engine. It covers the same ground as glue first written here, so that glue was dropped: the context engine on this branch is main's, file for file.
- **The journey is a group of five**, not the Maya and Jordan pair. The pair still works and is the optional extra.
- **The second game is Sketch Off** (skribbl.io style: everyone draws a word, friends and the AI guess). Confirmed.
- **A game drop now sends a notification** (section 7).

## 3. What each branch contains

| Branch (tip) | By | What is in it | Verdict |
|---|---|---|---|
| `main` (d79135b) | all | Facebook clone base. Sidequest: Deep Cuts, Order Up!, Ghost Run, Sketch Off, started from the "+" tray, own server on :5180. Context engine (`src/lib/context`): reads play in all four games, suggests topics for a chat, keeps a connection score and streak per chat, ranks Events / Groups / Marketplace with "Send to". Daily Chat Games removed. | **Base** |
| `streaks-screen` (3daa6c8) | Keira | On daily Chat Games. Messenger as the home screen, "Your Hangout" card, `/streaks` room with a drawn critter per friend, 🔥/⏳ on chat rows, five seeded Maya DMs with play history. | **In** |
| daily Chat Games (`991c5eb`, removed by `eeb657c`; original on `games`) | Vedansh, apnahata | One Muse-written game per chat per day from that chat's own material, six formats, chat score, unlock cards with real RSVP / join / save, `/dev/play`. | **Back in** (`git revert eeb657c`) |
| `score-events` (da07e3c) | Keira | Streak rules v2 for the daily games: Austin-day rollover, weekly freeze, hourglass, milestones, friends-going on unlock cards. | **Cut** (see 6.4) |
| `sidequest-cli`, `sidequest-context`, `remove-daily-chat-games` | nivang, apnahata | Already in main. | Nothing to take |
| `games` (d130d99), `reconnect` (e24c0bf), `travel` (694d6c6) | Vedansh | Trips, Open Door, Reconnect, ~60 people in 12 cities, budget ledger, evals, and the persona swarm (`sim/`, `scripts/sim.mjs`, `PERSONAS.md`). | **Cut** (reference for 8.5) |
| `reconnect-prototype` (e2e85be) | Keira | Hang Again: own cast, Muse Image critters, sleep math, `/demo` controls. | **Cut** (its critter art rides in with `streaks-screen`) |
| stash `before-demo-stage` | you | Your Tag along (intros) work on the old Trips stack. | **Untouched** |

## 4. How the pieces fit

```
SEEDED WORLD  src/data: 16 people in Austin, 17 chats, posts, events, groups, listings
   |  buildContext(chat): only what every member can already see      src/lib/play/context.ts
   v
DAILY GAME (automatic)   code picks topic + format -> Muse writes it -> code checks every id and quote
   |  card lands in the thread, once per chat per day; members are notified   src/lib/play/{select,generate,daily}.ts
   v
CHAT SCORE + STREAK  0-100 in the thread's score bar                  src/lib/play/score.ts
   |-> Hangout critters (awake / sleepy / celebrating)                src/lib/streaks
   v
UNLOCK  one real Event / Group / Listing card with a code-checked reason
        "I'm in" is a real RSVP, and everyone is notified             src/lib/play/recommend.ts

SIDEQUEST (by hand, "+" tray)   Muse builds a themed game for any topic: trivia, restaurant, race, drawing   sidequest/
   |  game cards + "played" lines in the thread
   v
CONTEXT ENGINE  per-person taste, per-chat connection score + streak  src/lib/context
   |-> "Picked for this chat" topic chips in the tray
   |-> Events / Groups / Marketplace ranking + "Send to <chat>"
```

One link between the two halves exists already: a Sidequest "played" line within 30 minutes of finishing the daily game counts as a reply, which lifts the chat score. In the dry run the group went 61 to 63 after the Sketch Off.

## 5. The journey: five people, one group chat

Group chat **Zilker Sunday 🏐** (eight members). Five teammates each open a link as jordan, sam, devon, tyler, grace. The prep script has Muse write today's game beforehand and plays it once as Nina.

| Time | On screen | What it proves |
|---|---|---|
| 0:00 | The problem: "we should hang out" dies in the chat. Someone has to start the plan, and nobody does. | |
| 0:35 | All five open the chat. Today's game is already there, tagged Live, written from the chat's own jokes (one run tonight opened with "torchy's is banned, wilson is in the lake, where are we stuffing our faces?"). Score 58, "Event unlocks at 60". | Nobody started a game. Muse wrote it from this chat. |
| 0:50 | Everyone spreads 10 points over three real things. The card counts up. | Code picked the topic and the real items. |
| 1:20 | Fourth finish on stage: score 61, streak 5, an **Event card unlocks** with its reason. Everyone taps **I'm in**. | Play feeds scoring. The chat ends with something real to do. |
| 1:50 | Presenter: "+", Sketch Off, Austin ⚡. Everyone draws a secret word for 30 s; the AI guesses each drawing; friends guess each other's. | A second kind of game, Muse vision in the loop, five people playing at once. |
| 3:10 | `/dev/play`, `/dev/context`, `/dev/ai`. | Code decides, Muse writes, code checks. Every call and its cost. |
| 4:00 | How we built it, and what is next (section 8). | |

**Why this chat.** It is the only seeded group with play history, and it sits at 58: five of its eight finishing takes it past 60. Five teammates are exactly that majority; Nina playing ahead gives one phone of slack.

**Optional extra, one person.** Maya's Messenger home has the Hangout card ("Jordan already played today. Your turn!"). One play in the chat with Jordan takes the streak 2 to 3, the score 64 to 68, and unlocks an Event.

## 6. Where branches pulled in opposite directions

**6.1 Daily Chat Games: deleted on main, required by `streaks-screen` and `score-events`.** Brought back. They are the only automatic loop with an unlock. Both systems had lived in one thread at `88164a6`, the commit right before the removal.

**6.2 Two rankings for Events and Groups.** The daily games rank by personal affinity; main ranks by Sidequest play and adds "Send to". Kept main's. The daily loop pays off in the thread through the unlock card.

**6.3 Home screen: Facebook feed (main) or Messenger (`streaks-screen`).** Messenger. The feed is at `/feed`.

**6.4 `score-events` or `streaks-screen`.** They cannot both land with tests untouched: the weekly freeze changes three seeded streaks (Sofia 12 to 15, Ethan 5 to 8, Jordan 2 to 5), `streaks-screen`'s tests pin the old numbers and `score-events`' own tests need the new ones. Took `streaks-screen`. Having both means editing expectations in `tests/streaks.test.ts`, which is your call. Note that main's context engine now has the same streak rules for Sidequest sessions.

**6.5 Old line (Trips, Open Door, Reconnect, Hang Again) or clean main.** Clean main.

## 7. What I added (small, connects existing code)

1. **Conflict resolution**: 13 files for the restore, 1 for `streaks-screen`, 1 for PR #3 (main's version taken). Both game systems in one thread, both inspectors in the menu, reset clears both stores.
2. **Sidequest card lines are never daily-game evidence.** Without this a game could quote "played Taco 'Bout It · $214" as something Jordan said.
3. **A notification when a game drops.** Every member of the chat gets "Today's game is ready in Zilker Sunday 🏐: ...", except the one whose open made it drop. It has its own type (`"game"`) so the existing rule, one `"play"` notification per member when a chat unlocks something, still holds.
4. **`npm run demo:prep`** and **`DEMO-RUNBOOK.md`**.

Fixes found while testing, all in existing code:

5. **Unlock card line: 30 s to 2 s.** The call ran at 300 tokens on the reasoning model, which spent them all thinking, so the client retried four times while the finishing player waited. It now uses the fast model with room to answer. Code checks the line the same way.
6. **Thread header and score bar stay pinned.** In any chat longer than a screen they scrolled away at the newest message, so the score was off screen while you played.
7. **New cards scroll fully into view** instead of ending up half behind the composer.
8. **An unreachable photo host no longer stalls cards.** It is skipped for five minutes after a failure.

New tests: `tests/demo-glue.test.ts` (4: the evidence filter and the drop notification). No test written by anyone else was edited. Three tests of my own went out with the context-engine glue they covered.

## 8. Missing pieces (not built)

| # | Missing | Where it plugs in | Effort |
|---|---|---|---|
| 8.1 | **Scheduled drop.** A game is generated the first time a member opens the chat that day (the prep script does this). | `ensureDaily()` in `src/lib/play/daily.ts` needs a caller: a tick route or cron looping chats. One Muse call per chat per day, about 15 s each. | Small, ~45 min |
| 8.2 | **A real push.** The drop notification is in-app: the Notifications tab and its badge. Nothing reaches a locked phone, and Messenger's own header has no bell. | A bell in `src/components/messenger/MessengerShell.tsx` reading `/api/notifications`; a web push would need a service worker. | Small for the bell; medium for push |
| 8.3 | **Automatic Sidequest games.** The tray suggests topics for the chat and Auto picks the game, but a person taps. | `selectGame()` picks the topic, `chipForTopic()` in `src/lib/context/taxonomy.ts` maps it (same 16 topic ids), then a server call to Sidequest `/api/s/new` and an `sqgame` card. New topics take 15 to 95 s, so pre-generate. | Medium, 1-2 h |
| 8.4 | **One score.** Two 0-100 scores with the same weights and thresholds: the chat score (daily games, drives unlock cards) and the connection score (Sidequest, drives ranking). | `connectionScoreFor()` in `src/lib/context/index.ts` and `chatScore()` in `src/lib/play/score.ts`; feed Sidequest sessions into the latter or unlock cards from the former. Both test suites pin seeded numbers. | Medium, 2-3 h |
| 8.5 | **Swarm to games.** The 16 Muse-played personas only drive Trips endpoints on `travel` / `reconnect` / `games`. No persona plays a game or writes a chat line; games read the hand-written seed. | New `scripts/sim-play.mjs` modelled on `scripts/sim.mjs`, a "play" stage in `src/app/api/sim/persona/route.ts`, reuse `sim/personas.json` (14 of 16 ids exist here). | Medium to large, 2-4 h, about $1 of Muse |
| 8.6 | **The bigger world.** ~60 people in 12 cities exists only on the old line. | `buildSeed()` in `src/data/index.ts`; brings cities, labels, rides and licensed photos. | Large |
| 8.7 | **Streak rules v2 for daily games** (`score-events`). | Merge it, then update expectations in `tests/streaks.test.ts`. | Tiny, blocked on 6.4 |

## 9. Checked and not checked

**Checked on this branch, after the last merge:** 67 unit tests (50 play, 7 context, 6 streaks, 4 glue); typecheck; production build; `qa:play` 57/57 in mock.

- *Mock, over the API:* five members finish today's game, the Event unlocks, all five RSVP, five people draw and guess in a Sketch Off, and the context engine picks the session up.
- *Live Muse:* today's game written for the group chat and the DM (five runs), five members finish and the Event unlocks with a Muse-written line, a new topic generated for each of the four Sidequest games, and the AI's guess on two drawings.
- *In a headless browser:* Messenger home, the group thread, the Wager sheet, results, the unlock card and "I'm in", the game tray, a Sketch Off drawn inside the chat with the live AI guess, the Hangout, a streak page, Events, and the two inspectors.

**Not checked:** five real phones at once on one Wi-Fi; the Sketch Off guessing screens beyond the API; Ghost Run and Order Up! inside the chat (their servers and cards were exercised, not the play screens). Event photos could not load here tonight: the placeholder host was unreachable, so they showed as grey blocks.

**Muse spent tonight:** about $0.55 ($0.45 in the ledger, the rest in timing tests made outside it).

## 10. Commits on `demo-stage`, on top of `main`

```
76df425  Merge origin/sidequest-context
680b76d  Restore the daily Chat Games (revert eeb657c), alongside Sidequest
58a533c  Merge origin/streaks-screen
0844e7a  Glue: evidence filter, Ghost Run and Sketch Off in the context engine
4cafbe7  Demo prep script; unlock line no longer stalls the finishing player
e4ff5bd  Thread header pinned, cards scroll into view, image host fails fast
36ec9a6  Demo plan, runbook and README
915f5a4  Merge origin/main (PR #3); main's context engine replaces the glue from 0844e7a
         then the drop notification, and the docs commit that carries this file
```
