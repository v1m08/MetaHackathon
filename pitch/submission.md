# Submission — Where can my people take me?

**One line.** Give Facebook a weekend and a budget, not a destination. A Muse agent reasons over your real network (who lives where, who opted in to hosting, who's driving there with an empty seat, what your friends posted from there) and proposes trips that only exist because of the people you know, with two honest prices.

**Outcome, in our seeded evaluation (`EVAL.md`).** 100% of what reaches the screen traces to a real record the viewer is allowed to see; 0 privacy violations across every rendered element, with restricted profiles seeded so a violation is possible and would be caught; trips land inside the budget 89% of the time and are labelled "$X over" otherwise; the network-powered trip averages 73% cheaper than the same trip with a hotel and solo transport (on our seeded price table); a full Discover run takes ~25 s and about five cents of Muse. A 16-persona stress test (simulated young adults played by Muse agents, not user research; `PERSONAS.md`) found and fixed real problems before judges did.

**Why young adults.** They want to travel and can't afford it. The cheap, good version of travel is staying with someone, riding with someone, and being shown around by someone. Facebook is the only place that already knows all three about your actual friends and friends-of-friends. A search box can't do this; it needs a destination. We start from a weekend and $120.

**What it does.**
1. **Discover.** Pick a weekend and a budget. Watch the agent work in a live reasoning stream ("Mapping your whole network: who lives where, who hosts, who's driving Dec 11–13" → "Pricing Dallas: 2 nights, staying with a friend, by a friend's car" → "Reading your friends' photos from Dallas"). Get 2–3 trip cards: *"dallas with cole + harper for the deep ellum vintage market — ~$60 if Cole says yes to hosting and Owen has a seat, ~$180 otherwise (hotel trip ~$360)"*, with how you know each person, "Open to hosting" badges, and "intro via Ethan" for friends-of-friends.
2. **Guide.** Recommendations built only from what your friends posted there, matched to your taste (saved Reels, likes), each credited to the friend it came from. One photo is read live with Muse image understanding and the result is shown next to it.
3. **Coordinate.** Who's free when; alternative weekends if someone's busy; drafted messages that ask the host for the couch and ask the mutual for an introduction, never a stranger directly. Drafts sit in Messenger as *awaiting your approval*; nothing sends until you tap Approve.
4. **A reason to come back.** A Feed nudge when a friend RSVPs to an out-of-town event or posts a ride on a weekend you're free: "Owen is driving to Dallas on the 12th. You're free that weekend." Plus entry points on Events, Profiles ("Open to hosting friends" setting) and Messenger.

**How Muse is used.** `muse-spark-1.3` runs a real tool-calling agent over viewer-scoped tools (network scan, availability, cost estimate, city media, propose); `muse-ember-1.0` does image understanding over 57 openly licensed city photos at index time and live in the Guide. Every call goes through one client with tracing (an in-app AI Inspector shows prompts, tool steps, latency, tokens and cost), on-disk caching, and a budget guard that reserves worst-case cost before each call.

**Safety by construction.** Tools only return what the viewer can already see. Every person, ride, event, post and Reel id in the model's output is re-checked against the database and the viewer; failures are dropped and logged. Hosting is opt-in. Costs are never model arithmetic. Friend-of-friend options require a named mutual and the message goes through them. Sending is simulated inside the clone.

**What's real / simulated.** Real: the agent, tool use, image understanding, validation, pricing math, approval flow, the live demo. Simulated: the people and prices (seeded), message delivery (inside the clone), and the persona study (Muse agents role-playing users, labelled as such everywhere).

**Fallbacks.** If the API blinks, the app replays a recorded real run, re-validated against today's data, and says so with a REPLAY badge. Identical requests are served from cache and labelled.

**Repo.** README (architecture, tools, how to run), `EVAL.md`, `PERSONAS.md`, `CREDITS.md`, `pitch/` (deck, script, runbook, Q&A, animations built from real traces).

**Team.** [NAMES]
