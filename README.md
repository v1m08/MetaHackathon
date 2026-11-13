# facebook (young adults hackathon base)

A high-fidelity, mobile-first Facebook clone to build an AI feature on top of. Every major surface exists, is seeded with lived-in data about a friend group of young adults in Austin, and reads/writes one shared in-memory store. One AI layer wraps Meta's Muse models (OpenAI-compatible Model API) with text, structured output, images and tool calling, plus a mock mode that works with no key or network. An Inspector shows judges every prompt, output and latency.

```bash
npm install
cp .env.example .env     # optional; leave MODEL_API_KEY empty for mock mode
npm run dev              # http://localhost:3000
```

## Run it on your iPhone

The app is mobile-first and renders full-bleed on a real phone (the desktop phone frame only appears at tablet widths and up).

```bash
npm run dev:phone        # same as dev, but listens on the LAN (0.0.0.0:3000)
```

1. Put the phone on the same Wi-Fi as the Mac (or tether the Mac to the phone's hotspot if the venue Wi-Fi isolates clients).
2. Find the Mac's address: `ipconfig getifaddr en0`.
3. Open `http://<that-ip>:3000` in Safari on the phone.
4. Share → **Add to Home Screen**, then launch from the icon. It opens standalone with no browser chrome, so it looks like the real app.

For a smoother demo use the production build: `npm run build && npm run start:phone`.

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
npm run sidequest  # start the Sidequest game server (:5180) for Deep Cuts & Order Up!
npm run demo:events # set up the volleyball chat's Event unlock (see "Event unlock popup")
npm test           # Sidequest Context Engine + Event unlock popup tests
```

## Sidequest Games + Context & Closeness Engine

Young adults stay connected in Messenger through two GamePigeon-style pixel games powered by Muse (**Deep Cuts** and **Order Up!** in `sidequest/`), while the **Context Engine** (`src/lib/context/`) turns those playful sessions into a privacy-safe **Taste + Relationship Closeness Graph** that personalizes **Events**, **Groups**, and **Marketplace**.

### End-to-End Demo Loop
1. **Smart In-Tray Suggestions (`/api/context/tray` → `src/components/ChatGames.tsx`):**
   - Tapping **`+`** in any Messenger chat shows **"Picked for this chat"** topic chips computed from the strict visibility intersection of chat members (shared Groups, co-attended Events, visible posts/interests) plus unexplored local Austin categories (`blindSpotTopicsFor`).
2. **Play Deep Cuts or Order Up! (`sidequest/`, `:5180`):**
   - Muse generates a themed pixel world (**Deep Cuts**) or 75-second restaurant (**Order Up!**) for any topic; cards (`sqgame`) and GamePigeon completion lines (`sqgamelog`) post live in the thread.
3. **Context, Streak & Connection-Scoring Engine (`src/lib/context/index.ts`, `src/lib/context/day.ts`, `/dev/context`):**
   - Ingests `sqgame` / `sqgamelog` messages + Sidequest room caches (`sidequest/.cache/{rarity,kitchen}/*.json`) with zero legacy quiz dependencies.
   - **Austin-timezone (`America/Chicago`) Snapchat-style streaks:** counts days where a strict majority played before local midnight, with **1 automatic streak freeze per 7 days**, **3 / 7 / 14 / 30-day milestones**, and an **evening hourglass** after 6pm.
   - **Anti-hijack group agreement (`mean × coverage × (1 − SD)`):** discounts 1 loud spammer in a group chat until $\ge 50\%$ of members play on a topic.
   - **8-signal `0–100` Connection Score & Commitment Thresholds** (`connectionScoreFor`, weights in `SCORE_WEIGHTS`), gating tiers at **`40` (Group) → `60` (Event) → `75` (Marketplace)** once the chat has a settled topic:

     | Signal | Weight | What it measures |
     |---|---|---|
     | Turnout | 28% | Share of the chat that finishes each game (today's open game can lift it, never drag it) |
     | Streak | 16% | Days in a row a majority played, out of 7 |
     | Banter | 16% | Players who chat within 30 min of finishing, replay, or match answers in Deep Cuts |
     | Shared taste | 12% | How settled the chat is on a topic (`mean × coverage × (1 − SD)`, so one loud player can't set it) |
     | Momentum | 10% | Turnout in the last 3 days vs the days before: 0.5 steady, higher picking up, 0 if the chat stopped |
     | Balance | 7% | `1 − Gini` of finishes + banter across all members: is everyone in, or do two people carry it |
     | Cohesion | 6% | Share of member pairs who have finished the same game |
     | Tempo | 5% | Median time from a game being posted to each finish (30 min = full, 12 h = none) |

     It also returns **planning intent** (how much the chat's recent messages sound like making plans). That isn't part of the score: it tells Muse whether to upgrade a plan the chat already has or to make a first step easy.
   - Open **Menu → Context Inspector (`/dev/context`)** to inspect Before vs. After affinities, the 8-signal Connection Score & streak breakdown, and downstream rankings.
4. **Multi-Factor Ecosystem Ranking (`Events`, `Groups`, `Marketplace`):**
   - `socialMatchFor` combines **topic fit** + **threshold-gated shared-chat overlap** + **mutual friends going (`+0.05` each, cap `+0.15`)** + **event soonness (`+0.10` over 21 days)** + **saturation filtering** (omits `Send to X` when `X` is already RSVPed going) + **RSVP / Join / Save feedback loop** back into user affinity.

5. **Event unlock popup (`src/lib/events/forChat.ts`, `src/components/events/EventPicksSheet.tsx`):**
   - When you finish a game and close it, Muse slides up in the Hangout-card style with **one** upcoming event for the chat: **Send to chat**, **Going / Interested**, tap for details, or **Not now**.
   - **Benchmarks (all must pass):** you finished this game here · the chat has earned the **Event tier** (`connectionScoreFor().earnedTiers`: score ≥ 60 plus a settled topic) · at least one event fits ≥ `0.6` · once per game per person and one popup per person per chat per Austin day. The finish that earns the tier shows **"Events unlocked"**; after a member has seen it the unlock sticks, since the score can dip when a new game starts. The popup never shows the score itself (it lives in `/dev/context`).
   - **Fit:** the strongest of the **game's subject** (1.0 primary / 0.65 secondary), the **chat's settled topics** (`chatTopicsFor`, 0.8 at full agreement) and **interests every member lists** on their public profile (0.6; a group needs ≥ half), plus `+0.1` per extra agreeing source, friends going (`+0.05` each, cap `+0.15`) and soonness (`+0.10` over 21 days). Of the events that fit, the popup suggests the one **closest to everyone's profiles**: each member's best match across the event's topics (1 for its main topic, 0.65 for the others), averaged over the chat; ties go to the better fit. Past events, events you're going to or hosting, and events any member can't see are left out. If every other member is already going, Send is hidden and the why line names them.
   - **Try it:** `c_ethan_priya?as=ethan` → play Order Up!: Ramen → close. For the unlock moment: in `c_volleyball?as=sam` start Order Up!: Tacos, run `npm run demo:events`, then play it as Sam and close. `GET /api/conversations/<id>/event-picks?ref=<game>` explains why a popup didn't show.

## Judges demo: one group chat, a Muse ping, then group plans

Five judges each take a seat in one Messenger group chat, **Sunday cookout 🔥** (`c_judges`: Tyler, Jordan, Devon, Nina, Grace).

1. `npm run demo:public` → judges scan the QR code, open `/demo`, and each tap a different person. They land on their Facebook feed.
2. On `/admin`, tap **Drop** (default topic `tacos`, which opens instantly). Tyler posts today's Order Up! game in the chat, and Muse writes each judge a personal one-line nudge using their interests and jokes from the chat. It pops up on every judge's phone as a Facebook banner (`src/components/GameNudge.tsx`) and appears in Notifications. **Play now** opens the game in the chat.
3. A judge finishes and closes the game. The post-game sheet shows **Muse's ideas for the chat**: three plans written for this group. Each plan is a **kit** of real things on Facebook: optionally one upcoming Event plus up to three Marketplace listings, with the total and the per-person split.
   - **Try it together:** two or three homemade foods off Marketplace that are new to the chat (tamales, puff-puff, a man'oushe kit…) turned into a blind taste-off.
   - **Event plus:** a real Event with a listing or two that makes it better for this group (the taco pop-up plus a griddle and a hot-sauce flight).
   - **Wildcard:** an original plan, with or without listings.

   Every id Muse names is checked in code: a plan that names an event or listing that isn't a candidate is dropped, a listing is used in one plan only, and chat members' own listings, sold listings and private saves never enter the kits. **Make it an event** creates an invite-only Facebook Event for the chat (only the host and the invited can see it) with the kit attached: the event page shows **What to grab on Marketplace** with pickup spots and the split. Only the first tap announces it in the thread. The scored Groups/Events/Marketplace picks sit below under "Also on Facebook". A **See Muse's plans for this chat** button above the composer reopens the sheet any time after you've finished the newest game.

The chat is seeded with six days of food games that everyone played and trash-talked after, so its Connection Score starts at **86** (all tiers earned) and every judge's first finish gets the sheet; each Drop also clears the once-a-day cadence for the chat. The plans take one Muse call per chat per game, shared by everyone and warmed when the game drops; the nudges take one call per drop. Without Muse (no key, timeout, network), both fall back to templates built from the same real data, and the plans keep retrying Muse in the background. Marketplace has nine homemade-food and kitchen listings for this (`src/data/listings.ts`), with photos generated once by `scripts/gen-market-photos.ts` into `public/seed/market/`. Code: `src/lib/demo/drop.ts`, `src/lib/demo/museIdeas.ts`; tests: `tests/judge-demo.test.ts`. Reset between runs on `/admin`.

### Privacy Guardrails (Enforced in Code)
- **Strict Audience Intersection on Input:** Private Reel/Marketplace saves (`savedBy`), unshared private Groups, restricted (`friends`-only) profiles when non-friends are present, and other threads' messages are excluded from `GameTray` topic suggestions.
- **Zero Cross-Chat Signal Leakage on Output:** Friend/group match badges (`"Matches your games with X"`) only inspect Sidequest games **both users played inside a shared thread** — games a friend played in another chat never leak.
- **Event unlock popup:** uses only this chat's games and topics, public profile interests and attendee lists. Never another member's games from other chats or their learned affinity.
