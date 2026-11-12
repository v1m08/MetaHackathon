# facebook (young adults hackathon base)

A high-fidelity, mobile-first Facebook clone to build an AI feature on top of. Every major surface exists, is seeded with lived-in data about a friend group of young adults in Austin, and reads/writes one shared in-memory store. One AI layer wraps Meta's Muse models (OpenAI-compatible Model API) with text, structured output, images and tool calling, plus a mock mode that works with no key or network. An Inspector shows judges every prompt, output and latency.

```bash
npm install
cp .env.example .env     # optional; leave MODEL_API_KEY empty for mock mode
npm run dev              # http://localhost:3000
```

> **Hang Again** (the reconnect prototype on the `reconnect-prototype` branch) lives at **Friends → Hangout** (`/friends/hangout`), with demo controls at `/demo`. See [Hang Again](#hang-again-reconnect-prototype) below.

## What's here

| Surface | Route | Notes |
|---|---|---|
| Feed | `/` | Stories, composer, posts with reactions (hold Like for the picker), comments & replies |
| Reels | `/reels` | Full-screen snap scroll, double-tap to like, save |
| Profile | `/profile/:id` | Cover, about, friends grid, posts/photos/reels tabs, friend requests |
| Friends | `/friends` | Requests, suggestions with mutuals, friends grid |
| Groups | `/groups`, `/groups/:id` | 6 groups with 15–20 post histories each; join, post, **AI "Catch me up"** |
| Events | `/events`, `/events/:id` | RSVP, guests, discussion posts |
| Marketplace | `/marketplace`, `/marketplace/:id`, `/marketplace/new` | Categories, search, save, message seller (creates a real chat), **AI "Draft listing"** |
| Messenger | `/messages`, `/messages/:id` | Live between two windows (1.5s polling), group chats, listing attachments, read receipts |
| Dating | `/dating` | Card stack with prompts, like/pass, matches, "It's a match" screen |
| Gaming | `/gaming`, `/gaming/:id` | Two playable mini games (Tap Dash, Word Rush) with live friends leaderboards |
| Notifications | `/notifications` | Derived from real seed content, unread badges |
| Search | `/search` | People, groups, events, listings, posts |
| Saved, Menu, Switch account | `/saved`, `/menu`, `/switch` | |
| **AI Inspector** | `/dev/ai` | Every model call: prompt, output, tool steps, latency, tokens, mode. Playground for each capability. |

Branding is a text wordmark and generic Lucide icons only.

## Architecture

```
src/
  types.ts                 Domain types (User, Post, Group, FBEvent, Listing, Reel, Conversation, …)
  data/                    Seed: users.ts (16 people, friend graph), groupPosts.ts, feedPosts.ts,
                           events.ts, listings.ts, reels.ts, conversations.ts, dating.ts, games.ts
                           index.ts builds the Database (+ derives notifications)
  server/
    db.ts                  In-memory store + all mutations (react, comment, post, RSVP, send message, swipe…)
    http.ts                route() wrapper: acting user, params, JSON body, error → JSON
  app/api/**               Thin Next.js route handlers over server/db.ts (37 routes)
  lib/
    session.ts             Per-tab identity (who am I) — see "Demoing as different users"
    api.ts                 fetch wrapper (adds x-user-id) + useApi() SWR hook with polling
    ai/                    THE AI LAYER (below)
  components/
    Shell.tsx              Phone frame, top bar, tab bar, demo strip
    Post.tsx               PostCard, reactions, comments sheet
    Composer.tsx           Composer card + full composer screen (with AI "Help me write")
    ui.tsx                 Avatar, Button, Sheet, Pill, skeletons…
  app/(app)/**             One folder per surface, all client components rendered inside the phone frame
  app/dev/ai/              The Inspector (outside the frame)
```

**Data flow.** Pages call `useApi("/api/…")`. Route handlers call functions in `server/db.ts`. The store is a plain object on `globalThis`, seeded from `src/data` at boot. It survives hot reloads and resets on server restart (or `POST /api/admin/reset`). Timestamps in the seed are relative to boot, so the data always looks like it happened this week.

**Why in-memory.** Zero setup, instant resets between demo runs, and the AI tools can read the exact same objects the UI renders. If you need persistence later, `db()` is the single place to swap in SQLite or a JSON file.

**Phone frame.** On screens ≥768px the app renders inside a 390×844 phone on a dark stage (good on a projector). On real phones it is full-bleed. `?frame=0` turns the frame off (remembered in localStorage).

## Demoing as different users

Identity lives per browser tab (sessionStorage), not in a cookie, so two windows can be two people:

- Menu → **Switch account**, or the status strip under the phone.
- Open a second window at `http://localhost:3000/?as=jordan` (any user id from `src/data/users.ts`: `maya`, `jordan`, `priya`, `devon`, `sofia`, `ethan`, `aisha`, `lucas`, `hannah`, `marcus`, `zoe`, `tyler`, `nina`, `sam`, `omar`, `grace`). The ↗ button on the Switch screen does this for you.
- Open the same conversation in both windows (e.g. Maya ↔ Jordan planning the taco pop-up); messages appear on the other side within ~1.5s. Feed, groups, notifications and leaderboards also poll.

All API calls carry `x-user-id`; the server trusts it (this is a demo, there is no auth).

## The AI layer (`src/lib/ai`)

Server-only. Import `ai` and never call the Model API directly, so every call is traced and mock-able.

```ts
import { ai } from "@/lib/ai";

// Plain text
const { text } = await ai.text("Write a one-line caption for a pottery photo", { task: "caption", userId });

// Structured output (JSON Schema in, typed object out; retries once on invalid JSON)
const { data } = await ai.json<{ title: string; tags: string[] }>(prompt, {
  task: "listing.tags", userId,
  schema: { type: "object", properties: { title: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["title", "tags"] },
});

// Image
const { url } = await ai.image("flyer for a backyard taco pop-up, warm evening light", { task: "flyer", size: "1024x1024" });

// Tool calling (server-side tools over the store; loop runs until the model answers)
import { allTools } from "@/lib/ai/tools";
const { text: answer, steps } = await ai.tools("What's happening with my friends this weekend?", { task: "weekend", userId, tools: allTools });
```

- `task` is the label shown in the Inspector. Name them `feature.step`.
- Tools live in `src/lib/ai/tools.ts` (`get_feed`, `get_group_posts`, `get_user_profile`, `search`, `get_upcoming_events`, `get_recent_messages`). A tool is `{ name, description, parameters (JSON Schema), run(args, { userId }) }`. Add yours there.
- Transport is raw `fetch` against `/chat/completions` and `/images/generations`, so there is no SDK version to fight. Structured output tries `response_format: json_schema`, falls back to `json_object`, then to prompt-only parsing.
- `SYSTEM_BASE` in `src/lib/ai/index.ts` sets the house voice. Override per call with `system`.

### Real vs mock

| | Live | Mock |
|---|---|---|
| When | `MODEL_API_KEY` set (or `AI_MODE=live`) | No key, or `AI_MODE=mock`, or `mode: "mock"` on one call |
| Text | Muse | Canned per-task lines for the built-in features; generic echo otherwise |
| JSON | Muse + schema | A schema-valid object synthesized from the JSON Schema (uses `description`/`enum`) |
| Image | Muse image model | Deterministic placeholder photo |
| Tools | Real loop | Calls the first tool with schema-derived args, then stubs the answer. Tool `run()` is real. |
| Latency | Real | 250–700ms so loading states are visible |

Env (`.env.example`):

```
MODEL_API_KEY=            # from the hackathon
MODEL_API_BASE_URL=https://api.meta.ai/v1
MODEL_TEXT=muse-spark     # placeholder: open /dev/ai → "List models" to see the IDs your key can use, then set these
MODEL_IMAGE=muse-image
AI_MODE=auto              # auto | live | mock
```

The model IDs above are placeholders. The Inspector's **List models** button calls `GET /v1/models` with your key so you can copy the real ones into `.env`.

### Built-in example features (copy these)

All in `src/lib/ai/features/index.ts`, each wired to a UI control and an API route:

1. **Composer → ✨ AI** (`compose.ideas` / `compose.rewrite`): structured output, grounded in the user's bio and what friends posted. `POST /api/ai/compose`.
2. **Group → Catch me up** (`digest.research` then `digest.write`): a tool-calling step that fetches posts and the viewer's profile, then a structured digest personalized to the viewer. `POST /api/ai/digest`.
3. **Marketplace → Draft listing** (`listing.draft`): structured output with an enum category. `POST /api/ai/listing`.
4. **Inspector playground** (`playground.*`): one button per capability.

## Where a new feature plugs in

1. **Data it needs**: add fields to `src/types.ts`, seed them in `src/data/*.ts`, expose a query/mutation in `src/server/db.ts`.
2. **AI**: write a function in `src/lib/ai/features/` that gathers context from `server/db.ts` and calls `ai.text/json/image/tools` with a `task` label. If the model should look things up itself, add a `ToolDef` to `src/lib/ai/tools.ts`.
3. **API**: add `src/app/api/<feature>/route.ts` using `route()` from `server/http.ts` (it gives you `userId`, `params`, `body()`).
4. **UI**: pick the surface. Common entry points:
   - A button in `PostCard` (`components/Post.tsx`) or the post header menu
   - A card between posts in `app/(app)/page.tsx` (feed injection)
   - A button next to "Catch me up" in `app/(app)/groups/[id]/page.tsx`
   - The Reels overlay in `app/(app)/reels/page.tsx`
   - Composer panels in `components/Composer.tsx`
   - The Messenger input bar in `app/(app)/messages/[id]/page.tsx`
   - Event detail actions in `app/(app)/events/[id]/page.tsx`
   - Dating card in `app/(app)/dating/page.tsx`
   - Marketplace detail in `app/(app)/marketplace/[id]/page.tsx`
   Use `useApi()` to read, `api()` to mutate, `refresh("/api/prefix")` to revalidate.
5. **Show the judges**: your calls appear in `/dev/ai` automatically with prompt, output, steps and latency. Link to it from your UI like the digest sheet does.

## The seed (what the AI can mine)

Sixteen people, 20–26, Austin, TX, with a dense friend graph: Maya (designer, runs the run club), Jordan (line cook about to launch a taco pop-up), Priya (CS senior who just signed a lease after a 19-day hunt), Devon (ER night nurse, volleyball), Sofia (band Porch Lights, show Friday), Ethan (SWE, bouldering), Aisha (MPH student organizing a health fair), Lucas (French barista, film photos), Hannah (first-year teacher), Marcus (trainer, reels creator), Zoe (sophomore, thrift flips, Valorant), Tyler (real estate, pickleball), Nina (nursing student, 61 plants), Sam (bartender/DJ), Omar (PhD, cyclist), Grace (new grad in marketing).

Storylines cross surfaces on purpose: Jordan's pop-up is a feed post, a group post in Cheap Eats, an event, a DM thread with Maya, a group-chat topic, a reel and a listing (he's selling his bike for the truck fund). Priya's apartment hunt runs through 18 posts in the apartments group, her DMs with Aisha, and a listing for her textbooks. Use these threads to show an AI feature connecting dots across the app.

- 6 groups, ~85 group posts with comments and replies
- ~30 personal feed posts, 10 stories
- 10 events (one past), 16 listings, 14 reels
- 12 conversations (3 group chats), 11 dating profiles, 6 games
- Notifications and friend requests derived from the above

## Reliability notes for the live demo

- Images are placeholder photos (picsum / pravatar) served through `/api/img`, a caching proxy. Run `npm run warm` once with the server up and all 160+ seed images are cached in `.image-cache/`, so the demo works with no internet. Avatars fall back to initials and photos to gradients if anything is missing.
- `npm run reset` (or `POST /api/admin/reset`) restores the seed without a restart.
- Polling intervals: feed 8s, messages 1.5s, notifications 5s, games 4s. Tweak in each page's `useApi(..., { poll })`.
- `npm run typecheck` and `npm run build` both pass; use `npm run build && npm start` for the demo machine so there are no dev-server compile pauses.

## Scripts

```
npm run dev        # Turbopack dev server
npm run build      # production build
npm start          # serve the build
npm run typecheck  # tsc --noEmit
npm run warm       # cache every seed image locally (server must be running)
npm run reset      # restore the seed data (server must be running)
```

## Hang Again (reconnect prototype)

Hang Again helps young adults keep friendships alive after "we should hang out sometime." It's a prototype on seeded mock data: no real Facebook APIs, no scraping, no real chats. Muse models power the AI, but only on the server.

1. **See again.** After an Event or Group meetup you privately pick who you'd want to see again. Only mutual picks are revealed, and each match puts an egg in your Hangout. The egg hatches after your first two-way chat.
2. **Why you, why now.** When a friend posts, shares a Reel or has a life update, Muse links it to your shared past (tagged photos, places, inside jokes) and suggests one small move. You always write your own message.
3. **The Hangout.** One critter per close friend, hosted by a (placeholder) Muse sprite. Critters get sleepy when you drift and wake up when you reconnect. They never get sick or die. A toggle swaps critters for plants with the same states.

### Setup

```bash
npm install
cp .env.example .env.local   # add your key + model IDs (optional: everything works in cached mode)
npm run dev                  # http://localhost:3000/friends/hangout  ·  demo controls: /demo
```

| Env var | What it does |
|---|---|
| `META_MODEL_API_KEY` | Meta Model API key. Empty → Hang Again runs in **cached** mode. (Alias of the base app's `MODEL_API_KEY`.) |
| `META_MODEL_BASE_URL` | OpenAI-compatible base URL, default `https://api.meta.ai/v1`. (Alias of `MODEL_API_BASE_URL`.) |
| `MUSE_EMBER_MODEL` | Model ID for the high-volume memory builder. Placeholder `muse-ember`. Check the Model API docs or `/dev/ai` → List models. |
| `MUSE_WONDER_MODEL` | Model ID for why-now, critter designer, plan proposer and keepsake picker. Placeholder `muse-wonder`. |
| `DEMO_DATE` | Demo "today", default `2026-11-14`. Also settable at runtime from `/demo`. |
| `HANGOUT_AI_MODE` | `live` or `cached` at boot. Defaults to live when a key is set. Flip any time from `/demo`. |

Keys stay in `.env.local` (git-ignored) and are only read by server code; the browser never sees them.

### Scripts

```
npm test                         # unit tests: sleep math, guardrails, evidence checks
npm run eval:moments             # all friend moments through why-now (C) + guardrails (D), prints pass/fail
npm run eval:moments -- --cached # same, replaying cached responses (checks the code, not the model)
npm run memory:rebuild           # rebuild every memory file (Ember) + critter design (Wonder) → data/hangout/memory.json
npm run seed:images              # regenerate placeholder images in public/seed
npm run hangout:reset            # reset the Hang Again demo state (server must be running)
```

`eval:moments` and `memory:rebuild` run live when a key is set (`--live` / `--cached` to force). The eval target is at least 4 of the first 5 moments correct before demoing live. The eval also injects a fake evidence ID to prove the code check rejects it.

### Running the demo

Open `/demo` on the presenter laptop. It shows the controls, a live phone and the debug drawer side by side. The phone also works on its own at `/friends/hangout`.

1. **Hangout.** Maya, Jess and Chris are napping, Dev is sleepy, Priya is awake and Alex is in the hammock. Tap a critter for shared places, keepsakes and the last real chat.
2. **Maya posts from Ramen Ya** (the live Wonder call). A push banner lands, and the sheet shows the reason, the old photo, "Why this?" with the cited evidence, and one action. Tap *Send Maya this photo*, write your own words, and send.
3. **Maya replies** → her critter wakes up. Tap *Suggest a plan*. Muse checks both calendars and drafts a plan only you can see. *Share in chat*, tap both *Yes* buttons, then *We met up*. The critter celebrates and earns the chopsticks pin.
4. **See again.** Tap the Saturday Run Club card and pick Sam. **Sam mutual pick** → reveal + egg. Message Sam, then **Sam replies** → the egg hatches and Muse designs Sam's critter.
5. Show the filters: **Priya** and **Chris** (Muse says no), **Alex** (resting) and **Jordan** (blocked, never reaches the model). There's one nudge per day, so press **+1d** or *Clear today's nudges* between moments.
6. Time travel with **+3d / +7d** to watch celebrating fade and critters drift. Flip **Plants** to compare themes.

**Live vs cached.** Cached mode replays saved responses, so the demo works if the API or wifi fails. In live mode a failed call also falls back to the cache, and the debug drawer says so (`live→cached`). Every live response that passes its checks is saved to `data/hangout/recorded.json`; anything not recorded yet falls back to the hand-written fixtures in `src/server/hangout/fixtures.ts`. After a good live rehearsal (or `npm run eval:moments` + `npm run memory:rebuild` with a key), commit `data/hangout/*.json` so the demo machine replays that run.

### How it works

```
src/data/hangout/seed.ts        Cast (you + 8 friends), photos, gatherings, opted-in chats, reactions, calendars, places
src/data/hangout/scenarios.ts   The friend moments + what the eval expects
src/lib/hangout/                Pure, shared: types, parts library, zod schemas, sleep math, guardrails, evidence checks (+ tests)
src/server/hangout/muse.ts      Muse calls on the shared AI layer: model routing, zod validation, retry once, fail safe, cache/record
src/server/hangout/pipeline.ts  A memory builder · C why-now · D guardrails · E critter designer · F plan proposer · G keepsake picker
src/server/hangout/store.ts     In-memory demo state (like server/db.ts) + memory files from data/hangout/memory.json
src/server/hangout/actions.ts   Chat, replies, See again, plans, meetups, resting
src/app/api/hangout/**          Thin routes · src/app/(app)/friends/hangout/** screens · src/app/demo demo controls
```

- **A · Memory builder (Ember)** extracts shared places and inside jokes, citing IDs. Code keeps only IDs that exist and include both people, then recomputes counts and dates from them.
- **B · Sleep math (code)**: rhythm = median gap between two-way chats and meetups, clamped 7–120 (default 30 with fewer than 3). Ratio = days since last real contact / rhythm: under 1 awake, 1–1.5 sleepy, over 1.5 napping. Celebrating for 3 days after a meetup; resting never changes. A two-way chat means both sent a message within 48 hours. Likes and reactions never count. The timeline is computed in code from this rule rather than by the model.
- **C · Why-now (Wonder)** gets the new post/Reel, the memory file and the candidate evidence with IDs. Every cited ID must exist and include both people, or the nudge is discarded.
- **D · Guardrails (code)** run **before** C (blocked, unfriended, resting and outside-circle friends are never sent to the model) and **after** it (status again, max one nudge per day, no mood or health words).
- **E · Critter designer, F · Plan proposer, G · Keepsake picker (Wonder)** pick from fixed libraries. The plan's slot must be free for both people: one retry, then the first mutual free slot. Cost always comes from the places table.
- Every model response is validated with zod: retry once, then fail safe (no nudge). Every call also shows up in the AI Inspector at `/dev/ai`.

**Swapping in real people.** Edit names in `src/data/hangout/seed.ts` and drop photos your friends agreed to share into `public/seed/photos` and `public/seed/avatars` (same filenames, or point `imagePath` at a `.jpg`). Critter parts live in `src/lib/hangout/parts.ts` and render in `src/components/hangout/Critter.tsx`; preview them all at `/demo/parts`. The Muse host in `src/components/hangout/MuseHost.tsx` is a placeholder. Drop in official assets if the hackathon provides them.
