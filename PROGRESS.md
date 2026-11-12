# PROGRESS

Running Muse spend (ledger, with 1.5× margin): **$0.26** at 03:20 PST (probes ≈$0.03 by hand + ledger $0.23: media index $0.04, 4 Discover runs ≈$0.05 each).

## Milestone 1 — Orient, PLAN.md, Muse proven ✔ (Thu Nov 12 02:10 PST)
- Done: codebase read; `GET /v1/models` listed; tool calling and image input proven on spark-1.3, wonder-1.0, ember-1.0 with real requests; JSON schema response_format works; `reasoning_effort` works.
- Verified by: probe scripts (scratchpad), outputs recorded in PLAN.md "Models".
- Next: Milestone 2 budget client.
- Known issues: one transient `ETIMEDOUT` to api.meta.ai during probing → client needs retry + fallback.

## Milestone 2 — Budget client ✔ (02:30 PST)
- Done: `src/lib/ai/ledger.ts` (file-locked reservations, 1.5× margin, $10 reserve), `cache.ts`, client rewrite (vision input as data URIs, `reasoning_effort: low`, retries, mock fallback labelled in traces), Inspector budget chip, `npm test` (5 tests incl. 4 parallel processes never overshooting).
- Verified: live tool call through `/api/ai/playground` cost $0.009 and the identical repeat was served from cache at $0.

## Milestone 3 — Seed + media index ✔ (03:10 PST)
- Done: 61 people in 12 cities (`travelUsers.ts`, labelled friendships, hosting opt-in, cars, busy weekends, restricted profiles), `cities.ts`, 55 openly licensed Commons photos (`media.json`, picked by `scripts/media-pick.mjs`), Muse image notes for all 55 (`mediaIndex.json`, $0.04 on muse-ember-1.0), 48 city posts + 12 reels whose captions were written AFTER the vision notes, 12 out-of-town events, 7 rides, 2 groups (22 posts), 6 chats. `POST /api/admin/reset` restores all of it; `GET /api/admin/dump` prints counts.
- Known: 2 scenes had no acceptable photo (den-rino, marfa-sky); 5 weak photos are deliberately unused. CREDITS.md still to write from media.json.

## Milestone 4 — Discover ✔ first pass (03:25 PST)
- Done: viewer-scoped tools (`src/lib/travel/tools.ts`), `visibility.ts`, `validate.ts` (every id checked, costs recomputed in code), `pricing.ts` (two prices + hotel/solo comparison), `agent.ts` (Spark tool loop, `scan_network` → prices → media → `propose_trips`), SSE route, `/travel` UI with animated reasoning stream and trip cards.
- Verified: live runs for Maya: Dec 4–6/$150 → San Antonio (Gabe hosting), Houston (Raj); Dec 11–13/$120 → Dallas (Cole hosting + Ravi's seats + vintage market, cites her saved Pearl reel). 25–27s, ≈$0.05 per run, mode labelled LIVE in UI. Screenshots checked in the browser pane.
- Next: Guide (M5), Coordinate (M6), tests for visibility/validation (tsx installed).
- Known issues: last model turn takes 8–10s (long JSON); `tool_choice` must be auto; Finn's ride is invisible to Maya by design (3rd degree).
