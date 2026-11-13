# Pitch script — 5:00 + 3:00 Q&A

Numbers in brackets come from `EVAL.md` / `PERSONAS.md`; read the final files before you rehearse. Demo window A = Maya's phone, window B = Cole's Messenger. Replay mode is the safety net (`pitch/runbook.md`).

| Time | Slide | Say | Do |
|---|---|---|---|
| 0:00–0:30 | **1. Maya** | "Maya is 23, a designer in Austin, no car, and she has 120 dollars she could spend on a weekend. She hasn't left the city since March. Here's the thing: she knows 28 people in 11 other cities, and three of them would put her up tonight. She just has no way to know that." | Slide: Maya's avatar, "$120 · no car · 28 friends in 11 cities". |
| 0:30–0:50 | **2. The idea** | "Where can my people take me? You give Facebook a weekend and a budget. Not a destination. A Muse agent reasons over your actual network and finds trips that only exist because of who you know." | One line on screen. |
| 0:50–3:20 | **3. Live demo** | *(Feed)* "This is her feed. Owen is driving to Dallas on the twelfth, and she's free. One tap." *(Discover streams)* "Watch it work: it maps her network across eleven cities, finds who's open to hosting, prices Dallas with Owen's car and Cole's spare room, then reads her friends' photos from Dallas." *(Cards)* "Two prices, both honest: about $60 if Cole says yes and Owen has a seat; about $180 if they don't. The hotel version of this trip is about $360. Cole is a high-school friend who turned on *open to hosting*. Ravi is Ethan's friend, so it says 'intro via Ethan'. And the reason it picked Dallas: it noticed the Reel she saved." *(Guide)* "Build my guide. It's reading what her friends actually posted. This line, 'Muse saw', is live image understanding on Cole's photo. Every pick is credited to the friend it came from." *(Coordinate)* "Make it happen: everyone's free. Draft the messages. It asks Cole for the couch, and it asks Ethan to introduce her to Ravi; it never messages a friend-of-a-friend directly. Nothing has been sent. I approve this one." *(Window B)* "Cole gets exactly that message, and only that one." | Tap nudge → wait → scroll card → Build my guide → scroll → Draft → Approve → switch to window B. |
| 3:20–3:50 | **4. How it works** | "Under the hood: one Muse tool-calling agent, muse-spark, over tools that only ever return what this viewer can already see. Image understanding runs on muse-ember over friends' photos. Every id it outputs is re-checked in code, every dollar is computed in code. Here's a real run." | Play **agent animation** (≈18 s, press R if needed). |
| 3:50–4:15 | **5. Does it hold up?** | "We measured it on seeded scenarios: 100% of what reaches the screen traces to a real record the viewer can see, 0 privacy violations out of 146 rendered elements with restricted profiles seeded to trip it, 89% of trips inside the budget and the rest labelled over, and the network trip averages 73% cheaper than hotel plus solo transport. Prices are our seeded table; the arithmetic is the claim, not the market." | Numbers slide. |
| 4:15–4:35 | **6. Stress test** | "Then we stress-tested it with sixteen simulated young adults, each a Muse agent with its own budget and network, using the real endpoints. Simulated users, not research. 12 of 16 would take the trip; the one with nobody to host her got a straight 'no', which is the right answer. Two things they caught, we fixed." | Play **swarm animation** (≈17 s). Total animation time ≤ 40 s. |
| 4:35–4:50 | **7. Trust** | "Three rules we don't let the model break: hosting is opt-in, costs are never model arithmetic, and nothing sends without the user approving it in Messenger." | Slide. |
| 4:50–5:00 | **8. What's next** | "Real calendars and RSVPs for availability, tie strength from real interaction history, and hosts' own controls. The agent doesn't change; the tools get truer. Where can your people take you?" | Close. |

## 30-second version

"Young adults want to travel and can't afford it. Facebook already has what makes travel cheap: your people. You give us a weekend and a budget, not a destination. A Muse agent looks at who you know in other cities, who turned on *open to hosting*, who's driving there with an empty seat, what your friends posted from there, and proposes trips that only exist because of your network, with two honest prices: about $60 if Cole says yes, about $180 if not. Then it builds a guide from your friends' photos, credited to them, and drafts the asks, which you approve in Messenger. Every id is checked in code, every dollar is computed in code, nothing sends without you."

## Timing notes

- The live Discover run is 20–30 s. Keep talking through it; the stream gives you lines to read.
- If the stream shows "replaying a recorded run", say "the API blinked, so it's replaying a real run from this morning, re-checked against today's data" and keep going. The badge says REPLAY; don't hide it.
- Animations: agent ≈ 18 s, swarm ≈ 17 s. Never both back to back without a sentence between them.
- Persona study: one or two sentences, always with the word "simulated".

## Open Door (the paradigm shift; replaces slides 3–7 if you demo it)

**Line:** "Your agent asks so you don't have to. Then you talk."

| Time | Say | Do |
|---|---|---|
| 0:00–0:25 | "Asking someone you barely know 'can I crash at yours' is awkward enough that most people never ask. So they book a hotel or don't go. Open Door makes the ask effortless, and it does it without anyone over-sharing." | Slide: the line. |
| 0:25–0:55 | "Gabriel wrote this: spare room in Southtown, abuela cooks, UT design people and friends, two people. That's the whole interface. His agent can only act inside it." | Window B: Gabriel's profile, Open Door card. |
| 0:55–1:50 | "Maya gives a weekend and a budget. The agent maps her network, then reads what people actually said about those dates: RSVPs, posts, her own chats with them. No seeded calendar. Cole: likely free, with the quote. Gabriel: unknown, so we'll ask." | Window A: Discover → cards → Make it happen grid. |
| 1:50–2:50 | "Now her agent asks their agents. It never sends her name; code strips it. Gabriel's agent answers yes, no or conditions, from the policy. The shield line is the disclosure check: anything beyond the policy is removed before it comes back. Both sides get a fit, grounded in their own words." | Window A: Ask their agents → transcript → fit card → Yes, ask them. |
| 2:50–3:30 | "Gabriel sees: a friend of yours wants to stay Dec 11–13, your agent says it fits. Not who. He chooses to look. Both revealed, with how they know each other, and he decides last. Then a real chat opens and the agents are gone." | Window B: See who → reveal → Yes, open the chat. Window A: Messenger. |
| 3:30–4:00 | "We threw 30 adversarial probes at the host agents: schedule questions, addresses, relationships, prompt injections. zero leaked after the code scrubber. 16 policy cases: 16 respected. Numbers in EVAL-OPENDOOR.md." | Numbers slide. |
| 4:00–4:20 | "Change the policy and the answer changes. The policy is the product. Where can your people take you?" | Optional: edit Gabriel's tier, re-run. |
