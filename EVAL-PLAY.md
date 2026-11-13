# Chat Games eval — MOCK DRY RUN

> **Mock dry run. No model was called and nothing was spent.** The server ran with `AI_MODE=mock`, so every game below is the code-built template and every unlock line is the mock line. These numbers show that selection, validation, play, scoring and unlocks hold together end to end. They say nothing about how well Muse writes a game. For that, run `npm run eval:play` against a live dev server (about 6 to 14 model calls at the default cap).

Ran 2026-11-13 03:16 UTC against http://localhost:3111, mode **mock**, 55s. Re-run: `npm run eval:play` (`EVAL_CHATS=n` sets the cap on games, default 6).

## What was run

18 seeded chats. 15 have 8 or more messages of their own, which makes 68 chat × format pairs (Lineup and Hot Seat need three people). The cap is 6 games, spread so each pick uses the chat and the format used least so far. Each game is generated through `POST /api/play/dev` with the format forced; code still picks the topic and the sources.

- Generated: c_volleyball · Wager, c_maya_jordan · Receipts, c_priya_aisha · Split, c_roomies · Blend, c_plano_east · Lineup, c_sam_sofia_lucas · Hot Seat
- Left out by the cap: 62 pairs. Chats not reached at all: c_sofia_lucas, c_maya_kai, c_devon_nina, c_ethan_priya, c_hannah_grace, c_zoe_jordan, c_maya_lucas, c_maya_nadia, c_sofia_maya
- Left out for too little material: c_maya_wes (6 messages), c_devon_elijah (6 messages), c_omar_ethan (6 messages)

## 1. Generation (6 games)

| | |
|---|---|
| Passed validation in the format asked for, no fallback | **6 / 6 (100%)** |
| Fell back to the template after the draft was refused | 0 |
| Chat could not support the format, so code switched to Split | 0 |
| Errors | 0 |
| Rounds kept | **16** |
| Rounds dropped by code | **0** |
| Other things code refused (an option, a pitch, a title, an unknown id) | 0 |
| Games with a mood / health / guilt word on screen | **0 / 6** |

No round was dropped.

A dropped round is the check working: the game ships with what passed, or falls back to the template, and nothing unverified is shown.

## 2. Grounding (16 rounds)

| | |
|---|---|
| Rounds citing a line a member of that chat wrote (a message in that thread, a post, a Reel) | **15 / 16 (94%)** |
| Rounds citing anything in the chat's index (adds members' interests and the real events / groups / listings of a Wager) | 16 / 16 (100%) |
| Citations that are not in that chat's thread or not by one of its members | **0** |

The script checks this itself: a cited message has to be in that conversation, from that sender; a cited post has to be by a member. A Wager's single round cites the three real things on offer, so it counts in the second row and only counts in the first if it also cites a line.

<details><summary>Every game</summary>

| chat | asked | got | topic | title | mode | kept | dropped | cites chat lines | refused by code |
|---|---|---|---|---|---|---|---|---|---|
| c_volleyball (8) | Wager | Wager | music | 10 points on live music | mock | 1 | 0 | 1 / 1 |  |
| c_maya_jordan (2) | Receipts | Receipts | food | Receipts: food edition | mock | 4 | 0 | 4 / 4 |  |
| c_priya_aisha (2) | Split | Split | food | The food split | mock | 3 | 0 | 3 / 3 |  |
| c_roomies (3) | Blend | Blend | food | Build the chat's Saturday | mock | 3 | 0 | 3 / 3 |  |
| c_plano_east (6) | Lineup | Lineup | food | The food lineup | mock | 2 | 0 | 2 / 2 |  |
| c_sam_sofia_lucas (3) | Hot Seat | Hot Seat | food | Hot Seat: Sofia | mock | 3 | 0 | 2 / 3 |  |

</details>

## 3. Unlock lines (2 cards)

Each of the 6 chats then played its game to the end as its real members (24 finishes, 0 errors). A chat only gets a card when its score and a settled topic have earned one, so cards come from the chats with seeded play history; one card a day per chat.

| | |
|---|---|
| Why lines whose numbers check out (copies one of code's counted facts word for word, no number outside it, recount agrees) | **2 / 2 (100%)** |
| Counted facts the script recounted from the raw answers and got the same numbers | 2 / 2 (100%) |
| Model lines code refused and replaced with the fact | 0 |

| chat | unlocked | at score | line on the card | recount | mode |
|---|---|---|---|---|---|
| c_volleyball | event: Porch Lights + Sun June (+ SAMANTHA_VR after) | 62 | 35 of 50 points went to this in today's Wager, so this one is for the whole chat. | 35 of 50 agrees | mock |
| c_maya_jordan | group: ATX Lunar New Year (20s & 30s) | 64 | 2 of 2 of you picked Jordan cooks in Thursday's Blend, so this one is for the whole chat. | 2 of 2 agrees | mock |

## 4. Mode and cost

| | |
|---|---|
| Mode | **mock** (dry run) |
| Game modes | 6× mock |
| Calls through the Muse client during the run | 8 (all answered by the mock, none sent) |
| Cost of this run, from the games and unlocks | $0 |
| Cost of this run, from the ledger (`/api/ai/status`, includes its safety margin) | $0 |
| Ledger after the run | $8.6976 of the $40 limit |

## Limits

- Seeded world. 15 chats have enough to go on and only two of them (c_volleyball, c_maya_jordan) have play history, so unlock lines are a sample of at most two per run.
- "Passed" is code's verdict (ids real, quotes found in the source, caps, word list, format rules). It is not a human rating of whether the game is fun; read the titles.
- The cap decides coverage. At 6 of 68 pairs, most chat × format pairs were not generated; they are listed in `eval/play.json` under `skipped`.
- Mock mode: the draft is the template built from the same store data the checks read, so it passing is expected. A live run is where rounds get dropped.
