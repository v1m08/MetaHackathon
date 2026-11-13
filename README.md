# facebook (young adults hackathon base)

A high-fidelity, mobile-first Facebook clone to build an AI feature on top of. Every major surface exists, is seeded with lived-in data about a friend group of young adults in Austin, and reads/writes one shared in-memory store. One AI layer wraps Meta's Muse models (OpenAI-compatible Model API) with text, structured output, images and tool calling, plus a mock mode that works with no key or network. An Inspector shows judges every prompt, output and latency.

```bash
npm install
cp .env.example .env     # optional; leave MODEL_API_KEY empty for mock mode
npm run dev              # http://localhost:3000
```

> **Demo branch (`demo-stage`).** This branch puts the pieces together: the daily AI Chat Games, the Hangout streaks screen, the four Sidequest games and the context engine. To run the demo, follow [DEMO-RUNBOOK.md](DEMO-RUNBOOK.md); what went in, what was cut and what is still missing is in [DEMO-PLAN.md](DEMO-PLAN.md). The app opens on Messenger; the Facebook feed is at `/feed`.

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
| Feed | `/feed` | Stories, composer, posts with reactions (hold Like for the picker), comments & replies |
| Reels | `/reels` | Full-screen snap scroll, double-tap to like, save |
| Profile | `/profile/:id` | Cover, about, friends grid, posts/photos/reels tabs, friend requests |
| Friends | `/friends` | Requests, suggestions with mutuals, friends grid |
| Groups | `/groups`, `/groups/:id` | 6 groups with 15–20 post histories each; join, post, **AI "Catch me up"** |
| Events | `/events`, `/events/:id` | RSVP, guests, discussion posts |
| Marketplace | `/marketplace`, `/marketplace/:id`, `/marketplace/new` | Categories, search, save, message seller (creates a real chat), **AI "Draft listing"** |
| Messenger | `/`, `/messages`, `/messages/:id` | The start page. Live between two windows (1.5s polling), group chats, listing attachments, read receipts. Today's game, the chat score bar, unlock cards and the Sidequest tray live in the thread. |
| Hangout | `/streaks`, `/streaks/:friendId` | One critter per friend, kept awake by playing each day's game together |
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
npm run sidequest  # start the Sidequest game server (:5180): Deep Cuts, Order Up!, Ghost Run, Sketch Off
npm test           # unit tests: Chat Games, Sidequest context engine, streaks, the glue between them (67)
npm run qa:play    # 57 end-to-end QA checks against a running server
npm run eval:play  # Chat Games eval → eval/play.json + EVAL-PLAY.md
npm run demo:prep  # stage the demo: reset, drop today's game, print one link per player (see DEMO-RUNBOOK.md)
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
   - **4-part `0–100` Connection Score & Commitment Thresholds:** `40%` turnout + `20%` streak + `20%` post-game banter & Deep Cuts mind-melds + `20%` shared topic confidence, gating tiers at **`40` (Group) → `60` (Event) → `75` (Marketplace)**.
   - Open **Menu → Context Inspector (`/dev/context`)** to inspect Before vs. After affinities, 4-part Connection Score & streak breakdown, and downstream rankings.
4. **Multi-Factor Ecosystem Ranking (`Events`, `Groups`, `Marketplace`):**
   - `socialMatchFor` combines **topic fit** + **threshold-gated shared-chat overlap** + **mutual friends going (`+0.05` each, cap `+0.15`)** + **event soonness (`+0.10` over 21 days)** + **saturation filtering** (omits `Send to X` when `X` is already RSVPed going) + **RSVP / Join / Save feedback loop** back into user affinity.

### Privacy Guardrails (Enforced in Code)
- **Strict Audience Intersection on Input:** Private Reel/Marketplace saves (`savedBy`), unshared private Groups, restricted (`friends`-only) profiles when non-friends are present, and other threads' messages are excluded from `GameTray` topic suggestions.
- **Zero Cross-Chat Signal Leakage on Output:** Friend/group match badges (`"Matches your games with X"`) only inspect Sidequest games **both users played inside a shared thread** — games a friend played in another chat never leak.

## Chat Games

Every group chat and DM gets one short game a day, written by Muse from that chat's own material. How the chat plays becomes a chat interaction score, and when the score crosses a threshold the chat is handed one real Group, Event or Marketplace listing on the topic it keeps choosing. Code picks the topic, the format, the sources, the scores and the recommendation; Muse writes the game and the one line on the unlock card; code checks every id, quote and number before anything is shown.

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
