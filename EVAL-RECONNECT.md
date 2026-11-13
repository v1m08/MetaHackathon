# Reconnect eval

Ran 2026-11-13 00:06 UTC against the dev server, live Muse unless a row says otherwise. 252s. Re-run: `npm run eval:reconnect`.

## 1. Why-now grounding (9 drifted pairs with shared history)

| | |
|---|---|
| Nudges shown | **9 / 9** |
| Dropped by code | 0 |
| Shown lines whose every citation is real and includes both people | **9 / 9** (code check; the rest were dropped, not shown) |
| Shown lines with a mood / health / guilt word | **0 / 9** |

A dropped nudge is a success of the guardrail, not a failure of the product: nothing is better than a made-up reason.

<details><summary>Every pair</summary>

| viewer → friend | shown | line | cited | mode |
|---|---|---|---|---|
| maya → nadia | yes | from that last town lake full loop for breakfast tacos to her doing 7 miles at 19° in chicago | p_0001 | cached |
| maya → hannah | yes | tell her that UT Austin to 4th-grade classroom is a pretty iconic pipeline | fact:school:hannah | cached |
| maya → raj | yes | raj still owes you a rematch from that run club hill where you dropped everyone, perfect excuse to take the guest room | p_0008 | live |
| nadia → maya | yes | your 3-year roommate who stole your hot cheetos finally made something for the apartment that isn't food | p_0002 | cached |
| nadia → arjun | yes | you walked the turkey trot while arjun actually ran it, perfect excuse to claim that wicker park couch | p_0003, e_turkey_trot_2024 | cached |
| priya → arjun | yes | he called out ut people so you gotta pull up to wicker park and get him back for the bean tourist-trap saga. | fact:school:arjun, p_00nn | live |
| arjun → maya | yes | after the UT design show in the art building atrium, makes sense maya's now making lopsided bowls that actually survive | e_ut_design_show | cached |
| arjun → nadia | yes | that town lake 7am full loop before graduation is still your benchmark, time to join her lakefront version | p_0001 | cached |
| arjun → priya | yes | your fellow sugar land hackathon teammate locked it in, trade that bean photoshoot debt for dec 1 moving help | fact:hometown:priya, fact:how:priya, p_00nn | cached |

</details>

## 2. Plan grounding (4 targets, 12 rendered plans)

| | |
|---|---|
| Plans whose every person, event and ride id exists and is visible to the viewer | **12 / 12** |
| Plans whose per-person cost equals the sum of its code-computed lines | **12 / 12** |
| Plans with a model-written dollar figure in title / pitch / reasons | **0 / 12** |
| Average agent latency | 50.7s |
| Model cost for this section | $0.46 |

<details><summary>Every plan</summary>

| viewer → target | shape | title | when | each | ids real | adds up | repairs |
|---|---|---|---|---|---|---|---|
| maya → nadia | event | arjun's birthday second city night with nadia | 2026-12-05 | $307 | yes | yes |  |
| maya → nadia | visit | chicago weekend with nadia | 2026-12-04 | $293 | yes | yes |  |
| maya → nadia | call | quick call with nadia to lock chicago | 2026-11-20 | $0 | yes | yes |  |
| maya → cole,harper,kenji,tess,bri | visit | dallas weekend with cole, harper and kenji | 2026-12-11 | $81 | yes | yes | dropped a reason with a model-written price |
| maya → cole,harper,kenji,tess,bri | event | nashville songwriter night with tess and bri | 2026-12-04 | $253 | yes | yes |  |
| maya → cole,harper,kenji,tess,bri | call | group call to lock december with everyone | 2026-11-22 | $0 | yes | yes |  |
| priya → raj | event | montrose night market with raj | 2026-11-28 | $57 | yes | yes |  |
| priya → raj | visit | houston weekend with raj | 2026-11-20 | $111 | yes | yes | dropped a reason with a model-written price |
| priya → raj | call | call with raj to pick a date | 2026-11-20 | $0 | yes | yes |  |
| cole → maya | event | deep ellum vintage market with maya | 2026-12-12 | $28 | yes | yes |  |
| cole → maya | visit | austin weekend with maya | 2026-11-20 | $112 | yes | yes |  |
| cole → maya | call | call with maya | 2026-11-15 | $0 | yes | yes |  |

</details>

## 3. Reactivation, code only, whole seed (61 people)

| | |
|---|---|
| Friendships | 250 |
| Asleep (past their rhythm) | **154** (62%) |
| Napping | 152 |
| Asleep with shared history a nudge can cite | 38 |
| Asleep with a fresh post to hang a nudge on | 111 |

Rhythm = median gap between real exchanges over the last 180 days (two-way chats within 48h, events both went to, photos both tagged in; likes never count), clamped 7–120, default 30. These are seed numbers; the point is that the computation is code and runs on data Facebook already has.

## Limits

- Seeded world, ~60 people. Drift states depend on how the seed's timestamps fall relative to today.
- "Shown" counts code's verdict, not a human rating of whether the line is good; read the table.
- Plans are validated for grounding, not for whether a human would say yes. Availability for unknowns is honest "we'll ask".
