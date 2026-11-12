# Where can my people take me?

A Facebook feature for young adults who want to travel and can't afford it. You give a **weekend and a budget**, not a destination. A **Muse agent** reasons across your actual network and proposes trips that only exist because of the people you know:

> *dallas with cole + harper for the deep ellum vintage market — ~$110 if Cole says yes to hosting and Ravi has a seat, ~$290 otherwise.*

Then it builds a **Guide** from what your friends posted there (read with Muse image understanding, every pick credited to the friend), and **Coordinates** the trip: who's free when, drafted messages, introductions through mutual friends, and nothing sends until you approve it in Messenger.

Built for Meta's "make Facebook valuable for young adults" hackathon on top of a mobile-first Facebook clone (every surface exists and is seeded). The core AI runs on **Meta Muse** through the Meta Model API.

```bash
npm install
cp .env.example .env.local      # put MODEL_API_KEY in it; without a key everything runs in mock mode
npm run dev                     # http://localhost:3000  → Menu → Trips, or /travel
```

Demo identity is per browser tab: open `http://localhost:3000/?as=maya` and, in a second window, `/messages?as=cole` to watch the approved message arrive. `pitch/runbook.md` has the click path.

## The loop

| Stage | What the user sees | What runs |
|---|---|---|
| **Discover** `/travel` | Weekend chips + budget. A live reasoning stream ("Mapping your whole network…", "Pricing Dallas: 2 nights, staying with a friend, by a friend's car", "Reading your friends' photos from Dallas"), then 2–3 trip cards with two prices, the host, the driver, the event, the people you know there and why. | `src/lib/travel/agent.ts`: a Muse tool-calling loop over viewer-scoped tools, ending in a `propose_trips` call. `validate.ts` checks every id and re-prices in code. SSE from `/api/travel/discover`. |
| **Guide** `/travel/[id]` | "Your guide, from your people": 4–6 picks, each credited ("from Cole's post · Plano East high school"), matched to your taste, with prices friends mentioned. One box shows a photo Muse looked at *just now* and what it saw. | `guide.ts`: reads friends' city posts + stored image notes, calls `look_at_photo` (live vision) on 1–2 photos, proposes; code forces the credit to the real author and drops anything the viewer can't see. |
| **Coordinate** same page | Availability grid for you, host, driver; alternative weekends if someone's busy; "Draft the messages (intros via your mutuals)". Drafts appear here and in Messenger as *awaiting your approval* with Approve / Edit / Discard. | `coordinate.ts`: dates in code; Muse writes the words; code picks recipients (friend-of-friend → the mutual, asking for an intro). Approval flips the draft to sent inside the clone; recipients never see drafts. |
| **Nudge** Feed | "Owen is driving to Dallas on Dec 12. You're free that weekend." → opens Discover with that trip. | `components/travel/Nudge.tsx` from `/api/travel/options` (rides from your city by people you can see, on weekends you're free). |
| Entry points | Events ("Make this a trip" on out-of-town events), Profile ("Open to hosting friends" toggle on your own; badge + "Plan a visit" on friends elsewhere), Messenger (chip in chats with people in other cities), Menu → Trips. | |

## Architecture

```
                 ┌──────────────────────── UI (Next.js app router, phone frame) ───────────────────────┐
                 │  /travel  Discover          /travel/[id]  Guide + Coordinate        Feed nudge,     │
                 │  reasoning stream (SSE)     Muse-saw box, credited picks, drafts     Events/Profile/ │
                 │  trip cards, two prices     Approve · Edit · Discard                 Messenger chips │
                 └───────────────┬─────────────────────────────────┬───────────────────────────────────┘
                                 │ POST /api/travel/discover (SSE)  │ /api/travel/guide (SSE), /coordinate, /drafts/[id]
                 ┌───────────────▼─────────────────────────────────▼───────────────────────────────────┐
                 │  src/lib/travel/                                                                     │
                 │  agent.ts ── Muse tool loop ──► tools.ts (viewer-scoped)                             │
                 │     scan_network · find_people_by_city · check_availability · estimate_trip_cost     │
                 │     get_city_media · propose_trips        guide: look_at_photo (vision) · propose_guide
                 │  visibility.ts  canSeeUser/Post/Reel/Event + connection(viewer, person)              │
                 │  validate.ts    every id re-checked, hosts must have opted in + be free, re-priced   │
                 │  pricing.ts     two prices + hotel/solo comparison, from a seeded table, in code     │
                 │  taste.ts       saved Reels + likes + interests × image notes → taste profile        │
                 │  coordinate.ts  shared dates · drafts · approve/edit/discard                         │
                 │  replay.ts      recorded real runs replayed when Muse is down (labelled)             │
                 │  checks.ts      fact audit used by the eval and the persona sim                      │
                 └───────────────┬────────────────────────────────────────────────────────────────────┘
                                 │
                 ┌───────────────▼────────────────────┐    ┌──────────────────────────────────────────┐
                 │  src/lib/ai/  ONE Muse client       │    │  src/server/db.ts  in-memory store       │
                 │  ai.text/json/tools (+images)       │    │  seeded from src/data (deterministic)    │
                 │  ledger.ts  budget guard, file lock │    │  61 people · 12 cities · hosting flags   │
                 │  cache.ts   identical req → $0      │    │  busy dates · 7 rides · 22 events        │
                 │  trace.ts   Inspector /dev/ai       │    │  55 licensed photos + Muse image notes   │
                 └─────────────────────────────────────┘    └──────────────────────────────────────────┘
```

**Data flow.** Pages call the API with an `x-user-id` header (per-tab identity). Travel routes call `src/lib/travel/*`, which read the same store the rest of the app renders. The agent never sees the store directly, only tool results that were filtered for that viewer.

## How Muse is used

| Use | Model | How |
|---|---|---|
| The agent (Discover, Guide, drafts) | `muse-spark-1.3` | OpenAI-compatible `/chat/completions` with `tools` and `tool_choice: "auto"` (the API only accepts auto), `reasoning_effort: "low"`, JSON-schema `response_format` for drafts. Loop capped at 8 round-trips; ends on `propose_trips` / `propose_guide`. |
| Image understanding | `muse-ember-1.0` | `image_url` content parts with `data:` URIs read from the local image cache (the API refuses URLs whose robots.txt disallows fetching). Used at index time over all 55 seeded photos (`src/data/mediaIndex.json`: description, tags, food, activities, vibe, goodFor) and live in the Guide's `look_at_photo`. |
| Persona simulation | `muse-ember-1.0` | Structured verdicts; see below. |

Model ids were confirmed against `GET /v1/models` and real requests on 2026-11-12 (PLAN.md). Everything goes through `src/lib/ai/index.ts`: traced for the Inspector, cached on disk when identical, and metered.

### The budget guard

Every live call **reserves a worst-case cost before it is sent** (prompt size, `max_tokens`, images, 1.5× margin on third-party prices) in a file-locked, gitignored ledger (`.ai-ledger.json`), then settles to the real `usage`. Retries and failed calls are booked. When the ledger reaches `MODEL_BUDGET_USD` (default 50; `MODEL_BUDGET_RESERVE_USD` 10 is kept for final QA and only spendable with `AI_FINAL=1`) the client refuses and the feature falls back to **replay** or mock, labelled in the UI. `npm test` proves refusal at a full ledger and under four parallel processes. `npm run ledger` prints spend by model and task; the Inspector header shows it live. The whole build, two persona swarms, the evaluation and final QA came to about $6 on the ledger (with its 1.5× margin), out of the $50 ceiling.

### Safety lives in the tools

- Every tool takes `ctx.userId` and returns only what that viewer can already see: friends, friends-of-friends through a named mutual, public content, their groups. `visibility.ts` is the one place that decides.
- After the model answers, `validate.ts` checks **every** person, ride, event, post and Reel id against the store *and* the viewer. Hosts must exist, live there, have **"Open to hosting friends"** on, and be free on the dates. Anything that fails is dropped and the reasons that cite it are scrubbed; repairs are logged on the card object and shown in the stream ("Fixed 2 things the model got wrong").
- Costs are never model arithmetic: `estimate_trip_cost` and the final card use `pricing.ts`.
- Friend-of-friend options appear only with the mutual named ("Ethan's friend · intro via Ethan"), and the drafted message goes to the mutual.
- Drafts are messages with `status: "draft"`; the conversation APIs hide other people's drafts; approval is the only path to `sent`. Sending is simulated inside the clone; nothing leaves the app.

## Fallback modes (labelled, never mistaken for live)

| Badge | When | What |
|---|---|---|
| **LIVE · Muse** | key set, API up | real calls |
| **Cached Muse response** | identical request seen before | served from `.ai-cache/` at $0 (warm the demo input once, then demo a slightly different one live) |
| **Replay of a recorded run** | API error / timeout, budget guard, or `npm run replay:on` / `AI_MODE=replay` | a real recorded run (`src/data/recordings.json`, made with `npm run record` from `.ai-runs/`) replayed with its original pacing; trips re-validated against the current store |
| **Mock · no model** | no key, or nothing to replay | code-only placeholder (hosts first), clearly marked |

## Running the evaluation and the simulation

```bash
npm test            # ledger/budget tests + tool layer, visibility rules, validation, cost math (node --test via tsx)
npm run eval        # 12 seeded scenarios through the real endpoints → EVAL.md + eval/results.json
npm run sim         # persona swarm → sim/<persona>.json, sim/summary-run.json (see PERSONAS.md)
npm run record      # copy the latest real runs into src/data/recordings.json for replay + animations
```

Final QA scripts: `node scripts/qa-demo-runs.mjs --n 5 [--vary]` (five consecutive full demo runs from reset, approval checked from the recipient's side) and `node scripts/qa-inputs.mjs` (ten judge-style inputs). Results of the last run are in `eval/` and `PROGRESS.md`.

`EVAL.md` reports grounding (rendered and raw), constraints, privacy (target zero, with restricted profiles seeded so a violation is possible and would be caught), guide attribution on hand-labelled photos (`eval/labels.json`), and network-trip vs hotel-trip cost.

### Persona simulation

`scripts/sim.mjs` drives 16 simulated young adults (`sim/personas.json`, each a seeded account with a different budget, network, car, taste and comfort with strangers; one has nobody open to hosting and should get a graceful decline). Each is played by a Muse agent that reads what the real feature returned through the same endpoints the UI calls, picks or rejects trips with reasons, reads the Guide, and approves / edits / refuses the drafts through the real approval endpoint. Personas give opinions; `checks.ts` checks facts. Full traces are in `sim/`. **These are simulated users, not user research**, and are labelled as such in `PERSONAS.md`, the deck and the script.

## What is simulated

- **People, posts, events, rides, chats** are fictional seed data (`src/data/`). Photos from other cities are real, openly licensed Wikimedia Commons images (`CREDITS.md`), and their captions were written *after* Muse described them, so captions match pixels.
- **Prices** come from a seeded table (`pricing.ts`); the "X% cheaper than a hotel trip" number is arithmetic on that table.
- **Availability** is a seeded busy-date list per person.
- **Sending a message** happens inside the clone; there is no real Messenger.
- **Personas** are Muse agents, not people.
- The Muse calls, tool use, image understanding, validation, pricing and approval flow are real.

## Repo map

```
src/lib/ai/            the one Muse client: index.ts, ledger.ts, cache.ts, trace.ts, mock.ts, tools.ts (base tools)
src/lib/travel/        agent, guide, coordinate, tools, visibility, validate, pricing, taste, replay, checks, store
src/app/api/travel/    discover (SSE), guide (SSE), coordinate, drafts/[id], options, trips/[id]
src/app/api/admin/     reset, dump, audit, mode (replay switch), index-media, warm-images
src/app/api/sim/       persona turn (through the client, so it is metered)
src/app/(app)/travel/  Discover page, trip page;  src/components/travel/  TripCard, Reasoning stream, Nudge
src/data/              users.ts + travelUsers.ts, cities.ts, travelPosts.ts, travelEvents.ts, media.json,
                       mediaIndex.json (Muse image notes), recordings.json (replay), helpers, travel.ts
scripts/               media-pick, credits, eval, sim, record, ledger
tests/                 ledger.test.mjs, travel.test.ts
pitch/                 deck.html, deck.pdf, script.md, runbook.md, qa.md, submission.md, animations/
PLAN.md · PROGRESS.md · DECISIONS.md · EVAL.md · PERSONAS.md · CREDITS.md
```

## Scripts

```
npm run dev / build / start     Next.js
npm run typecheck · npm test    tsc; node tests (ledger, tools, visibility, validation, pricing)
npm run reset                   restore the seed and clear trips/drafts (server must be running)
npm run warm                    cache every seed image locally
npm run index-media             rebuild Muse image notes (≈$0.04; only needed if photos change)
npm run eval · npm run sim      evaluation / persona swarm → EVAL.md, sim/
npm run record                  refresh replay recordings from real runs
npm run replay:on|off           force replay mode at runtime
npm run ledger                  Muse spend so far
```

Env (`.env.example`): `MODEL_API_KEY`, `MODEL_API_BASE_URL`, `MODEL_TEXT` (agent), `MODEL_VISION`, `MODEL_FAST`, `MODEL_IMAGE`, `AI_MODE` (`auto|live|mock|replay`), `MODEL_BUDGET_USD`, `MODEL_BUDGET_RESERVE_USD`, `AI_FINAL`.

## The clone underneath

Feed, Reels, Profile, Friends, Groups (with AI "Catch me up"), Events, Marketplace (with AI "Draft listing"), Messenger (live between two windows), Dating, Gaming, Notifications, Search, Saved, Menu, Switch account, and the AI Inspector at `/dev/ai` (every model call: prompt, output, tool steps, latency, tokens, mode, cost). Branding is a text wordmark and generic icons only. See `git log` for the base.
