# PROGRESS

Running Muse spend (ledger, with 1.5× margin): **≈$5.2** at 04:15 PST (see `npm run ledger`; final eval $0.61, two 16-persona swarms $0.84 + $0.99, judge review, QA inputs ≈$0.4)

Earlier: **$1.46** at 03:17 PST (probes ≈$0.03 by hand + ledger; baseline eval $0.55; judge review ≈$0.12)

Earlier: **$0.26** at 02:50 PST (probes ≈$0.03 by hand + ledger $0.23: media index $0.04, 4 Discover runs ≈$0.05 each).

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

## Milestone 5 — Guide ✔ (02:55 PST)
- Done: `guide.ts` agent (taste + city media + live `look_at_photo` + `propose_guide`), credits forced to the real author, `/travel/[id]` page with the "Muse looked at a photo just now" box.
- Verified in browser: Dallas guide, 20s, $0.023, one live image read shown with its text.
- Fixed on the way: vision call returned empty because hidden reasoning ate `max_tokens` (now a length-aware retry in the client).

## Milestone 6 — Coordinate ✔ (03:00 PST)
- Done: shared-dates grid, alternative weekends, drafts (Muse writes words, code picks recipients; friend-of-friend → the mutual), drafts stored as Messenger messages with `status: draft`, Approve/Edit/Discard on the trip page and in the thread, recipients never see drafts or empty threads.
- Verified in two browser tabs: Maya approves the Cole message; Cole's inbox shows exactly that message.

## Milestone 7 — Entry points ✔ (03:05 PST)
- Feed nudge after the 2nd post, event "Make this a trip", profile "Open to hosting friends" toggle + "Plan a visit", Messenger chip, Menu → Trips. All screenshot-checked.

## Milestone 8 — Replay mode ✔ (03:10 PST)
- `replay.ts`, `npm run record` → `src/data/recordings.json`, `npm run replay:on/off`, automatic on API failure or budget guard; UI badge + banner. Verified: forced replay replays a real 51s run in 16s, trips re-validated.

## Fresh-eyes review (03:12 PST) and fixes
- Judge subagent scored AI 8 / Product 7 / Execution 6 / Originality 8 and found: three gas prices on one screen, an empty thread leaking to the recipient before approval, unreachable budget presets, no input validation, a duplicated driver row, evidence dropped for a mislabelled kind, mismatched placeholder photos on the first feed screen. All fixed (see DECISIONS.md 03:15); tests 14/14.

## Milestone 9 — Evaluation (baseline 03:14 PST; final run pending after persona fixes)
- `npm run eval` over 12 scenarios: rendered violations 0, raw grounding 100%, budget fit 76%, guide photo match 92% (24 labelled items), network trip 70% cheaper than hotel+solo, live Discover ≈25s, $0.55 for the eval. One crash (Hannah: malformed `trips`) fixed; Ella now declines by construction. Baseline kept in `eval/EVAL-baseline.md`.

## Milestone 9 — Evaluation, final ✔ (04:05 PST)
- `npm run eval`, 12 scenarios + 5 guides, all live: rendered violations **0** of 146 elements; raw grounding **100%**; budget fit **89%** (rest labelled over); guide photo match **90%** on labelled items, credit = real author 100%; network trip **73%** cheaper than hotel+solo; live Discover avg **26s**; $0.61. `EVAL.md` + `eval/results.json`. Baseline kept in `eval/EVAL-baseline.md`.

## Milestone 10 — Personas ✔ (before 03:38, after 03:56 PST)
- Two 16-persona swarms through the real endpoints. Before: 11/16 would go, trust 2.9, 13 flagged something (mostly model-written prices ≠ card). After fixes: 12/16, trust 3.0, 0 privacy violations both runs. `PERSONAS.md`, `sim/*.json`, `sim/summary-{before,after}.json`. Harness bug found and fixed on the way (persona wasn't shown the trip at the drafts stage).

## Milestone 11 — Animations ✔ (04:10 PST)
- `pitch/animations/agent.html` (Maya's Dallas run, replayed from the recording) and `swarm.html` (16 personas from sim summaries), built by `npm run animations`, self-contained, R to replay, `?final=1` for the PDF frame. Previewed at /api/pitch/animations/.

## Milestone 12 — README, pitch ✔ (04:15 PST; PDF re-exported at the end)
- README rewritten; `pitch/deck.html` (8 slides, real screenshots in `pitch/shots/`, numbers from EVAL/PERSONAS), `script.md`, `runbook.md`, `qa.md`, `submission.md`.

## Milestone 13 — Final QA (in progress)
- Fresh clone + `npm install` + `npm run build`: passed (03:35 PST).
- Ten judge-style inputs (`node scripts/qa-inputs.mjs`): 10/10 believable or declined with a reason, incl. $25 budget (Dallas flagged $32 over), one-night and week-long asks.
