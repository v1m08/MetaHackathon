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
| | Before fixes | After fixes |
|---|---|---|
| Personas run | 16 | 16 |
| Would take the trip | 11/16 | 12/16 |
| Graceful declines | 0 | 0 |
| Surprising (1–5, mean) | 3.4 | 3.3 |
| Trustworthy (1–5, mean) | 2.9 | 3.0 |
| Personas who flagged something as broken | 13 | 13 |
| Privacy violations rendered (code-checked) | 0 | 0 |
| Drafts approved / edited / discarded | 10 / 4 / 1 | 9 / 4 / 1 |
| Muse spend | $0.84 | $0.99 |

| Persona | Ask | Result | Picked | Take? | ✨ | 🛡 | Drafts | In their words |
|---|---|---|---|---|---|---|---|---|
| **maya** | Dec 11–13, $120 | 3 trips | San Antonio | yes | 2 | 4 | 1✓ 0✎ 0✗ | san antonio feels the most doable to me — shortest ride, under budget even with the bus, and i actually know gabe through design. dallas is cheaper on paper but that's a 215mi drive depending on two different guys saying yes lol |
| **zoe** | Dec 11–13, $40 | 1 trip | — | no | 4 | 3 | — | i'd love a free place to crash but i can't justify blowing my whole budget like this, especially with someone i don't actually know yet. |
| **ethan** | Dec 11–13, $300, car | 2 trips | Dallas | yes | 4 | 3 | 2✓ 0✎ 0✗ | dallas is the only one that actually fits the $300 budget and isn't a brutal drive, but i'd only lock it in after cole and ravi confirm for real. |
| **devon** | Nov 20–22, $150, car | 3 trips | Houston | yes | 3 | 3 | 1✓ 0✎ 0✗ | houston is the only one that feels doable on $150 without depending on a van from vegas lol. short drive, own car, and raj's food tour actually sounds fun if tj's couch is real. |
| **priya** | Dec 4–6, $250 | 2 trips | Houston | yes | 2 | 3 | 1✓ 0✎ 0✗ | i'd pick houston, raj is an actual friend hosting for free so it feels way less sketchy than relying on gabe and tyler both saying yes. it's still under budget and the food/night market thing is more my vibe anyway. |
| **hannah** | Nov 27–29, $60, car | 1 trip | — | no | 3 | 2 | — | i'd love the night market idea but $75 is over budget and i'd be crashing with someone i don't actually know, so i'd pass for now. |
| **ella** | Dec 4–6, $80 | 1 trip | — | no | 4 | 2 | — | nah i can't swing $203 on an $80 budget, even if the pearl looks cute. feels like the app just picked the cheapest option and hoped i wouldn't notice the price. |
| **grace** | Jan 1–3, $400, car | 2 trips | San Antonio | yes | 4 | 3 | 0✓ 1✎ 0✗ | san antonio one feels way more doable for me, cheap and short drive and the pearl lights / food sounds actually fun. i'd just need gabe to actually confirm before i get my hopes up. |
| **marcus** | Dec 25–27, $150, car | 2 trips | Houston | yes | 3 | 3 | 0✓ 1✎ 0✗ | houston is the only one that actually fits the budget and it's a doable drive, the grill + cheap food vibe sounds fun if tj is real about hosting. |
| **omar** | Dec 18–20, $250 | 3 trips | San Antonio | yes | 3 | 3 | 0✓ 1✎ 0✗ | san antonio is the easiest one for me, short bus, free place to stay, and $96 actually fits my budget without stressing. tacos with gabe sounds like a chill weekend. |
| **sam** | Nov 20–22, $100 | 1 trip | — | no | 4 | 2 | — | sounds fun on paper and the network angle is surprising, but i'm not getting in a van / crashing at a stranger's place based on secondhand yeses. would need actual confirmation from finn and beau first. |
| **aisha** | Dec 25–27, $120 | 2 trips | San Antonio | yes | 4 | 3 | 1✓ 0✎ 0✗ | san antonio is the one i'd actually do — $96, short bus, and the pearl at dusk walk sounds like a perfect low-key saturday. i'd just need gabe to actually confirm before i get my hopes up. |
| **tyler** | Dec 4–6, $200, car | 3 trips | San Antonio | yes | 3 | 4 | 1✓ 0✎ 1✗ | san antonio is the only one that actually fits the $200 budget without a crazy drive and i already know lena/gabe so it doesn't feel like crashing with a stranger lol |
| **nina** | Nov 27–29, $90, car | 2 trips | Houston | yes | 3 | 4 | 1✓ 0✎ 0✗ | houston is the only one i'd actually do — tj's family and it's closer, even if it's $10 over budget. |
| **lucas** | Dec 18–20, $180 | 3 trips | San Antonio | yes | 3 | 3 | 0✓ 1✎ 0✗ | san antonio feels the most doable to me — close, cheap if gabe actually says yes, and not a huge haul for one weekend. |
| **kenji** | Dec 18–20, $150, car | 3 trips | San Antonio | yes | 3 | 3 | 1✓ 0✎ 0✗ | san antonio is the only one that actually fits the budget at $80, it's a short drive from austin, and a spare room + abuela cooking sounds way more doable than a 9-hour marfa haul. |

### Objections and "looks broken", verbatim

- **maya** — objection: still depends on gabe actually saying yes to hosting · objection: abuela living downstairs + cooking could get awkward fast · objection: dec running mornings might be colder than the pitch makes it sound · objection: $96 leaves almost no wiggle room if food costs more than $54
- **zoe** — objection: $108 is almost 3x my $40 budget, $245 if raj says no is way worse · objection: raj is a friend-of-a-friend i've never met, staying in his guest room feels like a big ask · objection: 173 miles each way on a bus for a weekend is a lot for this price
- **ethan** — objection: dallas price only works if both cole says yes to hosting AND ravi actually has a seat - neither is confirmed yet · objection: i'd be staying with cole who i only know via maya, and riding with ravi from board game night - basically friends of friends · objection: denver distance is a non-starter for dec 11-13, i'd spend the whole weekend in the car · objection: both trips hinge on other people saying yes first · broken: zoe nakamura shows up in the dallas people list but isn't mentioned in the pitch or reasons at all · broken: denver is 911 mi each way for a 2-night weekend - that's like 14+ hours driving each way, not really a weekend trip
- **devon** — objection: all prices only work if the host says yes, none of that is actually confirmed yet · objection: tj and raj are league / friend-of-friend level, couching with them for a whole weekend is a lot · objection: $54 for 3 days of food is super tight even with cheap eats · objection: new orleans is a 542 mi drive for a weekend and depends on finn actually having a seat · broken: trip 1 ride says finn leaves hotel vegas friday but he's supposedly driving a van from austin to new orleans · broken: trip 0 says raj is in montrose with a guest room backup but pitch has him driving you around bellaire, and towels included feels made up · broken: trip 2 host connection is 'jordan's friend (cousins)' so unclear if diego is actually a cousin or a stranger via jordan
- **priya** — objection: trip 1 depends on two second-degree people, gabe via maya and tyler via ethan, both actually saying yes · objection: no spurs tickets, pearl market costs, or backup if tyler's car falls through · objection: houston is a 346 mile round trip bus, that's a lot for one weekend · objection: dec 4-6 is fixed and both assume free hosting, no real plan b if raj says no · broken: getting around is only $6 for 3 days in both trips, that seems way too low · broken: $10 gas split for 174 miles round trip to san antonio feels too cheap · broken: spurs game is the whole pitch for trip 1 but no ticket price is in the $70 total · broken: layla haddad listed as 'omar's friend (siblings)' is confusing
- **hannah** — objection: $75 if raj and yara say yes is still over my $60 budget · objection: 173 miles each way is a long way to rely on yara having a seat · objection: staying with raj, who i only know via maya, feels like a big ask · objection: tj, maddie and the rest are all second-degree connections · objection: timing is off if the ride isn't until saturday morning · broken: pitch says yara drives down saturday morning but the trip starts friday nov 27 · broken: raj's guest room is in montrose but the pitch leans on bellaire eats, which is across town · broken: $75 if yes still doesn't fit the $60 budget
- **ella** — objection: $203 is almost 3x my $80 budget and food alone is $105 · objection: tyler is basically a stranger via hannah, seat isn't confirmed · objection: 87 miles each way is a lot for a random weekend · objection: no actual people listed, just names dropped in the pitch · broken: people list is empty even though the whole pitch depends on tyler and gabe · broken: event says pearl farmers market -> spurs game day trip but it's priced as 3 days / 2 nights, so which is it? · broken: host is null and the ride is only via hannah, so tyler isn't actually confirmed
- **grace** — objection: trip only works if gabe actually says yes to hosting · objection: staying with maya's friend and his abuela downstairs is a little much, i don't really know them · objection: 87 miles each way is still a drive for one weekend
- **marcus** — objection: trip 0 only works if tj actually says yes, otherwise it's $237 and over budget · objection: tj is a friend-of-a-friend via devon, never met him so couch surfing with a stranger is still a risk · objection: 346 miles round trip for 2 nights is a lot of driving over christmas weekend · objection: trip 1 is way too far and over budget even with the free couch · broken: trip 1 is already $184 even if elijah says yes, so it's over the $150 budget no matter what · broken: trip 1 pitch sells a slow streetcar commute view and second-line energy for a christmas weekend visit - you're not commuting there and that reel was about second line sundays, not dec 25-27 · broken: trip 1 is 542 mi each way from austin for a 2-night weekend, that's like 8+ hours driving each way
- **omar** — objection: nothing is actually confirmed yet, every host still has to say yes and all of them are just via maya · objection: marfa is way too far for a dec 18-20 weekend even with a ride · objection: san antonio and houston are buses so i'd be stuck on that schedule · broken: marfa gas split is $40 for 442 mi each way, that's 884 miles round trip, that math doesn't work · broken: marfa bus is $86 round trip for 442 mi each way, also way too cheap to be real · broken: houston pitch mentions crawfish in december, that's pretty off-season
- **sam** — objection: money: $105 is already over my ~$100 budget, and $307 if the ride/hosting falls through is way over · objection: strangers: crashing at beau's who i don't know, only via camille, and riding with finn who i don't know · objection: distance: 542 mi each way is a long drive for one weekend · objection: people/dates: late set is cool but i don't actually know if colin/samantha thing is real or if everyone's really going · broken: pitch says beau is free/open to hosting via camille, but that's not an actual yes from him · broken: price only works if both beau says yes AND finn has a seat, neither is confirmed · broken: 'ride with finn from hotel vegas' - no idea where that came from or if that's even where i'd be starting from · broken: people list adds zoe and elijah who aren't in the pitch at all
- **aisha** — objection: both only work if the host says yes, otherwise way over the $120 budget · objection: gabriel and raj are maya's friends, not people i actually know — staying over christmas weekend is a lot · objection: abuela cooking and raj's night market tour sound fun but also kind of high-pressure if i don't know them well · objection: houston is almost double the distance for only $12 more savings on paper, not worth it · broken: layla's free museum district sundays bit doesn't really fit — the trip ends sunday dec 27 so you wouldn't actually get that sunday · broken: layla haddad listed as 'omar's friend (siblings)' is confusing, unclear who that even is
- **tyler** — objection: san antonio only hits $80 if gabe actually says yes to hosting, and abuela cooking isn't guaranteed · objection: spurs tickets aren't included in that $80 price · objection: pickleball reason feels tacked on when the plan is pearl market to spurs · broken: nashville pitch says 'still under what you said' but it's $264 for a $200 budget and flagged overBudget · broken: nashville is listed as 888 mi each way, which isn't really a weekend drive
- **nina** — objection: $100 is over the $90 budget and tj hasn't actually said yes yet · objection: 173 miles each way is a long drive for just a weekend · objection: sleeping on tj's couch means i'm kinda locked into family/grill time · broken: dallas host diego is listed as both 'jordan's friend' and 'cousins' which doesn't line up · broken: tj's note says rodeo weekends he's booked but late november isn't rodeo season
- **lucas** — objection: none of the hosts are confirmed yet, they're all maya's friends i don't know · objection: the cheap prices only work if hosting actually pans out · objection: marfa is way too far for dec 18-20 · broken: marfa: 442 mi each way but only $40 gas split / $86 bus round trip, and that drive would eat most of the weekend
- **kenji** — objection: marfa is $161 even if june says yes so it's over the ~$150 budget, and $328 if she doesn't · objection: 442 miles each way to marfa is a brutal drive for a weekend · objection: all the hosts are second-degree via maya / vague connections, not people i actually know well, and none are confirmed yet · objection: prices depend entirely on free hosting + $54 of cheap food, so the real cost could jump fast · broken: all three say the host 'is free and hosting' in reasons but the price is still 'if X says yes' - so it's not actually confirmed · broken: marfa host note says 'any weekend except Chinati Weekend' but the trip is pitched around Marfa Night Sky Weekend / chinati with silas - unclear if that's the same weekend she's excluding · broken: trip 0 adds 'silas can show chinati like he did for lucas' and lists lucas as a person, but there's no context for that trip or him actually going

<!-- RESULTS:END -->

## What changed because of them

<!-- FIXES:BEGIN -->
The before-run's most common "looks broken" item, by far, was **the model quoting its own dollar figures** in pitches and reasons that disagreed with the code-computed card ("reasons say $80 total but priceIfYes is $100"). Thirteen of sixteen personas flagged something; most of it was that. What we changed between the runs:

- **Fix:** the model may no longer write dollar amounts; the card's two prices come from code only, and any reason or sentence containing a model-written price is dropped at validation (and logged in the stream).
- **Fix:** totals are now the exact sum of the rounded line items a judge can add up (Maya caught $36 + $54 + $6 ≠ $95).
- **Fix:** distance labels say "each way" (Priya read "542 mi" as a round trip).
- **Fix:** a ride that returns the same day is a day trip: zero nights, no lodging line (Ella was charged a hostel night for a day trip).
- **Fix:** the Guide is told the trip's month and asked to flag out-of-season posts (Priya: "crawfish in December").
- **Fix:** the Marfa event was renamed so it no longer collides with June's "any weekend except Chinati Weekend" hosting note (Omar, Lucas).

After the second run we also made (unmeasured by a third swarm, noted here honestly): trip dates follow the driver's departure and return (Hannah: "Yara drives Saturday but the trip starts Friday"); pitches lose sentences that name people validation removed (Ella: "pitch depends on Tyler and Gabe but people is empty"); "under budget" claims are stripped from trips that price over budget (Tyler); friend-of-friend labels read "via Jordan · cousins" instead of "Jordan's friend (cousins)" (Nina); the prompt says "open to hosting", never "is hosting" (Kenji: "reasons say the host is hosting but the price still says if").

What did not move: "surprising" stayed around 3.3–3.4 (personas found Texas day trips sensible rather than surprising) and nobody was declined, because Ella can reach a day-trip ride through Hannah → Tyler, which the product correctly allows. We kept her as a persona because that outcome is informative: a thin network gets a thin, honest answer.
<!-- FIXES:END -->

## Caveats

- A persona is a language model told to be a person. It is useful for catching things that read wrong, confusing copy, missing information and obviously broken output. It is not evidence that real young adults would travel, trust, or come back. We present the numbers as a stress test of the product, in one or two sentences, and never as validation.
- Personas saw structured JSON of the cards, not the pixels, so visual polish is not covered here (that is in PROGRESS.md's browser checks).
- The same model family plays the persona and powers the product. We mitigated this by having code, not the persona, check every factual claim, and by including personas whose correct outcome is to be told no.
- Costs: one persona end to end (Discover + Guide + Coordinate + two verdicts) is about $0.10 of Muse on the ledger with its 1.5× margin.
