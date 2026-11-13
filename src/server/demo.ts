// The Muse bot in the demo group chat.
//   1. kickoffDemo: the first time someone opens the chat, Muse reads the group's context (where everyone lives,
//      bios, interests, recent posts, recent chat, shared topics from the Context Engine), picks a game topic the
//      whole group shares, and sends a Deep Cuts round about it.
//   2. afterDemoMessage: once most of the group has finished the game, Muse suggests the event that matches
//      what most of them are into (from their profiles and posts), and says why.
// Muse's pick is cached by a fingerprint of the context, and the game by topic, so a repeat run with the same data
// is instant; change the data and Muse picks again. warmDemo() does the slow part ahead of time.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ai } from "@/lib/ai";
import { topic, topicsOfEvent, topicsOfText, type TopicId } from "@/lib/context/taxonomy";
import { DEMO_CHAT, DEMO_EVENT_IDS, MUSE_ID } from "@/lib/demo";
import { db, getConversation, postsBy, sendMessage } from "./db";

const SQ = process.env.SIDEQUEST_INTERNAL_URL || `http://127.0.0.1:${process.env.SIDEQUEST_PORT || 5180}`;
const TZ = "America/Los_Angeles";
const PLAN_DIR = join(process.cwd(), "sidequest", ".cache", "demo");

const members = (convId: string) => (getConversation(convId)?.participantIds ?? []).filter((id) => id !== MUSE_ID);
const user = (id: string) => db().users.find((u) => u.id === id);
const first = (id: string) => user(id)?.name.split(" ")[0] ?? id;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const museGame = (convId: string) => getConversation(convId)?.messages.find((m) => m.senderId === MUSE_ID && m.attachment?.type === "sqgame");

// ---------- 1. Muse picks the game from the group's context ----------
type Plan = { topic: string; message: string; why: string };

/** Everything Muse looks at, as plain data (also the cache key). */
function groupContext(convId: string) {
  const c = getConversation(convId)!;
  const people = members(convId).map((id) => {
    const u = user(id);
    return {
      name: first(id),
      lives: u?.location,
      bio: u?.bio,
      interests: u?.interests,
      recentPosts: postsBy(id).slice(0, 3).map((p) => (p.location ? `${p.text} (at ${p.location})` : p.text)),
    };
  });
  // Context Engine taxonomy: which interests how many of them share
  const counts = new Map<TopicId, number>();
  for (const id of members(convId)) {
    const u = user(id);
    const text = [u?.bio, ...(u?.interests ?? []), ...postsBy(id).map((p) => p.text)].join(" · ");
    for (const t of new Set(topicsOfText(text))) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const sharedInterests = [...counts].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${topic(t).label}: ${n} of ${people.length}`);
  const recentChat = c.messages.filter((m) => m.senderId !== MUSE_ID && m.text && !m.attachment).slice(-12).map((m) => `${first(m.senderId)}: ${m.text}`);
  return { people, sharedInterests, recentChat };
}

const PLAN_SYSTEM = `You are Muse, a friendly game-master bot in a Messenger group chat of friends.
Pick ONE topic for a round of Deep Cuts, a party game where everyone names things in a category and rarer answers score more.
Rules for the topic:
- It must be something EVERY person in the chat shares or would enjoy (for example the city or area they all live in, or an interest all of them have), never something only some of them are into.
- Broad and fun enough that everyone can instantly name a few things.
- 1-4 plain words, the way a person would say it (e.g. "San Francisco", "90s movies", "Tacos").
Then write "message": what you send to the chat with the game. Casual group-chat voice, mostly lowercase, at most 220 characters, mention 1-2 specific things from their profiles, posts or chat that made you pick it, then invite them to play. No hashtags, no quotes around it.
And "why": one short sentence for the presenter explaining which data led to the pick.`;

async function planGame(convId: string): Promise<Plan> {
  const ctx = groupContext(convId);
  const key = createHash("sha1").update(JSON.stringify(ctx)).digest("hex").slice(0, 16);
  const file = join(PLAN_DIR, `plan-${key}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as Plan;
  const fallback = (): Plan => {
    const city = mostCommon(ctx.people.map((p) => p.lives?.split(",")[0]).filter(Boolean) as string[]) ?? "Trivia";
    return { topic: city, message: `you all live around ${city}... so who actually knows it best? made you a deep cuts round, rarer answers score more 👀`, why: `Everyone's profile is in or near ${city}.` };
  };
  let plan: Plan;
  if (ai.mode() !== "live") return fallback();
  else {
    try {
      const { data } = await ai.json<Plan>(`Group chat context:\n${JSON.stringify(ctx, null, 1)}`, {
        task: "demo.muse-pick-game",
        system: PLAN_SYSTEM,
        temperature: 0,
        maxTokens: 4000, // the model reasons first; a small budget leaves nothing for the answer
        schema: {
          type: "object",
          properties: { topic: { type: "string", description: "1-4 words" }, message: { type: "string" }, why: { type: "string" } },
          required: ["topic", "message", "why"],
        },
      });
      if (!data.topic?.trim() || !data.message?.trim()) throw new Error("empty answer");
      plan = { topic: data.topic.trim().slice(0, 40), message: data.message.trim().slice(0, 280), why: data.why?.trim() ?? "" };
    } catch (e) {
      // not cached, so the next open tries the model again
      console.error(`[muse] pick failed, using fallback: ${(e as Error).message}`);
      return fallback();
    }
  }
  mkdirSync(PLAN_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(plan, null, 2));
  return plan;
}
const mostCommon = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])[0]?.[0];

/** Creates the Deep Cuts room on the game server; generates the game first if this topic is new (about a minute). */
async function createGame(topicText: string): Promise<string> {
  const r = await fetch(`${SQ}/api/x/new`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ interest: topicText }) });
  const j = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!r.ok || !j.id) throw new Error(j.error ?? `game server ${r.status}`);
  return j.id;
}

let kicking: Promise<void> | null = null;
/** Starts Muse's game (once). Returns right away; the chat picks up Muse's messages as they land. */
export function kickoffDemo(convId: string): { status: "posted" | "making" | "skipped" } {
  if (convId !== DEMO_CHAT || !getConversation(convId)) return { status: "skipped" };
  if (museGame(convId)) return { status: "posted" };
  // 5 judges can open the chat in the same second: only one run
  kicking ??= (async () => {
    const plan = await planGame(convId);
    const c = getConversation(convId)!;
    if (!c.messages.some((m) => m.senderId === MUSE_ID)) sendMessage(convId, MUSE_ID, plan.message);
    const id = await createGame(plan.topic);
    if (!museGame(convId)) sendMessage(convId, MUSE_ID, `🎮 Deep Cuts: ${plan.topic}`, { type: "sqgame", ref: id });
  })()
    .catch((e) => console.error(`[muse] couldn't start the game: ${(e as Error).message}`))
    .finally(() => (kicking = null));
  return { status: "making" };
}

/** Before the demo: let Muse pick and generate the game now, so it's instant when judges open the chat. */
export async function warmDemo(convId = DEMO_CHAT) {
  const t0 = Date.now();
  const plan = await planGame(convId);
  await createGame(plan.topic);
  return { ...plan, seconds: Math.round((Date.now() - t0) / 1000) };
}

// ---------- 2. Muse suggests a plan once most of the group has played ----------
/** Topics someone is into, from their profile and their own posts. */
function topicsOf(userId: string): Set<TopicId> {
  const u = user(userId);
  const text = [u?.bio, ...(u?.interests ?? []), ...postsBy(userId).map((p) => p.text)].join(" · ");
  return new Set(topicsOfText(text));
}

let suggesting = false;
export function afterDemoMessage(convId: string) {
  if (convId !== DEMO_CHAT || suggesting) return;
  const c = getConversation(convId);
  const game = museGame(convId);
  if (!c || !game || c.messages.some((m) => m.senderId === MUSE_ID && m.attachment?.type === "event")) return;
  const people = members(convId);
  const finished = new Set(c.messages.filter((m) => m.attachment?.type === "sqgamelog" && m.attachment.ref === game.attachment!.ref).map((m) => m.senderId));
  if (finished.size < Math.ceil(people.length / 2)) return;
  suggesting = true;
  try {
    // the event the most people in the chat are into
    const interests = new Map(people.map((p) => [p, topicsOf(p)]));
    const ranked = DEMO_EVENT_IDS.map((id) => db().events.find((e) => e.id === id)!)
      .filter(Boolean)
      .map((e) => {
        const ts = topicsOfEvent(e);
        const fans = people.filter((p) => ts.some((t) => interests.get(p)!.has(t)));
        return { e, fans, t: ts.find((t) => fans.some((p) => interests.get(p)!.has(t))) };
      })
      .sort((a, b) => b.fans.length - a.fans.length || a.e.startsAt.localeCompare(b.e.startsAt));
    const best = ranked[0];
    if (!best) return;
    const { e, fans, t } = best;
    const others = people.filter((p) => !fans.includes(p));
    const place = e.location.replace(/ (Lookout|Park|Trailhead)$/, "");
    const talkedAboutIt = c.messages.some((m) => m.senderId !== MUSE_ID && m.text.toLowerCase().includes(place.toLowerCase()));
    const when = new Date(e.startsAt).toLocaleString("en-US", { timeZone: TZ, weekday: "long", hour: "numeric", minute: "2-digit" }).replace(":00", "");
    const into = t === "outdoors" ? "hike" : t ? `are into ${topic(t as TopicId).label}` : "are into this";
    const lines = [
      `GG everyone 🎉 ${finished.size} of you played.`,
      `Plan for this week? ${list(fans.map(first))} ${fans.length > 1 ? "all " : ""}${into}${talkedAboutIt ? `, and you've been talking about ${place} all week 👀` : "."}`,
      `${e.title}: ${when}, ${e.price?.toLowerCase() === "free" ? "free" : e.price}.${t === "outdoors" && others.length ? ` ${list(others.map(first))}: it's mostly flat, promise 😉` : ""}`,
    ];
    sendMessage(convId, MUSE_ID, lines.join("\n"));
    sendMessage(convId, MUSE_ID, "", { type: "event", ref: e.id });
  } finally {
    suggesting = false;
  }
}
