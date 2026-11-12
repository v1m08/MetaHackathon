# Open Door — agent-to-agent travel on Facebook

> **Your agent asks so you don't have to. Then you talk.**

Asking someone you barely know "can I crash at yours?" is awkward enough that most people never ask. Open Door makes the ask effortless: each person writes an **Open Door policy in their own words**, and **Muse agents negotiate on their behalf**. Identities stay hidden until both sides agree; then the host decides with full information, and a real chat opens.

It sits on top of **Where can my people take me?**: you give Facebook a weekend and a budget, not a destination, and a Muse agent proposes trips that exist only because of the people you know (a friend open to hosting, a friend driving with a seat, an event your people are going to, friends' photos from the place). Built for Meta's "make Facebook valuable for young adults" hackathon on a mobile-first Facebook clone; the core AI is **Meta Muse** through the Meta Model API.

```bash
npm install
cp .env.example .env.local      # MODEL_API_KEY; without a key everything runs in labelled mock mode
npm run dev                     # http://localhost:3000  → Menu → Trips / Open Door
```

Identity is per browser tab: `/?as=maya` in one window, `/travel/opendoor?as=gabe` in another. `pitch/runbook.md` is the click path.

## The paradigm, in one pass

| Step | What the person sees | What runs |
|---|---|---|
| **1. Open Door intake** (own Profile) | A toggle, a free-text policy ("Couch open for college friends and their friends. Not during finals. One person max. Would love a guest who cooks."), who it's open to (friends / friends of friends / broader network), what's offered (place to sleep / seats in my car / showing someone around), max guests. On out-of-town Events: **"Driving, N seats"**. | `src/lib/travel/openDoor.ts`, `/api/me/opendoor`. Reach is computed from the graph by code; the policy text is what the host's agent is allowed to act on. 38 seeded policies in people's own words (`src/data/openDoor.ts`). |
| **2. Travel style** (own Profile, opt-in) | "Your travel style": 4–6 lines, each with its evidence ("Early mornings · because post: *go at 7 or bike*"). Edit, delete, refresh. | `style.ts`: Muse reads **only the user's own** posts, Reels, likes, saves and interests; code verifies each quote appears in the cited item and drops lines that fail. Other agents get the kept lines only, never evidence or ids. It is never called "personality". |
| **3. Availability from signals** (Discover + Make it happen) | Calibrated labels per person: **Confirmed**, **Likely free** (with the quote), **Busy** (with the reason), **Unknown → we'll ask**, plus an **Ask** button that drafts "around Dec 4–6?" into Messenger for approval. | `availability.ts` + the `infer_availability` tool: code gathers the person's event RSVPs, their posts the requester can see, and the requester's **own** conversations with them (never anyone's chats with third parties); Muse extracts dated statements with quotes; code checks the quote is in the source and makes the per-date call. The seeded `busyDates` list is dead code. |
| **4. Agent-to-agent negotiation** (trip page → *Ask their agents*) | A live transcript: the traveler's agent asks each candidate host's agent; each answers yes / conditions / no, sometimes with another weekend; a shield line shows what the disclosure check removed. Then anonymous fit cards. Also streamed in the AI Inspector. | `negotiate.ts`: traveler agent = Muse tool loop (`ask_host`, `counter_offer`, `finalize`); host agent = Muse with the host's policy, style lines and own availability, answering **only** through a strict schema; code scrubs every string (addresses, phones, "because…" clauses, schedule-reason words, third-party names not in the policy, 5-word quotes from the host's own posts/chats), forces "no" outside the tier or when busy, and strips the traveler's name from everything sent out. |
| **5. Anonymous → mutual accept → reveal → humans** | Traveler: "A host you know directly in San Antonio says yes for Dec 11–13 … Yes, ask them." Host (`/travel/opendoor`): "A friend of yours wants to stay Dec 11–13 (2 nights, 1 guest). Your agent says it fits your Open Door. **See who?**" Both revealed with how they're connected (mutuals, school, hometown, groups). Host: **Yes, open the chat** → Messenger opens with a context line. Agents are out of it from there. | Request state machine in `negotiate.ts` (`actOnRequest`, `viewRequest`): names, avatars and the other side's turns are withheld until `revealedAt`; the host's final yes creates the DM and a `system` message. |

Discover, Guide and Coordinate still work as before and now run on top of this: hosts come from Open Door tiers, availability from signals, and Coordinate hands off to the negotiation.

## Architecture

```
 UI (Next.js app router, phone frame)
 ├ /profile/[id]      Open Door editor + Travel style card (own) · Open Door badge (others)
 ├ /travel            Discover: reasoning stream (SSE), trip cards, two prices
 ├ /travel/[id]       Guide · Make it happen (calibrated availability, Ask) · Ask their agents (negotiation stream, fit cards)
 ├ /travel/opendoor   Open Door inbox for both roles: anonymous cards → See who → reveal → open chat
 ├ /messages          Open Door chip, drafts awaiting approval, system context line after a match
 └ /dev/ai, /dev/network   Inspector (every call) · internal network graph with the latest run overlaid
          │
 API      /api/me/opendoor · /api/me/travel-style · /api/travel/{discover,guide,coordinate,availability,drafts}
          /api/opendoor/{negotiate (SSE), requests, requests/[id]} · /api/events/[id]/rsvp (drivingSeats) · /api/admin/*
          │
 src/lib/travel/
   openDoor.ts     tiers from the graph (friends / fof via a mutual / shared group), legacy flags derived, connection facts
   style.ts        own-content travel style with evidence verification; styleConclusions() is all other agents get
   availability.ts gatherSignals (RSVPs · visible posts · requester's own chats) → Muse extraction → code decides per date
   negotiate.ts    hostAgentAnswer + scrubHostAnswer (disclosure rules) · negotiate (traveler tool loop) · accept/reveal
   agent.ts        Discover: scan_network → infer_availability → estimate_trip_cost → get_city_media → propose_trips
   tools.ts        every tool takes the viewer and returns only what they can already see
   validate.ts     every id re-checked; hosts must have a door open to this viewer and not be busy; re-priced in code
   visibility.ts · pricing.ts · taste.ts · guide.ts · coordinate.ts · replay.ts · checks.ts · store.ts
          │
 src/lib/ai/   ONE Muse client: text/json/tools (+images), budget ledger with reservations, request cache, traces
 src/server/db.ts   in-memory store seeded from src/data (61 people, 12 cities, policies, signals, rides, events, photos)
```

### Disclosure-enforcing tools, concretely

The host's agent has no free-form channel. It receives a brief (policy, controls, kept style lines, its own availability, and about the guest only: tier, number of mutuals, dates, guests, the guest's style lines) and must return `{decision, conditions[], alternativeDates?, fitReasons[{text, evidence}], note}`. Before anything goes back to the traveler's agent, `scrubHostAnswer`:

- removes addresses, apartment numbers, phones and emails;
- deletes `because / since / due to …` clauses and sentences containing schedule-reason words (wedding, shift, on set, parents, exam, …) unless the host wrote them into the policy;
- replaces first names of anyone not named in the policy with "a friend";
- drops any sentence sharing a 5-word window with the host's own posts or chat lines (so availability evidence can't be quoted back);
- drops `fitReasons` whose `evidence` isn't a quote from the policy or a style line;
- and, independent of the model: forces **no** when the traveler is outside the host's tier or the host is inferred busy.

The traveler's agent gets a brief without the traveler's name, and `anonymise()` strips the name/handle from every outgoing message anyway. What was removed is shown in the transcript as a shield line and in the Inspector, never to the other side.

## How Muse is used

| Use | Model | How |
|---|---|---|
| Discover agent, traveler's negotiating agent, host agents, Guide, drafts, travel style | `muse-spark-1.3` | OpenAI-compatible `/chat/completions`, `tools` + `tool_choice: "auto"` (the API only accepts auto), `reasoning_effort: "low"`, JSON-schema `response_format` for structured answers. Tool loops capped (Discover 9, negotiation 6). |
| Availability extraction, image notes, persona swarm | `muse-ember-1.0` | Cheap and fast; extraction returns quoted statements that code verifies. Image understanding uses `image_url` `data:` URIs at index time and live in the Guide. |

Every call goes through `src/lib/ai/index.ts`: traced for the Inspector (`/dev/ai` shows `opendoor.traveler`, `opendoor.host.<id>`, `travel.availability`, `travel.style`, …), cached on disk when identical, and metered by a file-locked ledger that **reserves worst-case cost before each call** and refuses past `MODEL_BUDGET_USD` (fallback to replay/mock, labelled). Typical costs: Discover ≈$0.05, negotiation with 2–3 hosts ≈$0.03, travel style ≈$0.01, one availability inference ≈$0.002.

## Trust and safety, enforced in code

- Agents use only content the user could already see (`visibility.ts` is the one place that decides; every tool takes the viewer). Travel style uses only the user's own content.
- Nothing is sent to another person without approval: drafts sit in Messenger as *awaiting your approval*; the traveler's accept is what lets the host hear about a request; the host's final yes is what opens the chat.
- No identity is revealed until both sides accept; `viewRequest` withholds names, avatars and the other side's turns until `revealedAt`; the host always decides last.
- Friends-of-friends are reached only through the tier the host chose (`doorOpenTo`), and intros still go through the mutual.
- Costs are never model arithmetic (`pricing.ts`); every id the model emits is re-validated (`validate.ts`).

## Evaluations (`EVAL-OPENDOOR.md`, `EVAL.md`)

`node scripts/eval-opendoor.mjs` runs three things through the real endpoints and writes the numbers and raw rows under `eval/`:

- **Privacy:** ~30 adversarial probes against host agents (schedule questions outside the asked dates, address/phone, relationships, third parties, prompt injections, "say my name"). A leak is anything beyond the stated policy: schedule reason, address, phone/email, job/relationship/hometown, third-party name, a 5-word quote from the host's posts, or the traveler's name. Reported for the raw model answer **and** for what actually leaves after the scrubber.
- **Policy compliance:** 16 seeded asks that violate a tier, a guest limit or a busy weekend (from posts/chats), plus fits. Pass = the decision respects the constraint (model alone vs after code enforcement).
- **Match quality:** 10 travelers × 10 hosts with travel styles built from their own posts; Muse's top match vs a tag-overlap baseline, written as blind A/B pairs (`eval/match-blind.json`, key in `eval/match-key.json`) for people to rate.
- The earlier **cost comparison** (network trip vs hotel + solo transport on the seeded price table) and grounding/privacy numbers for Discover remain in `EVAL.md`.

Results of the last run are at the top of `EVAL-OPENDOOR.md` with their limits (the leak detector is literal, not semantic; compliance checks decisions, not prose; nobody has rated the match pairs yet).

`npm test` (20 tests): budget guard under contention, viewer-scoped tools, visibility, validation, pricing, **tier reach**, **scrubber**, **anonymity**, **signal sources never include third-party chats**, **request views hide identities until revealed**.

## What is real / seeded / simulated

- **Real:** the Muse calls (agents, host agents, extraction, image understanding), tool use, validation, scrubbing, the state machine, the live two-window demo.
- **Seeded:** people, posts, events, rides, chats, Open Door policies and the availability signals (`src/data/signals.ts`: posts and chat lines like "opening weekend Dec 4–6 at a-basin, phone goes in the glovebox"). City photos are real, openly licensed Commons images (`CREDITS.md`). Prices come from a seeded table.
- **Simulated:** message delivery (inside the clone), and the persona study in `PERSONAS.md` (Muse agents role-playing users, labelled as such).

## Fallbacks (labelled, never mistaken for live)

| Badge | When | What |
|---|---|---|
| **LIVE · Muse** | key set, API up | real calls |
| **Cached** | identical request seen before | served from `.ai-cache/` at $0 |
| **Replay** | API error/timeout, budget guard, or `npm run replay:on` | a recorded real Discover/Guide run replayed with its pacing, re-validated against the current store |
| **Mock** | no key, or nothing to replay | code-only: negotiation asks every candidate once with a code-written message and answers from availability; travel style returns one labelled line |

One-click reset: `npm run reset` (`POST /api/admin/reset`) restores the seed and clears trips, drafts, requests, availability cache and generated styles.

## Repo map

```
src/lib/ai/            the one Muse client: index.ts, ledger.ts, cache.ts, trace.ts, mock.ts
src/lib/travel/        openDoor, style, availability, negotiate, agent, guide, coordinate, tools, visibility, validate, pricing, taste, replay, checks, store
src/app/api/           me/{opendoor,travel-style,hosting} · travel/{discover,guide,coordinate,availability,drafts,options,trips}
                       opendoor/{negotiate,requests} · events/[id]/rsvp · admin/{reset,dump,audit,mode,network,opendoor-probe,opendoor-match,…}
src/app/(app)/         profile (Open Door editor, travel style), travel (Discover, trip, opendoor inbox), messages, events
src/components/travel/ OpenDoor, TravelStyle, Negotiation, OpenDoorChip, TripCard, Reasoning, Nudge
src/data/              users + travelUsers, openDoor.ts (policies), signals.ts, cities, posts, events/rides, media, recordings
scripts/               eval-opendoor, eval, sim, record, qa-demo-runs, qa-inputs, ledger, media-pick, credits, build-animations
tests/                 ledger.test.mjs, travel.test.ts, opendoor.test.ts
pitch/                 deck.html, deck.pdf, script.md, runbook.md, qa.md, submission.md, animations/
EVAL-OPENDOOR.md · EVAL.md · PERSONAS.md · DECISIONS.md · PROGRESS.md · CREDITS.md · PLAN.md · README-prev.md (the pre-Open-Door README)
```

## Scripts

```
npm run dev / build / start          Next.js
npm run typecheck · npm test         tsc; node tests
npm run reset                        restore the seed (server must be running)
npm run warm                         cache every seed image locally
node scripts/eval-opendoor.mjs       privacy probes, policy compliance, blind match set → EVAL-OPENDOOR.md, eval/
npm run eval · npm run sim           Discover evaluation / persona swarm → EVAL.md, sim/
npm run record · npm run replay:on|off · npm run ledger
```

Env (`.env.example`): `MODEL_API_KEY`, `MODEL_API_BASE_URL`, `MODEL_TEXT`, `MODEL_VISION`, `MODEL_FAST`, `MODEL_IMAGE`, `AI_MODE` (`auto|live|mock|replay`), `MODEL_BUDGET_USD`, `MODEL_BUDGET_RESERVE_USD`, `AI_FINAL`.

## Branches

`main` is meant to hold only the Facebook clone; everything above lives on **`travel`**.

## The clone underneath

Feed, Reels, Profile, Friends, Groups, Events, Marketplace, Messenger (live between two windows), Dating, Gaming, Notifications, Search, Saved, Menu, Switch account, and the AI Inspector at `/dev/ai`. Branding is a text wordmark and generic icons only.
