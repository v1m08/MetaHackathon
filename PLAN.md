# PLAN — "Where can my people take me?"

Hackathon entry built on the Facebook clone in this repo. Deadline **Fri Nov 13, 10:30am PST**; demo-ready target **07:30 PST**. Work started Thu Nov 12 01:57 PST.

## The idea in one line
You give a weekend and a budget. A Muse agent reasons over your actual network (who lives where, who is open to hosting, who is driving to what, what your friends posted and filmed from those cities) and proposes trips that only exist because of the people you know.

## Architecture

```
UI (phone frame, Next.js app router, client components)
  /travel                 Discover: weekend + budget → streamed reasoning → trip cards (two prices, connections)
  /travel/[tripId]        Guide (credited, taste-matched picks, one live image read) + Coordinate (dates, drafts, approval)
  Feed nudge, Events/Profile/Messenger entry points, Messenger "awaiting approval" drafts
        │  SSE  /api/travel/discover   (streams agent steps + final validated trips)
        │       /api/travel/guide, /api/travel/coordinate, /api/travel/approve …
        ▼
Agent layer  src/lib/travel/
  agent.ts        Muse tool-calling loop (ai.tools) with an onStep callback → SSE
  tools.ts        viewer-scoped tools: people_in_city, hosting_status, events_and_rides, media_for_city,
                  cost_estimate, availability, draft_message … every tool takes ctx.userId and only returns
                  what that viewer can see (visibility.ts)
  visibility.ts   canSee(viewerId, post|reel|user|event) — one function, used by every tool and by validate.ts
  validate.ts     every id in model output checked against the store; drop/repair; cost recomputed in code
  pricing.ts      seeded prices: gas per mile, bus/flight by city pair, hotel per night, hostel… (no model math)
  index/          media index built once with Muse vision over seeded photos; stored as JSON notes
        ▼
AI layer  src/lib/ai/  (single client; every call traced, cached, ledgered, budget-guarded, mock-able)
  ledger.ts       gitignored .ai-ledger.json, file-locked, worst-case reservation before each call
  cache.ts        gitignored .ai-cache/, identical request → identical response, $0
  index.ts        ai.text / ai.json / ai.tools / ai.image, images[] input, reasoning_effort, budget fallback
        ▼
Store  src/server/db.ts  in-memory, seeded from src/data (deterministic), POST /api/admin/reset
```

## Models (proven Nov 12 02:05 with real calls)
- `GET /v1/models`: muse-spark-1.3, muse-spark-1.2, muse-spark-1.1, muse-wonder-1.0, muse-ember-1.0, muse-image-1.0, sam-3.1, muse-voice-transcribe-1.0.
- Tool calling: works on spark-1.3, wonder-1.0, ember-1.0 (finish_reason `tool_calls`, OpenAI shape).
- Image input: works on all three via `image_url` with a `data:image/jpeg;base64,…` URI. Public URLs are fetched by the API only if robots.txt allows (picsum is refused), so we always send data URIs from the local image cache. One 256×192 JPEG ≈ 600 prompt tokens.
- All three are reasoning models: hidden reasoning tokens count against `max_tokens`. `reasoning_effort: "low"` cuts them ~8× (158 → 19) with no loss on tool selection. Default everywhere.
- Choice: **agent = muse-spark-1.3** (best reasoning per step, ~1.8s/step at low effort), **vision + bulk = muse-ember-1.0** (1.4s per image, 12× cheaper). Both are Muse models, satisfying the rule.
- Image generation (`muse-image-1.0`) is not needed by this feature.

## Budget
Hard limit $150 on the key; this build's ceiling **$50**, enforced in code (ledger + reservation), with a **$10 reserve** that only final-QA runs (`AI_FINAL=1`) may spend. Prices are third-party reported and unconfirmed, so every estimate uses a 1.5× margin. See DECISIONS.md.

## Milestones and acceptance checks
1. **Orient + prove Muse** — models listed, tools + image proven with real calls. ✔ when PLAN/DECISIONS/PROGRESS exist and probe output is recorded.
2. **Budget client** — ledger, cache, budget test. ✔ when `npm test` proves refusal at a full ledger and a live call through the app records cost.
3. **Seed** — 60+ people, 8+ cities, hosting flags, availability, travel-implying RSVPs with drivers/seats, city media. ✔ when `POST /api/admin/reset` restores it and counts are printed by a script.
4. **Media index** — Muse vision notes per photo/reel, built once, stored in `src/data/mediaIndex.json`. ✔ when every city photo has tags/notes and the ledger shows the cost.
5. **Tools + safety** — viewer-scoped tools, `canSee`, output validation, tests. ✔ when tests show a private post is invisible to a non-friend and an invented id is dropped.
6. **Discover** — SSE stream of steps, trip cards with connection chain and both prices. ✔ when a judge-typed weekend+budget yields believable trips in <30s in the browser.
7. **Guide** — credited recommendations from indexed media, matched to the user's saved/liked taste, one live image call shown. ✔ in browser.
8. **Coordinate** — shared free dates, drafted messages, mutual-friend intros, approval state in Messenger. ✔ when a draft appears as "awaiting your approval" and sends only on tap.
9. **Entry points + nudge** — Feed nudge card, Events/Profile/Messenger buttons. ✔ in browser.
10. **Replay mode** — recorded real runs replayed when API down, labelled. ✔ with network off.
11. **Evaluation** — `npm run eval` → EVAL.md with grounding, constraints, privacy, attribution, cost.
12. **Personas** — `npm run sim` → sim/*.json, PERSONAS.md, fixes.
13. **Animations, README, pitch, final QA.**

## Risks
- API latency spikes or outage during the pitch → replay mode (M10) and cached requests.
- Reasoning tokens blowing `max_tokens` → low effort + generous caps (observed `finish=length` at 150).
- Picsum placeholder photos don't match captions → media index must be built from photos chosen to match; CREDITS.md records sources. Where a photo cannot match, the caption is written to match the photo, not the other way round.
- Budget overshoot from parallel scripts → file-locked ledger with reservations; test proves refusal.
- Judges typing odd inputs → graceful decline path with a reason, tested in final QA.
