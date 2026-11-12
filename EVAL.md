# EVAL

Ran 2026-11-12 12:05 UTC against the live app (`npm run eval`), 12 scenarios, modes: live. Raw results in `eval/results.json`.

## Results

| Metric | Result | How it was measured |
|---|---|---|
| **Grounding (rendered)** | **100%** of 146 trip elements trace to a real record the viewer can see | every host, driver, ride, event, person, post and reel on every card re-checked against the store after rendering |
| Grounding (raw model output) | 100% of 109 ids the model emitted were real and visible; 0 invented, 0 real-but-not-visible | the model's `propose_trips` call before validation |
| **Constraints** | **89%** of 27 proposed trips fit the budget; the other 3 are labelled "$X over" on the card; 100% fit the dates | `fitsBudget` from code-computed prices; dates enforced by validation |
| **Privacy** | **0 violations** in 146 rendered elements (target 0); 0 attempted violations caught before rendering | seed includes restricted profiles (ruben, simone, ivy, mei, ava, aisha, zoe) and 3rd-degree people; the test suite proves a friends-only post from a non-friend is dropped |
| **Guide attribution** | 90% of 10 recommendations on hand-labelled photos describe what is in the photo; credit = real author in 100% (forced in code) | `eval/labels.json` keywords vs. recommendation text; 5 guides, 9 live image reads |
| **Cost vs. hotel trip** | network trip averages **73% cheaper** than the same trip with a hotel and solo transport (27 trips; e.g. $57 vs $261, $99 vs $389, $111 vs $411) | seeded prices in `src/lib/travel/pricing.ts`, computed in code |
| Hosts | 26/27 trips have a host; all hosts had "open to hosting" on; 13 were friends-of-friends (with a named mutual) | audit |
| Declines | 0 scenarios declined gracefully (none) | result has no trips and a reason |
| Latency | live Discover averaged 26.3s (12 live runs) | SSE result |
| Muse spend | $0.610 for this eval (ledger, with 1.5× margin) | `npm run ledger` |

## Per scenario

| User | Weekend | Budget | Mode | Time | Trips (if-yes / otherwise) | Notes |
|---|---|---|---|---|---|---|
| maya | Dec 11–13 | $120 | live | 27.1s | Dallas $57/178 · Cole hosts · Ravi drives; San Antonio $99/235 · Gabriel hosts; Houston $111/251 · Raj hosts | Dallas: Cole hosts, Ravi/Owen seats, vintage market |
| maya | Dec 4–6 | $150 | live | 28.5s | San Antonio $52/156 · Gabriel hosts · Tyler drives; Houston $111/251 · Raj hosts; Dallas $117/261 · Cole hosts | Nashville (Kai hosts, Sofia flying) or SA/Houston day trips |
| maya | Dec 18–20 | $200 | live | 22.7s | San Antonio $99/235 · Gabriel hosts; Marfa $103/319 · June hosts · Kenji drives; New Orleans $163/313 · Beau hosts | Marfa with Kenji's car + June's casita |
| zoe | Dec 11–13 | $40 | live | 23.1s | Houston $111/251 (over) · Raj hosts | tiny budget: Dallas ride she's already on, or decline |
| ethan | Dec 11–13 | $300 | live | 25.5s | Denver $272/424 · Jules hosts; Dallas $60/178 · Cole hosts · Owen drives; Houston $103/243 · Raj hosts | Denver: Jules hosts, comp, flight |
| devon | Nov 20–22 | $150 | live | 23.6s | Houston $103/243 · TJ hosts; New Orleans $108/313 · Elijah hosts · Finn drives; Dallas $112/256 · Diego hosts | New Orleans: Finn's van via Sam, Elijah hosts |
| priya | Dec 4–6 | $250 | live | 21.9s | Houston $111/251 · Raj hosts; San Antonio $52/156 · Gabriel hosts · Tyler drives | Chicago: Arjun hosts + his birthday |
| hannah | Nov 27–29 | $60 | live | 29.5s | Houston $57/170 · Raj hosts · Yara drives | Thanksgiving weekend, few options |
| ella | Dec 4–6 | $80 | live | 35.9s | San Antonio $130/156 (over) · Tyler drives | tiny network, nobody open to hosting → graceful decline |
| grace | Jan 1–3 | $400 | live | 24.0s | San Antonio $83/219 · Gabriel hosts; Houston $103/243 · Raj hosts; Dallas $112/256 · Cole hosts | NYC: Ava hosts (restricted profile), Wes's open house |
| marcus | Dec 25–27 | $150 | live | 30.3s | Houston $103/243 · TJ hosts; Atlanta $285/433 (over) · Andre hosts | Atlanta: BeltLine run, Andre via Kwame |
| omar | Dec 18–20 | $250 | live | 23.6s | San Antonio $99/235 · Gabriel hosts; Marfa $103/319 · June hosts · Kenji drives | Denver (Mateo) or Houston (Layla), no hosts → honest |

## Guides

- **maya → Dallas** (live, 27.4s, 2 live image reads): deep ellum pillars on a quiet sunday ← Cole ✓; klyde warren food truck lawn ← Grace ✓; big tex at the fairgrounds ← Harper
- **maya → San Antonio** (live, 27.2s, 1 live image read): pearl at dusk ← Gabriel ✓; river walk, 20 mins max ← Lena; mission san josé ← Gabriel ✓
- **maya → San Antonio** (live, 25.5s, 2 live image reads): pearl at dusk ← Gabriel ✓; mission san josé arches ← Gabriel ✓; river walk, 20 mins max ← Lena
- **zoe → Houston** (live, 38.1s, 2 live image reads): the $4.50 banh mi on bellaire ← Raj ✓; raj's night market drive ← Raj ✗; museum district free sundays ← Layla; saturn v lying down ← Layla
- **ethan → Denver** (live, 33.7s, 2 live image reads): union station early ← Noah ✓; the $12 brewery paddle ← Omar ✓; ridge road in summer vs december ← Mateo

## Limits, honestly

- These are seeded people and seeded prices. "73% cheaper" is arithmetic on our price table (gas $3.10/gal at 27 mpg, bus $12 + $0.07/mi, flights by distance band, hotel and hostel nightly rates per city), not market data.
- Grounding and privacy are enforced by code after the model answers; the "raw" row shows how often the model needed correcting. A judge should read the rendered row as the product guarantee and the raw row as the model's behaviour.
- Guide attribution: the credited friend is always the post's real author because code forces it. The keyword check only asks whether the recommendation is about what the photo shows; it is coarse and hand-labelled by us on 26 photos.
- Scenarios were chosen by us. Expectations in the Notes column are what we hoped for, not pass/fail criteria.
- Mode matters: rows marked `replay` or `cached` did not call Muse during this run.
