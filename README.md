# Reconnect — friendships don't end, they go quiet

Facebook is the only place that still knows everyone you've lost touch with. Reconnect is the feature that hears the silence, tells you when it's mutual, and gives you the reason, the words and a plan to break it. Built on a Facebook clone for young adults; **Muse** powers the parts that need language (why now, the plan, the words) and **code** decides everything that must be true (who you've drifted from, what's cited, who's free, what it costs, who sees what).

Branch: **`reconnect`** (this). `travel` holds the previous feature (Trips + Open Door), whose agent, availability inference, pricing and validation this one is built on. `main` is meant to be the bare clone.

## The problem, as the product sees it

1. **Silence has no notification.** Every app tells you when something happens. Nothing tells you when nothing has happened for too long with someone who mattered. Telling a real exchange from a reaction, and a close tie from a classmate, across hundreds of people, is reading meaning, not counting.
2. **Reaching out after silence feels wrong.** "It's been too long, what do I even say, what if they don't care." People reliably underestimate how glad the other person would be. Nobody has ever handed someone a legitimate reason to text a friend they lost.
3. **"Who's in?" is followed by silence.** Group asks die because everyone waits for everyone. A concrete default, built from what people already said, gets the first yes.

Event planning tools solve the step after all three. Reconnect works on the three.

## Seven moments, on surfaces that already exist

| # | Surface | What happens | Code decides | Muse does | You |
|---|---|---|---|---|---|
| 1 | Notification | *Nadia just posted from Chicago. From that last Town Lake loop… it's been 7 weeks.* | drift state (rhythm, days since a real exchange), one nudge a day, friends only | one sentence linking the post to shared history | tap or ignore |
| 2 | Feed post | A strip under the friend's post with the line and the evidence as chips; **What was used** opens the full index: cited, shared-but-unused, never-read | every cited id exists, includes both of you, isn't the trigger; no mood/health/guilt words | picks the link, returns ids | open evidence, **Plan something** or **Just say hi** |
| 2b | Person page | **I miss them**: a private tap. If they tapped you too, you both find out. Nobody else ever does. | storage keyed by picker; only the viewer's own picks and the `mutual` bit are ever returned | nothing | tap (or don't) |
| 3 | Plan sheet | 2–3 concrete shapes: visit their city, hang out here, an event one of you is already going to, a call. Who, when (with each person's own words about the dates), cost line by line | people visible, dates future, ids real, ride attached if a friend drives, cost from the price table, availability from RSVPs / posts / your chats | tool-using agent: reads context, infers availability, prices, proposes | pick one |
| 4 | Messenger + Event | A draft in your voice (from how you actually text them) in the normal composer; sending it also creates an invite-only Event | the draft may cite only plan facts; Event prefilled; nothing sends without the tap | the words | edit, send |
| 5 | Their Messenger | A message from a friend, in her words, and an Event card with **I'm in** | nothing inferred about them is shown to them; no AI-authored words on this side | nothing | reply, tap |
| 6 | Plan / Event | who's in, cost live, **How this was planned** (every claim with its source) | status from real taps; owner confirms last, only after a yes | only on request | confirm |
| 7 | Friends → Reconnect | the drift list in four kinds: a person, a chapter (a crew whose ask died), your culture (a group's event friends are going to), a place (a city with quiet friends and a ride) | all of it | nothing | come back on purpose |

No chat box anywhere. The model speaks in three places, each behind a code check, and you never type a question to it.

## What is code and what is model

**Drift** (`src/lib/reconnect/drift.ts`, no model): a real contact is a two-way chat (both people sent within 48 hours, in a DM or a group chat they share), an event both went to, or a photo both are tagged in. Likes and reactions never count. *Rhythm* is the median gap between real-contact days over the last 180 days, clamped 7–120, default 30. *State* is days since the last real contact over rhythm: awake under 1, sleepy to 1.5, napping past it. Crews come from group chats (with the original "who's in" line surfaced as the ask that died) and shared friend labels; places are cities with 2+ friends; culture is a group with culture-ish tags that has an upcoming event friends are going to.

**Shared evidence** (`evidence.ts`, no model): tagged photos and posts with both of you in them, events you both went to, the friend's own lines from two-way exchanges in chats you're in, and facts of the friendship (how you know each other, same hometown or school). Nothing from anyone else's chats. This is the only thing the why-now may cite.

**Why now** (`whynow.ts`, Muse Spark): one line (≤22 words asked, ≤30 enforced) and 1–3 evidence ids. Code drops the nudge if a cited id isn't in the index or is only the trigger, or if the line contains a mood/health/guilt word (`BANNED`). Dropped nudges are stored with their reason and shown as a reason, never as text. One unprompted nudge per person per day, friends only, only when the friendship is sleepy/napping or the pick is mutual.

**The plan** (`plan.ts`, Muse Spark + Ember): `get_context` → `infer_availability` (the travel branch's: RSVPs, visible posts, your own chats with that person, quotes verified) → `estimate_cost` → `propose_plans`, 7 steps max. Validation re-checks every person (visible to you), date (future, ≤7 days), event and ride id; attaches a friend's ride when one exists; makes the host a target who lives there; recomputes cost from the seeded price table (visit = travel pricing, in-town hangout = a seeded $28 line, call = $0, event = its ticket); strips any dollar figure the model wrote; and attaches each person's availability with quotes as sources. An RSVP to the plan's own event marks that day likely free.

**The words** (`send.ts`, Muse Spark): a draft from up to eight of your own recent messages (to that person first). Sending is your tap in Messenger; it creates the Event and notifies the people in it. Invitees see the plan without your private sources.

## Evaluations (`EVAL-RECONNECT.md`)

Live, seeded, re-runnable with `npm run eval:reconnect` (needs the dev server):

1. **Why-now grounding** over drifted pairs with shared history: nudges shown vs dropped by code (with reasons), shown lines whose every citation is real and includes both people, banned words on anything shown.
2. **Plan grounding** over several targets: every person/event/ride id in a rendered plan exists and is visible; per-person cost equals the sum of its code-computed lines; model-written dollars in the words.
3. **Reactivation**, code only, over all ~60 people in the seed: friendships asleep, with history a nudge can cite, with a fresh post to hang one on.

The travel branch's `EVAL.md` (grounding, budget, cost comparison) and `EVAL-OPENDOOR.md` (privacy probes, policy compliance) still describe the machinery underneath. Tests: `npm test` (30, code paths only). QA of the full two-person path: `npm run qa:reconnect` (28 checks).

## What is real / seeded / simulated

- **Real:** every Muse call (why-now, the plan agent and its availability tool, the draft), the code checks, the two-window flow, the Inspector at `/dev/ai` with every prompt, step, token and cost.
- **Seeded:** the people, chats, posts, events, rides and the price table. For this feature specifically: old tagged photos and two past events as shared history (`src/data/reconnect.ts`), Nadia's "first lakefront run" post as today's trigger, one culture group with a past and an upcoming event, the Maya↔Nadia thread dated 7 weeks back, and three private picks (Nadia→Maya, Cole→Maya, Harper→Cole) so the mutual moment can happen on stage. Seed data, not model answers.
- **Simulated:** when the trigger fires. In a product it would run when the friend posts; here the daily nudge is computed on the viewer's first load of the day and lands as a notification then. Message delivery stays inside the clone.

## Fallbacks (labelled, never mistaken for live)

**LIVE · Muse** real calls · **Cached** identical request served from `.ai-cache/` at $0 · **Mock** no key or budget guard: a code-written nudge/plan/draft marked `(mock)` · the travel paths keep their **Replay** mode. `npm run reset` restores the seed and clears picks, nudges and plans.

## Run it

```
cp .env.example .env.local     # add MODEL_API_KEY
npm install && npm run dev     # http://localhost:3000/?as=maya
```

Two windows: `/?as=maya` and `/notifications?as=nadia`. Click path in `pitch/runbook.md`. Budget: one client, a file-locked ledger with a 1.5× margin, hard stop at `MODEL_BUDGET_USD`.

## Repo map

```
src/lib/reconnect/     drift, evidence, whynow, plan, send, store
src/lib/travel/        availability, pricing, tools, validate, visibility, agent, negotiate, … (the machinery underneath)
src/lib/ai/            the one Muse client: index.ts, ledger.ts, cache.ts, trace.ts, mock.ts
src/app/api/reconnect/ drift · miss · whynow · nudge · plan (SSE) · plans, plans/[id]
src/app/(app)/         reconnect (list, [id], plan/[id]), feed strip, messages (plan chip + draft), notifications, friends, menu
src/components/reconnect/  ui (StatePill, MissButton, Evidence*, PlanCard, PlanChip, SayHi), WhyNowStrip
src/data/reconnect.ts  shared-history posts, past events, trigger posts, culture group, seeded picks
scripts/               eval-reconnect, qa-reconnect (+ the travel scripts)
tests/                 reconnect.test.ts, travel.test.ts, opendoor.test.ts, ledger.test.mjs
pitch/                 runbook.md, script.md, submission.md, demo.mp4 (built by scripts/build-demo-video.py), shots-reconnect/ (+ the travel deck and scripts as *-travel.md)
EVAL-RECONNECT.md · EVAL.md · EVAL-OPENDOOR.md · DECISIONS.md · PROGRESS.md · README-travel.md
```

## The clone underneath

Feed, Reels, Profile, Friends, Groups, Events, Marketplace, Messenger (live between two windows), Dating, Gaming, Notifications, Search, Saved, Menu, Switch account, the AI Inspector at `/dev/ai`, and the Trips feature from the `travel` branch (Discover, guides, Open Door) still reachable from the menu. Branding is a text wordmark and generic icons only.

## Chat Games (branch `games`)

A separate feature on the same clone; it touches Reconnect nowhere. Every group chat and DM gets one short game a day, written by Muse from that chat's own material. How the chat plays becomes a chat interaction score, and when the score crosses a threshold the chat is handed one real Group, Event or Marketplace listing on the topic it keeps choosing. Same rule as the rest of the repo: code picks the topic, the format, the sources, the scores and the recommendation; Muse writes the game and the one line on the unlock card; code checks every id, quote and number before anything is shown.

**Six formats.** A game is a format × a topic × this chat's own messages, posts and interests (only what every member can already see; nothing crosses from one chat to another).

| Format | What the chat does | What it measures |
|---|---|---|
| Split | Pick a side of a dilemma from the chat's topics, then predict how the chat splits | Topic preference; how well members read each other |
| Receipts | Real lines from the chat and members' posts: who said it? | Attention to each other |
| Lineup | Rank the members on a positive prompt (3+ people) | Peer perception; consensus |
| Blend | Build one thing together, one slot each | Concrete picks that map onto event and listing categories |
| Hot Seat | Answer questions about one member; they get the final say (3+ people) | Closeness; the subject's own preferences |
| Wager | Spread 10 points over three real upcoming events, groups or listings | A direct ranking of real inventory |

**How scores work** (all in `src/lib/play/score.ts`, no model). Every tap is a play event. Per member and game, engagement is 0–1 (finished, how soon, how fully, reacted or replied after). Per member and topic, affinity is a taste prior plus engagement × what they picked or passed over, with a 14-day half-life. A chat's topic score is mean affinity × coverage × agreement, so one loud member doesn't decide it. The chat interaction score is 0–100 over 14 days: 40% participation, 20% streak (days a majority played), 20% reactions and replies, 20% how settled the top topics are. Being right in a game never feeds recommendations. Unlocks: a Group at 40, an Event at 60, a Marketplace pick at 75, each only on a topic the chat has settled or put Wager points on, one card a day per chat. "I'm in" on the card is a real RSVP / join / save and is written back as that member's signal. A member sees the chat's totals and their own topic numbers, never anyone else's; any member can mute games for a chat.

**Run and demo.**

```
npm run dev                         # AI_MODE=mock npm run dev spends nothing: template games, labelled Mock
# two windows: /messages/c_volleyball?as=jordan and /messages/c_volleyball?as=sam   (maya is not in that chat)
QA_KEEP=1 npm run qa:play           # resets, plays today's game as six of its eight members, leaves the result up
```

Today's game arrives as a card in the thread on the first load of the day (one model call per chat per day). The seeded chat sits at 58; it takes five of eight finishing to pass 60, at which point the Event card appears in the thread. `/dev/play` is the inspector: score parts, topic table, what code refused from the draft, the ranked candidates, and buttons to drop a game in any format. `npm run qa:play` runs 57 end-to-end checks and resets when it is done; `npm run eval:play` writes `EVAL-PLAY.md` (the copy in the repo is a mock dry run; a live run makes 8 to 14 model calls at the default cap of six games). Code: `src/lib/play/`, `src/app/api/play/`, `src/components/play/`, seed history in `src/data/play.ts`, tests in `tests/play.test.ts`.
