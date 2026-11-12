# PERSONAS — a simulated stress test

**These are simulated users, not user research.** Each persona below is a seeded account in the clone played by a Muse agent (`muse-ember-1.0`) that was told who it is and asked to react to what the real product returned. The product calls were real: the same endpoints the UI uses (`/api/travel/discover`, `/guide`, `/coordinate`, `/drafts/[id]`), live Muse (`muse-spark-1.3`), real validation and pricing. Personas give opinions (would they go, how surprising, how trustworthy, objections); **code checks facts** (grounding, privacy, budget) through `/api/admin/audit`, never the persona. Full traces: `sim/<persona>.json`; summaries: `sim/summary-before.json`, `sim/summary-after.json`. Run with `npm run sim`.

## The personas

Sixteen young adults who differ in the ways that matter: budget (one at $40), network size and spread, car or not, taste, comfort staying with someone they don't know, restricted-privacy friends, and one (Ella) whose network has nobody open to hosting, where the right answer is a graceful decline.

| Persona | Seeded account | Weekend | Budget | Car | What makes them different |
|---|---|---|---|---|---|
| Maya | `maya` | 4th | $120 | no | demo user; college friends in 11 cities; hesitant with strangers unless vouched |
| Zoe | `zoe` | 4th | $40 | no | broke sophomore, private profile, only goes if the ride is free and the couch guaranteed |
| Ethan | `ethan` | 4th | $300 | yes | climber with a car; wants specifics, hates wasted time |
| Devon | `devon` | 1st | $150 | yes | ER night nurse; dates matter; won't stay with someone he's never met |
| Priya | `priya` | 3rd | $250 | no | will spend for a close friend's birthday; wants to know exactly who's going |
| Hannah | `hannah` | 2nd (Thanksgiving) | $60 | yes | budgets to the dollar; family-first weekend |
| Ella | `ella` | 3rd | $80 | no | tiny circle, nobody open to hosting out of town → should be declined |
| Grace | `grace` | 7th | $400 | yes | will fly for NYC with an internship friend whose profile is restricted |
| Marcus | `marcus` | 6th | $150 | yes | would drive far for a run or meet; OK with a friend-of-a-friend from lifting |
| Omar | `omar` | 5th | $250 | no | cyclist; no hosts in his far network → honesty test |
| Sam | `sam` | 1st | $100 | no | nightlife; music-industry friends everywhere; floor-sleeper |
| Aisha | `aisha` | 6th | $120 | no | restricted profile; careful about privacy and imposing |
| Tyler | `tyler` | 3rd | $200 | yes | the driver; "let's just go"; hosts too |
| Nina | `nina` | 2nd | $90 | yes | family or very close friends only (brother in Houston) |
| Lucas | `lucas` | 5th | $180 | no | photographer; easygoing about couches |
| Kenji | `kenji` | 5th | $150 | yes | usually the driver; judges whether the app understands he has the car |

Weekend numbers count upcoming weekends from the day the app was started (seed dates are relative), so the labels in the tables below are what the personas actually saw.

## What they did

Each persona: entered its weekend and budget → read the proposed trips (or the decline) and gave a structured verdict (pick, would take, surprising 1–5, trustworthy 1–5, objections, anything that looked broken) → opened the Guide for the trip it picked → approved, edited or discarded each drafted message through the real approval endpoint. Two or three were also driven through the browser UI by hand (see PROGRESS.md final QA).

## Results

<!-- RESULTS:BEGIN -->
_(filled by `node scripts/personas-md.mjs sim/summary-before.json sim/summary-after.json`)_
<!-- RESULTS:END -->

## What changed because of them

<!-- FIXES:BEGIN -->
- **Fix:** _(filled after the before-run)_
<!-- FIXES:END -->

## Caveats

- A persona is a language model told to be a person. It is useful for catching things that read wrong, confusing copy, missing information and obviously broken output. It is not evidence that real young adults would travel, trust, or come back. We present the numbers as a stress test of the product, in one or two sentences, and never as validation.
- Personas saw structured JSON of the cards, not the pixels, so visual polish is not covered here (that is in PROGRESS.md's browser checks).
- The same model family plays the persona and powers the product. We mitigated this by having code, not the persona, check every factual claim, and by including personas whose correct outcome is to be told no.
- Costs: one persona end to end (Discover + Guide + Coordinate + two verdicts) is about $0.10 of Muse on the ledger with its 1.5× margin.
