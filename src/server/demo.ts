// The Muse bot in the hackathon demo's group chat. Everything Muse says is decided by the model from the group's
// own data (profiles, posts, chat, game results, events they can actually go to). There are no canned messages: if
// the model can't be reached, Muse retries, and if it still can't, it stays quiet and tries again later.
//   1. kickoffDemo: the first time someone opens the chat, Muse picks a game topic the whole group shares (plus a
//      few angles from their lives so it feels made for them) and posts a Deep Cuts round.
//   2. museMentioned: text "muse ..." in the chat ("muse give us another one", "muse something about food") and
//      Muse replies and, if asked, makes a new game.
//   3. afterDemoMessage: once PLAN_AFTER_PLAYERS people have finished the first game, Muse picks the plan that fits them and sends
//      each person a notification (seen on the Friends tab), each with its own reason.
// Muse's first pick is cached by a fingerprint of the context and games by topic + angles, so a repeat run with
// the same data is instant; change the data and Muse decides again. Nothing is prepared ahead of time.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ai } from "@/lib/ai";
import { topic, topicsOfText, type TopicId } from "@/lib/context/taxonomy";
import { canSeeEvent } from "@/lib/context/visibility";
import { DEMO_CHAT, MUSE_ID, PLAN_AFTER_PLAYERS } from "@/lib/demo";
import type { FBEvent } from "@/types";
import { db, getConversation, notify, postsBy, sendMessage } from "./db";

const SQ = process.env.SIDEQUEST_INTERNAL_URL || `http://127.0.0.1:${process.env.SIDEQUEST_PORT || 5180}`;
const TZ = "America/Los_Angeles";
const PLAN_DIR = join(process.cwd(), "sidequest", ".cache", "demo");
const MUSE_VOICE = `You are Muse, a friendly bot that lives in a Messenger group chat of friends. You run quick party games for the group and help them make plans. Voice: casual group-chat texting, mostly lowercase, warm, a little playful, never corporate, no hashtags. Only mention facts that are in the context you're given; never invent people, places or events.`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** One structured call to the model, retried with backoff: a dropped connection ("fetch failed") shouldn't sink Muse. */
async function museJson<T>(prompt: string, opts: Parameters<typeof ai.json>[1]): Promise<T> {
  if (ai.mode() !== "live") throw new Error("Muse needs the live model (no MODEL_API_KEY, or AI_MODE=mock)");
  let last: unknown;
  for (const wait of [0, 1500, 4000, 8000]) {
    await sleep(wait);
    try {
      return (await ai.json<T>(prompt, opts)).data;
    } catch (e) {
      last = e;
      console.error(`[muse] ${opts.task}: ${(e as Error).message}${wait < 8000 ? ", retrying" : ""}`);
    }
  }
  throw last;
}

const members = (convId: string) => (getConversation(convId)?.participantIds ?? []).filter((id) => id !== MUSE_ID);
const user = (id: string) => db().users.find((u) => u.id === id);
const first = (id: string) => user(id)?.name.split(" ")[0] ?? id;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const museGames = (convId: string) => getConversation(convId)?.messages.filter((m) => m.senderId === MUSE_ID && m.attachment?.type === "sqgame") ?? [];
const latestMuseGame = (convId: string) => museGames(convId).at(-1);

/** Everything Muse knows about the group, as plain data. */
function groupContext(convId: string) {
  const c = getConversation(convId)!;
  const people = members(convId).map((id) => {
    const u = user(id);
    return {
      name: first(id),
      lives: u?.location,
      work: u?.work,
      bio: u?.bio,
      interests: u?.interests,
      recentPosts: postsBy(id).slice(0, 3).map((p) => (p.location ? `${p.text} (at ${p.location})` : p.text)),
    };
  });
  // Context Engine taxonomy: which interests how many of them share
  const counts = new Map<TopicId, number>();
  for (const id of members(convId)) for (const t of topicsOf(id)) counts.set(t, (counts.get(t) ?? 0) + 1);
  const sharedInterests = [...counts].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${topic(t).label}: ${n} of ${people.length}`);
  const recentChat = c.messages.filter((m) => m.senderId !== MUSE_ID && m.text && !m.attachment).slice(-12).map((m) => `${first(m.senderId)}: ${m.text}`);
  return { people, sharedInterests, recentChat };
}

/** Topics someone is into, from their profile and their own posts. */
function topicsOf(userId: string): Set<TopicId> {
  const u = user(userId);
  return new Set(topicsOfText([u?.bio, ...(u?.interests ?? []), ...postsBy(userId).map((p) => p.text)].join(" · ")));
}

/** The four Sidequest games Muse can send. `ref` prefixes match the chat's game cards (ChatGames.tsx). */
type GameKind = "deepcuts" | "orderup" | "ghostrun" | "sketchoff";
const KINDS: Record<GameKind, { name: string; api: string; prefix: string; howItPlays: string; makes: string }> = {
  deepcuts: { name: "Deep Cuts", api: "x", prefix: "", howItPlays: "trivia: everyone names things in a category, rarer answers score more", makes: "about a minute and a half" },
  orderup: { name: "Order Up!", api: "k", prefix: "k:", howItPlays: "a 75-second restaurant rush themed to the topic: build dishes and serve customers fast", makes: "about 20 seconds" },
  ghostrun: { name: "Ghost Run", api: "r", prefix: "r:", howItPlays: "a lane race themed to the topic where you race your friends' ghosts", makes: "about 15 seconds" },
  sketchoff: { name: "Sketch Off", api: "s", prefix: "s:", howItPlays: "draw things from the topic while friends and the AI guess", makes: "about 15 seconds" },
};
const kindOfRef = (ref: string): GameKind => (ref.startsWith("k:") ? "orderup" : ref.startsWith("r:") ? "ghostrun" : ref.startsWith("s:") ? "sketchoff" : "deepcuts");

/** Creates a game room on the game server (generating the game first if the topic is new). Returns its card ref. */
async function createGame(kind: GameKind, topicText: string, angles?: string[]): Promise<string> {
  const k = KINDS[kind];
  const r = await fetch(`${SQ}/api/${k.api}/new`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ interest: topicText, angles }) });
  const j = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!r.ok || !j.id) throw new Error(j.error ?? `game server ${r.status}`);
  return k.prefix + j.id;
}
const READY_SYSTEM = `${MUSE_VOICE}
You just finished making the group a game (see "game": its type, how it plays, title and details). Write the push notification that tells them it's ready, at most 120 characters. Tease it with the game's actual title or a real detail from it, and make them want to tap. Don't just say "your game is ready".`;

/** Posts the game card in the chat; Muse writes the "it's ready" notification for everyone in the background. */
async function postGame(convId: string, topicText: string, ref: string) {
  sendMessage(convId, MUSE_ID, `🎮 ${KINDS[kindOfRef(ref)].name}: ${topicText}`, { type: "sqgame", ref });
  void notifyReady(convId, topicText, ref).catch((e) => console.error(`[muse] ready notification: ${(e as Error).message}`));
}
async function notifyReady(convId: string, topicText: string, ref: string) {
  const kind = kindOfRef(ref);
  const room = (await fetch(`${SQ}/api/${KINDS[kind].api}/${ref.replace(/^[krs]:/, "")}`).then((r) => r.json())) as {
    pack?: { title?: string; prompts?: { q: string }[] };
    menu?: { name?: string; dishes?: { name: string }[] };
    course?: { title?: string };
  };
  const game = {
    type: KINDS[kind].name,
    howItPlays: KINDS[kind].howItPlays,
    topic: topicText,
    title: room.pack?.title ?? room.menu?.name ?? room.course?.title,
    details: room.pack?.prompts?.map((p) => p.q) ?? room.menu?.dishes?.map((d) => d.name),
  };
  const { text } = await museJson<{ text: string }>(`Group: ${JSON.stringify(members(convId).map(first))}\nGame: ${JSON.stringify(game)}`, {
    task: "demo.muse-game-ready",
    system: READY_SYSTEM,
    temperature: 0.8,
    maxTokens: 3000,
    schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
  });
  if (!text?.trim()) return;
  for (const p of members(convId)) notify(p, { actorId: MUSE_ID, type: "mention", text: `**Muse** ${text.trim().slice(0, 160)}`, href: `/messages/${convId}` });
}

const ANGLES = {
  type: "array",
  items: { type: "string" },
  description: "1-3 short angles WITHIN the topic for the questions to cover, picked to suit these specific people (e.g. topic 'Bay Area' → 'Bay Area tech'; topic 'movies' → 'movies set in SF'). Never a different subject.",
} as const;

// ---------- 1. the first game ----------
type Plan = { topic: string; angles: string[]; why: string };

const PLAN_SYSTEM = `${MUSE_VOICE}
Pick ONE topic for a round of Deep Cuts, a party game where everyone names things in a category and rarer answers score more.
- The topic must be something EVERY person in the chat shares or would enjoy (e.g. the city or area they all live in, or an interest all of them have), never something only some of them are into. Broad and fun: everyone can instantly name a few things. 1-4 plain words (e.g. "San Francisco", "90s movies", "Tacos").
- "angles": exactly 3 angles for the questions, drawn from what these specific people do and love so the round feels made for them. Look at what they share: if they share a line of work or study (their "work" field, posts about it), make one angle about that world in this place (e.g. "Bay Area tech"); the others from hobbies, food or places they post about.
- "why": one short sentence for the presenter on which data led to the pick.`;

async function planGame(convId: string): Promise<Plan> {
  const ctx = groupContext(convId);
  const key = createHash("sha1").update(JSON.stringify(ctx)).digest("hex").slice(0, 16);
  const file = join(PLAN_DIR, `plan-${key}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as Plan;
  const data = await museJson<Plan>(`Group chat context:\n${JSON.stringify(ctx, null, 1)}`, {
    task: "demo.muse-pick-game",
    system: PLAN_SYSTEM,
    temperature: 0,
    maxTokens: 4000, // the model reasons first; a small budget leaves nothing for the answer
    schema: { type: "object", properties: { topic: { type: "string" }, angles: ANGLES, why: { type: "string" } }, required: ["topic", "angles", "why"] },
  });
  if (!data.topic?.trim()) throw new Error("empty answer");
  const plan = { topic: data.topic.trim().slice(0, 40), angles: (data.angles ?? []).map((a) => String(a).slice(0, 60)).slice(0, 3), why: data.why?.trim() ?? "" };
  mkdirSync(PLAN_DIR, { recursive: true });
  // the context is saved too, so you can see exactly what Muse based its pick on
  writeFileSync(file, JSON.stringify({ ...plan, context: ctx }, null, 2));
  return plan;
}

let kicking: Promise<void> | null = null;
/** Starts Muse's first game (once). Returns right away; the chat picks up Muse's messages as they land. */
export function kickoffDemo(convId: string): { status: "posted" | "making" | "skipped" } {
  if (convId !== DEMO_CHAT || !getConversation(convId)) return { status: "skipped" };
  if (latestMuseGame(convId)) return { status: "posted" };
  // 5 judges can open the chat in the same second: only one run
  kicking ??= (async () => {
    const plan = await planGame(convId);
    const ref = await createGame("deepcuts", plan.topic, plan.angles);
    if (!latestMuseGame(convId)) await postGame(convId, plan.topic, ref);
  })()
    .catch((e) => console.error(`[muse] couldn't start the game: ${(e as Error).message}`))
    .finally(() => (kicking = null));
  return { status: "making" };
}

// ---------- 2. someone texts Muse ----------
type Reply = { reply: string; newGame: boolean; gameType: GameKind; topic: string; angles: string[] };
const REPLY_SYSTEM = `${MUSE_VOICE}
Someone in the group chat just texted you. Decide how to respond.
- If they want a game (another round, a new game, a game about X), set newGame true and pick:
  - "gameType": one of ${Object.entries(KINDS).map(([k, v]) => `"${k}" (${v.name}: ${v.howItPlays})`).join("; ")}. Unless they asked for a specific game, pick a DIFFERENT type from the ones in "gamesSoFar" (they've already had Deep Cuts, so avoid it), whichever suits the topic best: Order Up! for food and drinks, Ghost Run for sports, vehicles, travel and the outdoors, Sketch Off for things you can draw (animals, places, objects, characters).
  - "topic": what they asked for if they named one, otherwise something new the whole group shares. 1-4 plain words that suit the game type.
  - "angles": only for Deep Cuts, 1-3 sub-areas OF THAT TOPIC that suit these people; otherwise [].
- "reply": your text back, at most 160 characters. If you're making a game, say which game and what it's about, and roughly when it's ready (${Object.values(KINDS).map((v) => `${v.name}: ${v.makes}`).join(", ")}).
- If they're just chatting, newGame false, reply briefly, gameType "deepcuts" and topic "".`;

// Messages to Muse are answered one at a time, in order (never dropped while Muse is busy with the last one).
let replies: Promise<void> = Promise.resolve();
/** If someone in the demo chat mentions Muse, Muse answers (and maybe makes a new game). Fire and forget. */
export function museMentioned(convId: string, senderId: string, text: string) {
  if (convId !== DEMO_CHAT || senderId === MUSE_ID || !/\bmuse\b/i.test(text)) return;
  replies = replies.then(() => answer(convId, senderId, text));
}
async function answer(convId: string, senderId: string, text: string) {
  await (async () => {
    const gamesSoFar = museGames(convId).map((m) => m.text.replace(/^🎮 /, ""));
    const r = await museJson<Reply>(`Group chat context:\n${JSON.stringify({ ...groupContext(convId), gamesSoFar }, null, 1)}\n\n${first(senderId)} just texted: ${JSON.stringify(text)}`, {
      task: "demo.muse-reply",
      system: REPLY_SYSTEM,
      temperature: 0.7,
      maxTokens: 4000,
      schema: {
        type: "object",
        properties: { reply: { type: "string" }, newGame: { type: "boolean" }, gameType: { type: "string", enum: Object.keys(KINDS) }, topic: { type: "string" }, angles: ANGLES },
        required: ["reply", "newGame", "gameType", "topic", "angles"],
      },
    });
    if (r.reply?.trim()) sendMessage(convId, MUSE_ID, r.reply.trim().slice(0, 280));
    if (r.newGame && r.topic?.trim()) {
      const kind: GameKind = r.gameType in KINDS ? r.gameType : "orderup";
      const topicText = r.topic.trim().slice(0, 40);
      await postGame(convId, topicText, await createGame(kind, topicText, kind === "deepcuts" ? r.angles?.slice(0, 3) : undefined));
    }
  })().catch((e) => console.error(`[muse] couldn't answer: ${(e as Error).message}`));
}

// ---------- 3. the plan, as a notification to each person ----------
type Suggestion = { eventId: string; groupMessage: string; notes: { name: string; text: string }[] };
const PLAN_NOTE_SYSTEM = `${MUSE_VOICE}
The group just played a game together. Suggest ONE real-world plan for them from the candidate events (use its exact id), the one that fits the most people in this group best, based on their profiles, posts and chat.
Write "groupMessage": a short nudge you post in the group chat, at most 90 characters: you've all been playing games together in here, so maybe do this one in person. The event card goes right under it, so don't repeat its title, date or place.
Then write a short notification to EACH person (use their exact name), at most 100 characters each: the same nudge to take it offline, with one detail that makes it about them. Speak to them directly ("you"). Don't start every note the same way.`;

/** Upcoming events every member of the chat can see and isn't already going to. */
function candidateEvents(people: string[]): FBEvent[] {
  return db().events.filter((e) => new Date(e.startsAt).getTime() > Date.now() && people.every((p) => canSeeEvent(p, e) && !e.going.includes(p)));
}

const suggested = new Set<string>();
export function afterDemoMessage(convId: string) {
  if (convId !== DEMO_CHAT) return;
  const c = getConversation(convId);
  const game = museGames(convId)[0]; // the plan comes from the group's first game
  if (!c || !game || suggested.has(convId) || c.messages.some((m) => m.senderId === MUSE_ID && m.attachment?.type === "event")) return;
  const people = members(convId);
  const scores = c.messages.filter((m) => m.attachment?.type === "sqgamelog" && m.attachment.ref === game.attachment!.ref);
  const finished = new Set(scores.map((m) => m.senderId));
  if (finished.size < Math.min(PLAN_AFTER_PLAYERS, people.length)) return;
  suggested.add(convId);
  void (async () => {
    const events = candidateEvents(people);
    if (!events.length) return;
    const ctx = {
      ...groupContext(convId),
      game: { name: game.text.replace(/^🎮 /, ""), results: scores.map((m) => `${first(m.senderId)} ${m.text}`) },
      candidateEvents: events.map((e) => ({
        id: e.id,
        title: e.title,
        when: new Date(e.startsAt).toLocaleString("en-US", { timeZone: TZ, weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
        where: e.location,
        price: e.price,
        about: e.description,
      })),
    };
    const s = await museJson<Suggestion>(`Context:\n${JSON.stringify(ctx, null, 1)}`, {
      task: "demo.muse-suggest-plan",
      system: PLAN_NOTE_SYSTEM,
      temperature: 0.6,
      maxTokens: 5000,
      schema: {
        type: "object",
        properties: {
          eventId: { type: "string", enum: events.map((e) => e.id) },
          groupMessage: { type: "string" },
          notes: { type: "array", items: { type: "object", properties: { name: { type: "string" }, text: { type: "string" } }, required: ["name", "text"] } },
        },
        required: ["eventId", "groupMessage", "notes"],
      },
    });
    if (!events.some((e) => e.id === s.eventId) || !s.notes?.length) throw new Error("the model's answer didn't name a real event");
    if (s.groupMessage?.trim()) sendMessage(convId, MUSE_ID, s.groupMessage.trim().slice(0, 140));
    sendMessage(convId, MUSE_ID, "", { type: "event", ref: s.eventId });
    for (const p of people) {
      const note = s.notes.find((n) => n.name.trim().toLowerCase() === first(p).toLowerCase())?.text ?? s.notes[0]?.text;
      if (note) notify(p, { actorId: MUSE_ID, type: "event_invite", text: `**Muse** ${note.trim().slice(0, 160)}`, href: `/events/${s.eventId}` });
    }
  })().catch((e) => {
    // nothing was sent: try again in a bit (and on the next finished game)
    suggested.delete(convId);
    console.error(`[muse] plan: ${(e as Error).message}; trying again in 20s`);
    setTimeout(() => afterDemoMessage(convId), 20_000);
  });
}

/** Muse's newest notification to this person (a game is ready, or a plan), for the slide-down banner. */
export function museLatestFor(userId: string) {
  const n = db().notifications.find((x) => x.userId === userId && x.actorId === MUSE_ID);
  return n ? { id: n.id, text: n.text.replace(/^\*\*Muse\*\*\s*/, ""), href: n.href, kind: n.href.startsWith("/events/") ? ("plan" as const) : ("game" as const) } : null;
}

/** Muse's plan note to this person, with its event, for the Friends tab. */
export function museNoteFor(userId: string) {
  const n = db().notifications.find((x) => x.userId === userId && x.actorId === MUSE_ID && x.href.startsWith("/events/"));
  if (!n) return null;
  const e = db().events.find((x) => `/events/${x.id}` === n.href);
  return { id: n.id, text: n.text.replace(/^\*\*Muse\*\*\s*/, ""), createdAt: n.createdAt, event: e ? { id: e.id, title: e.title, cover: e.cover, startsAt: e.startsAt, location: e.location, price: e.price } : null };
}
/** Admin reset: forget which chats already got a plan. */
export function resetMuse() {
  suggested.clear();
}
