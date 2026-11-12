# Demo runbook — Open Door

Two windows, two people. **A = Maya (traveler)**, **B = a host** (Gabriel in San Antonio or Cole in Dallas). A judge can sit at B, edit the host's Open Door policy, and watch the negotiation change.

## Before the room (10 min)

1. `.env.local` has `MODEL_API_KEY`; raise `MODEL_BUDGET_USD` for demo day (the guard refuses live calls past it and falls back to replay/mock, labelled).
2. `npm install && npm run build && npm start` (production build, no compile pauses). Open http://localhost:3000.
3. Warm once: `npm run warm` (images), then run the exact demo input once so Discover is cached (`/travel?as=maya&start=<Fri>&end=<Sun>&budget=120&run=1`). For the live demo use a different budget so judges see Muse run live.
4. Build Maya's travel style once: open `/profile/maya?as=maya` → **Build my travel style** (≈6 s, ≈$0.01). Edit or delete a line on camera if you want; the host's agent only gets what's left.
5. `npm run reset` restores the seed (clears trips, drafts, requests, availability cache; keeps caches warm). It does **not** clear travel styles' source content, but it does clear the generated styles, so redo step 4 after a reset.
6. Windows: **A** `http://localhost:3000/?as=maya`, **B** `http://localhost:3000/travel/opendoor?as=gabe` (or `?as=cole`).

## The click path (≈4 min live)

| Step | Window | Do | Say |
|---|---|---|---|
| 1 | B | Open Gabriel's profile → **Open Door** card. Read the policy aloud. Change nothing yet. | "This is the whole interface for hosting: your words, who it's open to, what you offer. Gabriel's agent can only act inside this." |
| 2 | A | Feed → nudge ("Yara is driving to Houston…") or Menu → Trips → pick a weekend + budget → **Find my trips**. | "Weekend and budget, not a destination. Watch it map her network, then *read what people said* about those dates: RSVPs, posts, her own chats. No seeded calendar." |
| 3 | A | Cards. Tap **Build my guide** on San Antonio (or Dallas). Scroll to **Make it happen**. | "Availability is calibrated: *Likely free* with the quote, *Busy* with the reason, *Unknown → we'll ask*. That **Ask** button drafts a one-liner she approves first." |
| 4 | A | **Ask their agents, anonymously.** Watch the transcript. | "Her agent asks Gabriel's agent. It never sends her name (code strips it). Gabriel's agent answers only yes / no / conditions, from the policy. The shield line is the disclosure check: anything beyond the policy is removed before it comes back." |
| 5 | A | The anonymous fit card. Tap **Yes, ask them**. | "She sees a host 'you know directly', the dates, the conditions, and why it fits from both sides. Not who." |
| 6 | B | `/travel/opendoor` → the anonymous card: "A friend of yours wants to stay Dec 11–13… See who?" Tap **See who**. | "Gabriel sees the connection and the dates, not the name. He chooses to look." |
| 7 | B | Reveal: Maya, UT Design cohort, mutuals. Tap **Yes, open the chat**. | "Both revealed, host decides last with full information. Then a real chat opens seeded with how they know each other, and the agents are out of it." |
| 8 | A | Messenger → the new chat with the Open Door context line. | "From here it's two people." |
| 9 | B (optional, 60 s) | Edit the policy ("friends only" tier, or "no guests in December") → A: run **Ask their agents** again on another trip. | "Same traveler, different policy, different answer. The policy is the product." |
| 10 | Inspector (optional) | `/dev/ai` → traces `opendoor.traveler`, `opendoor.host.gabe`, `travel.availability`, `travel.style`. | "Every call, prompt, tokens, cost. Nothing is scripted." |

## Reset between runs

`npm run reset` (or `POST /api/admin/reset`). Then rebuild Maya's travel style (step 4) if you want it in the negotiation. Inspector list: `curl -X DELETE localhost:3000/api/ai/trace`.

## If something fails

| Symptom | Do this |
|---|---|
| Discover spins past 40 s | Wait; the final model turn can take 10–15 s. Stream error → re-tap; early turns are cached. |
| "replaying a recorded run" | The fallback working. Say so; badge says REPLAY. |
| Negotiation shows "Stopped: …" | Re-tap **Ask their agents**; requests already answered are kept. In mock mode (no key) every candidate is asked once with a code-written message and answered from availability, labelled MOCK. |
| Host's card never appears in B | The traveler must tap **Yes, ask them** first; B polls every 3 s. Check both windows point at the same server and B is the right host (`?as=`). |
| Budget guard refuses | Raise `MODEL_BUDGET_USD` in `.env.local` and restart, or `npm run replay:on`. Never edit `.ai-ledger.json`. |
| Images blank | `npm run warm`; placeholders fall back to gradients. |
| Travel style shows nothing | The person has little own content; "Build" again or write a line by hand (edit). |

## Numbers to have on hand

- Discover ≈25–37 s, ≈$0.05. Negotiation (2–3 hosts) ≈25 s, ≈$0.03. Travel style ≈6 s, ≈$0.01. Availability inference ≈2 s, ≈$0.002 per person.
- Seed: 61 people, 12 cities, 38 Open Door policies in people's own words (tiers vary), 10 availability signal posts + chat lines, 55 licensed photos.
- Evals: `EVAL-OPENDOOR.md` (privacy probes, policy compliance, blind match set) and `EVAL.md` (grounding, budget, cost comparison).
