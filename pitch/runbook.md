# Demo runbook — Reconnect

Two windows. **A = Maya** (active, Austin). **B = Nadia** (dormant, Chicago; hasn't posted in weeks except today). A judge can sit at B.

## Before the room (10 min)

1. `.env.local` has `MODEL_API_KEY`; raise `MODEL_BUDGET_USD` for demo day (the guard refuses live calls past it and falls back to mock, labelled).
2. `npm install && npm run build && npm start` (production build). Open http://localhost:3000.
3. `npm run reset` restores the seed and clears Reconnect state (picks, nudges, plans). Then warm the one call that should be instant on stage: open `http://localhost:3000/?as=maya` once so the daily nudge is computed (≈3 s, ≈$0.005) and cached.
4. Run the whole path once so the plan agent is cached for the identical input: `npm run qa:reconnect` (28 checks, ≈75 s live). For the live demo, "Run again" on the person page forces a fresh run; or demo a different person (Cole) so judges see Muse live.
5. Windows: **A** `http://localhost:3000/?as=maya`, **B** `http://localhost:3000/notifications?as=nadia`.

## The click path (≈4 min live)

| Step | Window | Do | Say |
|---|---|---|---|
| 1 | A | Feed. Nadia's post is at the top with the strip under it: **You and Nadia · 7 weeks since a real chat**, one line, a photo chip. | "Nadia posted this morning. Facebook noticed two things at once: it's the first thing she's posted in weeks, and Maya and Nadia haven't had a real exchange in seven weeks, against a rhythm of about a month. That's computed, no model. The line under it is Muse, and it cites the photo it's leaning on." |
| 2 | A | Tap the chip → **What was used**. Scroll: cited, then "also shared, not used", then the never-read list. | "This is every single thing the nudge is allowed to rest on: tagged photos, events they both went to, lines from Maya's own chats. Likes never count. Mood, health, anyone else's chats: never read. If Muse cites something not on this list, code drops the nudge. Nothing beats a made-up reason." |
| 3 | A | Close. Tap **Plan something** → person page. Tap **I miss them**. | "One more thing before planning. This heart is private. Nobody sees it. Nadia tapped hers last week. So now…" (the pill flips to **mutual**, the rose card appears) "…both of them know the one thing that stops people from reaching out: that the other person wants it too." |
| 4 | A | **Find a way to see Nadia.** Read the stream. | "Now the legwork. It reads who Nadia is and what she posted, the next six weekends, events in both cities, who's driving. Then it reads what Nadia actually said about Dec 4–6 in her posts and in Maya's own chats with her. Then it prices things. Watch: it found Arjun's 25th in Chicago that weekend, and Nadia already RSVP'd." |
| 5 | A | Three cards. Tap **Use this one** on the Chicago weekend. Scroll the plan page: who (with quotes), cost line by line, **How this was planned**. | "Three shapes: go to her, a call, an event that's already happening. Every dollar is a line from a seeded price table, added in code. Every claim has its source. Nothing is sent." |
| 6 | A | **Write to Nadia** → Messenger opens with the draft. | "Muse drafted this from how Maya actually texts Nadia. It's a draft in the normal composer. She can edit it. She sends it. The agent never messages anyone." Tap **Approve & send**. |
| 7 | B | Notifications: **Maya Chen wants to see you Dec 4–6**. Tap → the thread: Maya's words and the Event card. Tap **I'm in**. | "This is the dormant account. What brought Nadia back is not a product notification. It's a message from a friend, in her words, with an Event she can say yes to in one tap. There is no AI on this screen." |
| 8 | A | Plan page: **Nadia · in**. Tap **Confirm this plan**. Open the Event. | "Maya confirms last. The plan's home is a normal Facebook Event, invite-only. From here it's two people." |
| 9 | A (optional, 40 s) | Back to Reconnect → **A chapter · Plano East**. Show the hook: Cole's "who's in" with no plan. **A place · Dallas**, Owen driving. **Your culture · Dumpling Night**. | "Same engine, four doors in: a person, a chapter of your life, your culture, a place. The travel case is the fourth." |
| 10 | Inspector (optional) | `/dev/ai` → `reconnect.whynow`, `reconnect.plan`, `reconnect.draft`, `travel.availability`. | "Every call, prompt, tokens, cost. Nothing is scripted." |

## Reset between judges

`npm run reset`, then open `/?as=maya` once (daily nudge), and the demo is ready. Inspector list: `curl -X DELETE localhost:3000/api/ai/trace`.

## If something fails

| Symptom | Do this |
|---|---|
| No strip under Nadia's post | Reload once; the daily nudge is computed on first load (≈3 s). If still nothing, `/reconnect/nadia?as=maya` shows the nudge or the reason code dropped it. |
| "Muse wrote something code wouldn't show" | The guardrail working. Say so. Tap **Plan something** anyway; the plan doesn't need the nudge. |
| Plan agent spins past 45 s | Wait; the final turn can take 15 s. Stream error → **try again**; the context tool is cached. |
| Plan says Nadia busy | Read the quote on the person row; it's her own words. Pick the call, or **Run again**. |
| Budget guard refuses | Raise `MODEL_BUDGET_USD` in `.env.local` and restart. Mock mode writes an honest code-only plan, labelled MOCK. |
| B doesn't get the notification | Both windows must point at the same server; B polls every 5 s. Check `?as=nadia`. |
| Images blank | `npm run warm`; placeholders fall back to gradients. |

## Numbers to have on hand

- Drift: pure code over chats, events and tagged photos; rhythm = median gap over 180 days, clamped 7–120, default 30.
- Why-now ≈3 s, ≈$0.005. Plan agent ≈30–45 s, ≈$0.03–0.05. Draft ≈4 s, ≈$0.003. Availability inference ≈2 s per person.
- Evals: `EVAL-RECONNECT.md` (why-now grounding, plan grounding, reactivation over the seed). Travel's `EVAL.md` and `EVAL-OPENDOOR.md` still hold for the machinery underneath.
