# DECISIONS

One line per call made without a human. Newest at the bottom.

- 2026-11-12 02:05 — Agent model is `muse-spark-1.3`; vision/bulk model is `muse-ember-1.0` (both Muse). Spark reasons better per tool step, Ember is 12× cheaper and 4× faster for image notes and persona swarms. Both confirmed with real tool-calling and image-input requests.
- 2026-11-12 02:05 — `reasoning_effort: "low"` is the default on every chat call. Hidden reasoning tokens otherwise consume `max_tokens` (observed finish=length at 150 tokens with 148 reasoning tokens).
- 2026-11-12 02:05 — Images are always sent as `data:` URIs read from `.image-cache/`; the API refuses URLs whose robots.txt disallows fetching (picsum does).
- 2026-11-12 02:10 — No balance or pricing endpoint exists (`/usage`, `/billing`, `/credits`, … all 404). Prices come from third-party listings (Nov 2026): Ember $0.10 in / $0.004 cached / $0.50 out per 1M; Spark $1.25 / $0.15 / $4.25; Wonder $4 / $0.20 / $20. Unconfirmed, so the ledger applies a **1.5× margin** to every estimate and every settled cost, and image generation (not used) is booked at a deliberately high $0.15 per image. Team: check the real balance in the hackathon dashboard.
- 2026-11-12 02:10 — Budget split: `MODEL_BUDGET_USD=50` hard, `MODEL_BUDGET_RESERVE_USD=10` kept for final QA and recordings. Normal runs refuse at $40; only processes started with `AI_FINAL=1` may spend into the reserve. Nobody raises either without a human.
- 2026-11-12 02:10 — Identical requests are served from `.ai-cache/` at $0 and labelled `cached` in traces. This is a request cache, not the labelled "replay" fallback mode (that comes in Milestone 10 and is labelled separately in the UI).
