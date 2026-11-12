# Q&A — the 8 hardest questions

Short answers. Numbers come from `EVAL.md` and `PERSONAS.md`; say "in our seeded evaluation" when you quote them.

**1. Couldn't a search box do this?**
No. A search box needs a destination. Our input is a weekend and a budget; the destination is the output. The agent's raw material is things no search index has: who in your network opted in to hosting, who is driving where with an empty seat, who RSVP'd to what, and what your friends' photos from those cities actually show (read with Muse image understanding). Remove the AI and you have a list of friends by city. Remove the network and you have Kayak.

**2. How do you know someone will host?**
We don't, and we never say we do. Hosting is opt-in: a profile setting, off by default; only people who turned it on are ever proposed. Every card shows two prices: "about $110 if Cole says yes, about $290 otherwise", and the second number is a real plan (hostel + bus), not a threat. Then the app drafts the ask and the user approves it. The yes comes from Cole, in Messenger, like it always did.

**3. What stops the model from showing me something I'm not allowed to see?**
Code, not prompts. Every tool takes the viewer's identity and returns only what that viewer can already see in the app (friends, friends-of-friends through a named mutual, public posts, their own groups). After the model answers, every person, ride, event, post and Reel id is re-checked against the store and the viewer; anything that fails is dropped and the reason is logged. In the evaluation the model did try to cite things outside the viewer's world; zero reached the screen. Restricted profiles in the seed (friends-only posts) are the test.

**4. What if it hallucinates a friend, or a price?**
Names can't be hallucinated onto a card: an id that doesn't exist is dropped before render, and the reasons that mention it are scrubbed. Prices are never produced by the model. It calls `estimate_trip_cost`, which does arithmetic on a seeded price table in code, and the card is re-priced by code after validation. The one thing the model writes freely is the pitch, and it's labelled as the agent's words.

**5. Isn't this Couchsurfing / Hostelworld / Airbnb?**
Couchsurfing is strangers who host; this is only people you already know, which is why young adults actually say yes. Airbnb sells rooms; we don't sell anything, we reveal trips that already exist in your graph. And neither of them can start from "I have $120 and the 12th free."

**6. Why would anyone come back? Isn't this a once-a-year feature?**
The feed nudge. It fires when a friend RSVPs to an out-of-town event or posts a ride on a weekend you're free: "Owen is driving to Dallas on the 12th. You're free that weekend." That's a reason to open Facebook that no other app has, because no other app knows all three facts. Plus the Guide: friends' posts become useful the moment you have a trip, so posting feeds back into the loop.

**7. What's real and what's simulated?**
Real: the Muse agent, its tool calls, image understanding, the two-price math, the safety checks, the Messenger approval flow, the live demo you just saw. Simulated: the people (fictional, seeded), the prices (a seeded table, stated in the repo), and the "users" in our persona study, which are Muse agents role-playing young adults as a stress test, labelled as such everywhere. We don't call it user research.

**8. What breaks at Facebook scale, and what's next?**
Three things we'd do next: (1) real availability from calendars and real RSVPs, not a seeded busy list; (2) ranking by tie strength from actual interaction history instead of degree; (3) hosts' own controls — "friends only", "not this month", "ask through Priya". The architecture already assumes those: tools are viewer-scoped, validation is a single choke point, prices are a table. The agent itself doesn't change.

**Spare: how much does a run cost?**
About five cents of Muse per Discover and two to three cents per Guide, measured in our ledger with a 1.5× safety margin on third-party prices. The whole build, evaluation and persona study came in under the budget in `PROGRESS.md`.
