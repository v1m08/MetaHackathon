# PROGRESS

Running Muse spend (ledger, with 1.5× margin): **$0.03** (probes before the ledger existed, estimated by hand from usage: ~6k tokens Spark/Wonder/Ember).

## Milestone 1 — Orient, PLAN.md, Muse proven ✔ (Thu Nov 12 02:10 PST)
- Done: codebase read; `GET /v1/models` listed; tool calling and image input proven on spark-1.3, wonder-1.0, ember-1.0 with real requests; JSON schema response_format works; `reasoning_effort` works.
- Verified by: probe scripts (scratchpad), outputs recorded in PLAN.md "Models".
- Next: Milestone 2 budget client.
- Known issues: one transient `ETIMEDOUT` to api.meta.ai during probing → client needs retry + fallback.
