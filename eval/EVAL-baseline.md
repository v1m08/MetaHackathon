# EVAL

Ran 2026-11-12 11:14 UTC against the live app (`npm run eval`), 11 scenarios, modes: live. Raw results in `eval/results.json`.

## Results

| Metric | Result | How it was measured |
|---|---|---|
| **Grounding (rendered)** | **100%** of 150 trip elements trace to a real record the viewer can see | every host, driver, ride, event, person, post and reel on every card re-checked against the store after rendering |
| Grounding (raw model output) | 100% of 103 ids the model emitted were real and visible; 0 invented, 0 real-but-not-visible | the model's `propose_trips` call before validation |
| **Constraints** | **76%** of 29 proposed trips fit the budget; the other 7 are labelled "$X over" on the card; 100% fit the dates | `fitsBudget` from code-computed prices; dates enforced by validation |
| **Privacy** | **0 violations** in 150 rendered elements (target 0); 0 attempted violations caught before rendering | seed includes restricted profiles (ruben, simone, ivy, mei, ava, aisha, zoe) and 3rd-degree people; the test suite proves a friends-only post from a non-friend is dropped |
| **Guide attribution** | 92% of 13 recommendations on hand-labelled photos describe what is in the photo; credit = real author in 100% (forced in code) | `eval/labels.json` keywords vs. recommendation text; 5 guides, 8 live image reads |
| **Cost vs. hotel trip** | network trip averages **70% cheaper** than the same trip with a hotel and solo transport (29 trips; e.g. $110 vs $455, $120 vs $420, $130 vs $440) | seeded prices in `src/lib/travel/pricing.ts`, computed in code |
| Hosts | 28/29 trips have a host; all hosts had "open to hosting" on; 15 were friends-of-friends (with a named mutual) | audit |
| Declines | 0 scenarios declined gracefully (none) | result has no trips and a reason |
| Latency | live Discover averaged 25.5s (11 live runs) | SSE result |
| Muse spend | $0.550 for this eval (ledger, with 1.5× margin) | `npm run ledger` |

## Per scenario

| User | Weekend | Budget | Mode | Time | Trips (if-yes / otherwise) | Notes |
|---|---|---|---|---|---|---|
| maya | Dec 11–13 | $120 | live | 24.9s | Dallas $110/290 · Cole hosts · Ravi drives; San Antonio $120/265 · Gabriel hosts; Houston $130/280 (over) · Raj hosts | Dallas: Cole hosts, Ravi/Owen seats, vintage market |
| maya | Dec 4–6 | $150 | live | 22.1s | San Antonio $90/265 · Gabriel hosts · Tyler drives; Houston $130/280 · Raj hosts | Nashville (Kai hosts, Sofia flying) or SA/Houston day trips |
| maya | Dec 18–20 | $200 | live | 25.1s | Marfa $110/350 · June hosts · Kenji drives; San Antonio $120/265 · Gabriel hosts; Houston $130/280 · Raj hosts | Marfa with Kenji's car + June's casita |
| zoe | Dec 11–13 | $40 | live | 31.1s | Chicago $315/485 (over) · Mei hosts; Houston $130/280 (over) · Raj hosts; Dallas $140/290 (over) · Diego hosts | tiny budget: Dallas ride she's already on, or decline |
| ethan | Dec 11–13 | $300 | live | 22.5s | Denver $295/455 · Jules hosts; Dallas $110/290 · Cole hosts · Ravi drives; Houston $125/275 · Raj hosts | Denver: Jules hosts, comp, flight |
| devon | Nov 20–22 | $150 | live | 23.2s | New Orleans $105/345 · Elijah hosts · Finn drives; Houston $125/275 · TJ hosts; Dallas $135/285 · Diego hosts | New Orleans: Finn's van via Sam, Elijah hosts |
| priya | Dec 4–6 | $250 | live | 29.2s | Houston $130/280 · Raj hosts; San Antonio $90/265 · Gabriel hosts · Tyler drives; New Orleans $185/345 · Beau hosts | Chicago: Arjun hosts + his birthday |
| hannah | Nov 27–29 | $60 | error |  | proposal.trips.map is not a function | Thanksgiving weekend, few options |
| ella | Dec 4–6 | $80 | live | 30.3s | Houston $130/280 (over) · TJ hosts; San Antonio $175/265 (over) · Tyler drives | tiny network, nobody open to hosting → graceful decline |
| grace | Jan 1–3 | $400 | live | 22.9s | Dallas $135/285 · Cole hosts; New Orleans $210/365 · Beau hosts | NYC: Ava hosts (restricted profile), Wes's open house |
| marcus | Dec 25–27 | $150 | live | 25.7s | Houston $125/275 · TJ hosts; New Orleans $210/365 (over) · Elijah hosts | Atlanta: BeltLine run, Andre via Kwame |
| omar | Dec 18–20 | $250 | live | 23.5s | Marfa $110/350 · June hosts · Kenji drives; San Antonio $120/265 · Gabriel hosts; New Orleans $185/345 · Beau hosts | Denver (Mateo) or Houston (Layla), no hosts → honest |

## Guides

- **maya → Dallas** (live, 12.9s, 1 live image read): deep ellum pillars on a quiet sunday ← Cole ✓; big tex + fletcher's corny dog ← Harper; klyde warren food truck lawn ← Grace ✓
- **maya → San Antonio** (live, 24.1s, 2 live image reads): pearl at dusk ← Gabriel ✓; mission san josé with abuela energy ← Gabriel ✓; river walk, 20 mins max ← Lena
- **maya → Marfa** (live, 23.1s, 2 live image reads): prada marfa that isn't a store ← Kenji ✓; pull over for stars after prada ← Kenji ✓; chinati long buildings tour ← Lucas ✓; chinati outside at golden hour ← Lucas ✓
- **zoe → Chicago** (live, 28.4s, 2 live image reads): riverwalk sketch afternoon ← Mei ✓; the bean (yes, really) ← Priya ✓; the point lakefront walk ← Nadia; L ride window views ← Colin
- **ethan → Denver** (live, 25.0s, 1 live image read): union station plaza at 8am ← Noah ✓; great hall benches work sesh ← Noah ✗; ridge road before the storm ← Mateo; the $12 brewery paddle ← Omar ✓

## Limits, honestly

- These are seeded people and seeded prices. "70% cheaper" is arithmetic on our price table (gas $3.10/gal at 27 mpg, bus $12 + $0.07/mi, flights by distance band, hotel and hostel nightly rates per city), not market data.
- Grounding and privacy are enforced by code after the model answers; the "raw" row shows how often the model needed correcting. A judge should read the rendered row as the product guarantee and the raw row as the model's behaviour.
- Guide attribution: the credited friend is always the post's real author because code forces it. The keyword check only asks whether the recommendation is about what the photo shows; it is coarse and hand-labelled by us on 26 photos.
- Scenarios were chosen by us. Expectations in the Notes column are what we hoped for, not pass/fail criteria.
- Mode matters: rows marked `replay` or `cached` did not call Muse during this run.
