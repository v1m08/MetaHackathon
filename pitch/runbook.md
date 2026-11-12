# Demo runbook

## Before the room (10 min)

1. `cp .env.example .env.local` if needed; make sure `MODEL_API_KEY` is set and `MODEL_BUDGET_USD` is raised for demo day (the team decides; the guard refuses live calls past it and falls back to replay).
2. `npm install && npm run build && npm start` on the demo laptop (production build: no compile pauses). Open http://localhost:3000.
3. Warm everything once:
   - `npm run warm` (caches all images; demo works with no internet except Muse)
   - Open `http://localhost:3000/travel?as=maya&start=<Fri>&end=<Sun>&budget=120&run=1` for the weekend you'll demo (use the Dallas weekend chip, 4th from today) and let it finish. This caches the exact Muse responses, so a repeat of the same input is instant and labelled "cached". For the live demo use a *different* budget (e.g. $130) so judges see Muse run live.
   - Check `npm run ledger` and the Inspector header budget chip.
4. `npm run reset` to restore seed state (clears trips, drafts, sent messages).
5. Two browser windows side by side: **A** = `http://localhost:3000/?as=maya` (phone frame), **B** = `http://localhost:3000/messages?as=cole`. Both windows share the server; identity is per tab.
6. Projector: the phone frame is 390×844 on a dark stage; zoom the browser to ~125% if the room is big.

## The click path (≈3 min live)

1. **Window A, Feed.** Scroll to the nudge after the second post: "Owen is driving to Dallas on Dec 12. You're free that weekend." Say the line. Tap it.
2. **Discover opens and runs** (the weekend and a hint are prefilled). Narrate the stream as it lands: "it's mapping her network across 11 cities… 22 people open to hosting… pricing San Antonio, Houston, Dallas… reading her friends' photos from Dallas". ~25 s. If you want to type instead: pick a weekend chip, type a budget, "Find my trips".
3. **Trip cards.** Point at: two prices ("~$110 if Cole says yes and Ravi has a seat, ~$290 otherwise, hotel trip ~$455"), Cole "Plano East high school · Open to hosting", Ravi "Ethan's friend · intro via Ethan", the vintage market, the reasons that cite her saved Reel. Tap **Build my guide**.
4. **Guide.** The stream reads her friends' Dallas posts; one line says "Muse saw: …" with the photo — that's live image understanding. Picks are credited: "from Cole's post · Plano East high school".
5. **Make it happen.** Availability grid (everyone free). Tap **Draft the messages (intros via your mutuals)**. Three drafts appear: Cole (host), Ethan (intro to Ravi for the seat), Harper. Read the Ethan one aloud: it asks for an intro, it doesn't message Ravi directly. Tap **Approve & send** on Cole's.
6. **Window B (Cole).** The chat with Maya shows the message; the other two drafts don't exist for him. "Nothing sends without approval; nothing leaves the app."
7. Optional 20 s: open the **AI Inspector** (⌁ icon top right) to show the raw tool calls, tokens, latency and the budget chip.

## Reset between runs

- `npm run reset` (or `POST /api/admin/reset`): restores seed, clears trips and drafts. The image cache and the Muse response cache stay warm.
- To clear the Inspector list: `curl -X DELETE localhost:3000/api/ai/trace`.

## If something fails

| Symptom | Do this |
|---|---|
| Discover spins past 40 s | Wait for it; the API sometimes takes 10–15 s on the final turn. If the stream errors, re-tap; the first turns are cached. |
| "Muse didn't answer, replaying a recorded run" appears | That's the fallback working. Say so: "the API blinked, so it's replaying one of our recorded real runs, re-checked against today's data." The badge says REPLAY. |
| You want to guarantee no live dependency | `npm run replay:on` before the demo (badge shows REPLAY on every run), `npm run replay:off` after. Recordings: `src/data/recordings.json` (`npm run record` to refresh from real runs). |
| Budget guard refuses (red chip, "Budget guard" line) | The ledger hit `MODEL_BUDGET_USD`. Raise it in `.env.local` and restart, or run in replay. Never edit `.ai-ledger.json`. |
| Images blank | `npm run warm` with the server up; placeholders fall back to gradients so the demo still works. |
| Messenger window B doesn't update | It polls every 1.5 s; click into the chat or refresh. Check both windows are on the same server. |
| Cards show "Mock" badge | No key loaded. Check `.env.local` and restart `npm start`. |
| Laptop offline except Muse | Fine: all images are cached, prices are local, only Muse calls go out. |
| Everything offline | `npm run replay:on`; the demo path replays recorded runs; drafts fall back to mock text (labelled). |

## Numbers to have on hand

- Discover: ~25 s live, ≈$0.05 Muse. Guide: ~20 s, ≈$0.025, one live image read.
- Seed: 61 people, 12 cities, 55 licensed city photos indexed by Muse, 12 out-of-town events, 7 rides.
- Eval and persona numbers: `EVAL.md`, `PERSONAS.md`.
