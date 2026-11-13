// Muse's post-game plans for a group chat. After a game, Muse looks at who's in this chat (public profile interests),
// what they've been playing here, and what they've been saying here, then pitches a few plans that only make sense
// for THIS group. A plan is a kit: optionally one real upcoming Facebook Event plus up to three real Marketplace
// listings that make it happen (homemade food to try together, the griddle for a cook-off, paddles for a tournament),
// with the cost split across the chat. Everything Muse names is checked in code: an id that isn't in the candidate
// list is dropped, never shown. "Make it an event" turns a plan into an invite-only Facebook Event for the chat
// with the Marketplace kit attached.
//
// Privacy: only this chat's own messages and games, members' public profile interests, and public events/listings
// (never anyone's private Marketplace saves). One Muse call per chat per game, shared by every member (cached).
import { ai } from "@/lib/ai";
import { connectionScoreFor, ingestSidequestSessions } from "@/lib/context";
import { dayStartMs } from "@/lib/context/day";
import { topicsOfEvent, topicsOfListing, topicsOfText, type TopicId } from "@/lib/context/taxonomy";
import { canSeeEvent } from "@/lib/context/visibility";
import { db, getConversation, getUser, newId } from "@/server/db";
import type { Database, FBEvent, ID, Listing } from "@/types";

export interface IdeaEvent {
  id: string;
  title: string;
  cover: string;
  startsAt: string;
}
export interface IdeaListing {
  id: string;
  title: string;
  image: string;
  price: number;
  seller: string;
}

export interface MuseIdea {
  emoji: string;
  title: string;
  pitch: string;
  /** Plan details used by "Make it an event". */
  daysFromNow: number;
  hour: number;
  where: string;
  /** The real Facebook Event this plan is built around, if any. */
  event?: IdeaEvent;
  /** Real Marketplace listings the plan uses (0-3). */
  listings: IdeaListing[];
  /** Sum of the listings' prices, and that split across everyone in the chat. */
  total: number;
  perPerson: number;
  /** Set once someone in the chat turns this plan into an event. */
  eventId?: string;
}

export interface MuseIdeas {
  chatName: string;
  intro: string;
  ideas: MuseIdea[];
  source: "muse" | "fallback";
}

export const MAX_KIT_LISTINGS = 3;
const DAY = 864e5;
const g = globalThis as unknown as { __museIdeas?: WeakMap<Database, Map<string, Promise<MuseIdeas>>> };
function cache() {
  g.__museIdeas ??= new WeakMap();
  const d = db();
  let m = g.__museIdeas.get(d);
  if (!m) g.__museIdeas.set(d, (m = new Map()));
  return m;
}
const first = (id: ID) => getUser(id)?.name.split(" ")[0] ?? id;
const isFood = (l: Listing) => topicsOfListing(l).includes("food" as TopicId);

/** Builds the context Muse sees. Exported for tests and the Inspector. */
export function ideasContext(conversationId: ID, gameRef: string, now = Date.now()) {
  const c = getConversation(conversationId);
  if (!c) throw Object.assign(new Error("Conversation not found"), { status: 404 });
  const members = c.participantIds;
  const events = db()
    .events.filter((e) => new Date(e.startsAt).getTime() > now && members.every((m) => canSeeEvent(m, e)))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  // Buying from someone in the chat isn't a discovery, so members' own listings stay out of the kits.
  const listings = db().listings.filter((l) => l.status === "available" && !members.includes(l.sellerId));
  const sessions = ingestSidequestSessions().filter((s) => s.conversationId === c.id);
  const game = sessions.find((s) => s.ref === gameRef);
  const score = connectionScoreFor(c.id, undefined, now);
  const chatTopics = score.topics.filter((t) => t.settled).map((t) => t.topic);
  const recentGames = [...new Set(sessions.map((s) => s.title || s.interest).filter(Boolean))].slice(-8);
  const plain = c.messages.filter((m) => !m.attachment && m.text);
  const chatLines = plain.slice(-24).map((m) => `${first(m.senderId)}: ${m.text}`);
  // "New to this chat": nothing the chat has played or said mentions it. Those are the fun ones to try together.
  const said = `${recentGames.join(" ")} ${plain.map((m) => m.text).join(" ")}`.toLowerCase();
  const isNew = (l: Listing) => !l.title.toLowerCase().split(/[^a-z']+/).some((w) => w.length > 4 && said.includes(w));
  return {
    chatName: c.name ?? members.map(first).join(", "),
    members: members.map((id) => ({ id, name: first(id), interests: getUser(id)?.interests ?? [] })),
    game: game ? { title: game.title || game.interest, interest: game.interest } : undefined,
    recentGames,
    chatTopics,
    streakDays: score.streak.days,
    /** 0..1 from the Connection Score: is this chat already talking about meeting up? */
    planning: score.planning,
    chatLines,
    events,
    listings: listings.map((l) => ({ l, food: isFood(l), fresh: isNew(l) })),
  };
}
type Ctx = ReturnType<typeof ideasContext>;

const SCHEMA = {
  type: "object",
  properties: {
    intro: { type: "string", description: "One warm line from Muse to the group, under 90 characters, mentions the game they just played" },
    ideas: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          emoji: { type: "string" },
          title: { type: "string", description: "Catchy plan name, under 40 characters" },
          pitch: { type: "string", description: "Why this is perfect for THIS group and who does what, naming people and jokes from the chat. Under 190 characters." },
          eventId: { type: "string", description: "Exact id of one Event from the list, or empty string" },
          listingIds: { type: "array", maxItems: MAX_KIT_LISTINGS, items: { type: "string" }, description: "Exact ids of 0-3 Marketplace listings the plan uses" },
          daysFromNow: { type: "integer", minimum: 1, maximum: 14 },
          hour: { type: "integer", minimum: 7, maximum: 22, description: "Start hour, 24h, Austin time" },
          where: { type: "string", description: "A real-sounding Austin spot or a member's place, under 40 characters" },
        },
        required: ["emoji", "title", "pitch", "eventId", "listingIds", "daysFromNow", "hour", "where"],
      },
    },
  },
  required: ["intro", "ideas"],
};

type RawIdea = { emoji: string; title: string; pitch: string; eventId?: string; listingIds?: string[]; daysFromNow: number; hour: number; where: string };
type Raw = { intro: string; ideas: RawIdea[] };

function prompt(ctx: Ctx) {
  const ev = ctx.events.map((e) => `- ${e.id} | ${e.title} | ${new Date(e.startsAt).toDateString()} | ${e.location} | ${e.category}${e.price ? ` | ${e.price}` : ""}`).join("\n");
  const ls = ctx.listings
    .map(({ l, food, fresh }) => `- ${l.id} | ${l.title} | $${l.price} | ${l.category}${food ? " (food)" : ""}${fresh ? " | new to this chat" : ""} | from ${first(l.sellerId)}, ${l.location}`)
    .join("\n");
  const n = ctx.members.length;
  return `You are Muse inside Facebook Messenger. A group chat of ${n} just finished a game together. Pitch exactly 3 fun, unexpected plans that only make sense for THIS group: use their names, their interests, the games they keep playing, and jokes from the chat. Give people roles. Avoid generic ideas ("grab dinner", "go to a concert").

Each plan is a kit made of real things on Facebook: optionally ONE upcoming Event, plus 0-3 Marketplace listings the group would buy and split.

Rules:
- Plan 1, "try it together": pick 2 or 3 FOOD listings from Marketplace that are new to this chat, ideally from different cuisines, and turn them into a tasting the group does together (blind taste-off, ranking bracket, potluck twist). Set listingIds, leave eventId empty.
- Plan 2, "event plus": build on one real upcoming Event (set eventId) and add 1 or 2 Marketplace listings that make it better for this group.
- Plan 3, wildcard: an original plan for this group. It may use any listings (food or gear) or none.
- ${ctx.planning >= 0.3 ? "This chat is already making plans in the messages below. At least one plan should upgrade what they are already planning rather than replace it." : "The chat has not planned anything yet, so make the first step easy."}
- Only use ids that appear in the lists, exactly as written. Never invent listings, sellers or prices. Do not use the same listing in two plans.
- Friendly, playful and safe. No alcohol-centered plans.

Chat: ${ctx.chatName}
Members (public interests): ${ctx.members.map((m) => `${m.name} (${m.interests.join(", ")})`).join("; ")}
Game just played: ${ctx.game?.title ?? "a game"}${ctx.game?.interest ? ` (${ctx.game.interest})` : ""}
Games this chat has played lately: ${ctx.recentGames.join(", ") || "none"}
What the chat keeps coming back to: ${ctx.chatTopics.join(", ") || "unclear"}; ${ctx.streakDays}-day game streak
Recent messages in this chat:
${ctx.chatLines.join("\n")}

Upcoming Facebook Events (id | title | date | place | category):
${ev || "(none)"}

Marketplace listings near them (id | title | price | category | notes | seller):
${ls || "(none)"}`;
}

const clampInt = (n: unknown, lo: number, hi: number, dflt: number) => (Number.isFinite(Number(n)) ? Math.max(lo, Math.min(hi, Math.round(Number(n)))) : dflt);
const eventOf = (e: FBEvent): IdeaEvent => ({ id: e.id, title: e.title, cover: e.cover, startsAt: e.startsAt });
const listingOf = (l: Listing): IdeaListing => ({ id: l.id, title: l.title, image: l.images[0], price: l.price, seller: first(l.sellerId) });

function kit(ctx: Ctx, base: Omit<MuseIdea, "listings" | "total" | "perPerson">, listings: Listing[]): MuseIdea {
  const total = listings.reduce((s, l) => s + l.price, 0);
  return { ...base, listings: listings.map(listingOf), total, perPerson: Math.ceil((total / Math.max(1, ctx.members.length)) * 100) / 100 };
}

/**
 * Keeps only what's real: an idea that names an event or listing that isn't a candidate is dropped whole (it would
 * describe something that doesn't exist); a listing already used by an earlier plan is removed from the later one.
 * Exported for tests.
 */
export function validateIdeas(raw: Raw, ctx: Ctx): MuseIdea[] {
  const out: MuseIdea[] = [];
  const used = new Set<string>();
  for (const r of raw.ideas ?? []) {
    if (!r?.title || !r?.pitch) continue;
    const eventId = String(r.eventId ?? "").trim();
    const event = eventId ? ctx.events.find((e) => e.id === eventId) : undefined;
    if (eventId && !event) continue;
    const ids = [...new Set((Array.isArray(r.listingIds) ? r.listingIds : []).map((x) => String(x).trim()).filter(Boolean))];
    const found = ids.map((id) => ctx.listings.find((x) => x.l.id === id)?.l);
    if (found.some((l) => !l)) continue;
    const listings = (found as Listing[]).filter((l) => !used.has(l.id)).slice(0, MAX_KIT_LISTINGS);
    listings.forEach((l) => used.add(l.id));
    out.push(
      kit(
        ctx,
        {
          emoji: String(r.emoji || "✨").slice(0, 4),
          title: String(r.title).slice(0, 60),
          pitch: String(r.pitch).slice(0, 240),
          daysFromNow: clampInt(r.daysFromNow, 1, 14, 3),
          hour: clampInt(r.hour, 7, 22, 18),
          where: String(r.where || "TBD").slice(0, 60),
          event: event ? eventOf(event) : undefined,
        },
        listings,
      ),
    );
  }
  return out.slice(0, 3);
}

/** Deterministic plans from real inventory, used without a key or if Muse is slow or fails. */
export function fallbackIdeas(ctx: Ctx): MuseIdeas {
  const names = ctx.members.map((m) => m.name);
  const fits = (topics: TopicId[]) => topics.some((t) => ctx.chatTopics.includes(t));
  const ideas: MuseIdea[] = [];
  const used = new Set<string>();
  const take = (ls: Listing[]) => {
    ls.forEach((l) => used.add(l.id));
    return ls;
  };

  // 1. Try it together: up to three food listings, new to the chat first, one per seller, cheapest first.
  const foods = ctx.listings.filter((x) => x.food).sort((a, b) => Number(b.fresh) - Number(a.fresh) || a.l.price - b.l.price);
  const tasting: Listing[] = [];
  for (const { l } of foods) if (tasting.length < MAX_KIT_LISTINGS && !tasting.some((t) => t.sellerId === l.sellerId)) tasting.push(l);
  if (tasting.length >= 2)
    ideas.push(
      kit(
        ctx,
        {
          emoji: "🍽️",
          title: "Blind taste-off night",
          pitch: `Three homemade finds off Marketplace, nobody knows who made what. ${names[0]} hosts, ${names[1] ?? "someone"} keeps score, lowest score does dishes.`,
          daysFromNow: 3,
          hour: 18,
          where: `${names[0]}'s place`,
        },
        take(tasting),
      ),
    );

  // 2. Event plus: the soonest event that fits what the chat plays, with one listing that goes with it.
  const ev = ctx.events.find((e) => fits(topicsOfEvent(e))) ?? ctx.events[0];
  if (ev) {
    const evTopics = topicsOfEvent(ev);
    // Only something that matches on a topic this chat actually plays (not an incidental one the event also has),
    // food first, cheapest first. Nothing fits: the plan is just the event.
    const shared = evTopics.filter((t) => ctx.chatTopics.includes(t));
    const extra = ctx.listings
      .filter((x) => !used.has(x.l.id) && topicsOfListing(x.l).some((t) => shared.includes(t)))
      .sort((a, b) => Number(b.food) - Number(a.food) || a.l.price - b.l.price)[0];
    ideas.push(
      kit(
        ctx,
        {
          emoji: "📍",
          title: `${ev.title.split(/[(:+]/)[0].trim()}, as a crew`,
          pitch: `Go together${extra ? ` and bring ${extra.l.title.split(/[,(:]/)[0].trim()} to share` : ""}. ${names.slice(0, 2).join(" and ")} pick the after spot.`,
          daysFromNow: Math.max(1, Math.round((new Date(ev.startsAt).getTime() - Date.now()) / DAY)),
          hour: 11,
          where: ev.location,
          event: eventOf(ev),
        },
        extra ? take([extra.l]) : [],
      ),
    );
  }

  // 3. Wildcard: a group championship, with a piece of gear if there's one that fits.
  const gear = ctx.listings.find((x) => !used.has(x.l.id) && !x.food && fits(topicsOfListing(x.l)));
  ideas.push(
    kit(
      ctx,
      {
        emoji: "🏆",
        title: `${ctx.chatName.replace(/[^\w\s']/g, "").trim()} championship`,
        pitch: `Your ${ctx.streakDays}-day streak deserves a trophy. Everyone cooks one dish${gear ? ` on ${gear.l.title.split(/[,(:+]/)[0].trim()}` : ""}, the chat votes, the winner picks next week's game.`,
        daysFromNow: 6,
        hour: 17,
        where: `${names[names.length - 1]}'s backyard`,
      },
      gear ? take([gear.l]) : [],
    ),
  );
  return { chatName: ctx.chatName, intro: `Good game! A few plans that feel very ${ctx.chatName}.`, ideas, source: "fallback" };
}

async function generate(conversationId: ID, gameRef: string, userId: ID): Promise<MuseIdeas> {
  const ctx = ideasContext(conversationId, gameRef);
  const fallback = fallbackIdeas(ctx);
  try {
    const once = () => ai.json<Raw>(prompt(ctx), { task: "ideas.group", userId, schema: SCHEMA, schemaName: "group_ideas", temperature: 0.9, maxTokens: 4000, reasoning: "low", mock: () => ({ intro: fallback.intro, ideas: [] }) });
    const call = once().catch(() => once()); // one retry: the venue network drops the odd request
    const { data } = await Promise.race([call, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Muse took too long")), 45_000))]);
    const ideas = validateIdeas(data, ctx);
    if (ideas.length < 2) return fallback;
    return { chatName: ctx.chatName, intro: String(data.intro || fallback.intro).slice(0, 120), ideas, source: "muse" };
  } catch {
    return fallback;
  }
}

/** Muse's plans for this chat after `gameRef`. One call per chat per game; every member gets the same plans. */
export function ideasFor(conversationId: ID, gameRef: string, userId: ID): Promise<MuseIdeas> {
  const key = `${conversationId}|${gameRef}`;
  const m = cache();
  let p = m.get(key);
  if (!p) {
    p = generate(conversationId, gameRef, userId);
    m.set(key, p);
    p.then(
      (r) => r.source === "fallback" && ai.mode() === "live" && retryLater(m, key, p!, conversationId, gameRef, userId, 1),
      () => m.delete(key),
    );
  }
  return p;
}

/**
 * Muse was down or slow, so the chat got the template plans. They're served straight away (nobody waits on a retry),
 * while Muse is tried again in the background a few times; a real answer replaces the templates for whoever opens
 * the sheet next. Once someone has made an event from a plan the list is frozen, so plan numbers never shift.
 */
const RETRY_GAPS_MS = [8_000, 20_000, 45_000];
function retryLater(m: Map<string, Promise<MuseIdeas>>, key: string, current: Promise<MuseIdeas>, conversationId: ID, gameRef: string, userId: ID, attempt: number) {
  if (attempt > RETRY_GAPS_MS.length) return;
  const timer = setTimeout(async () => {
    if (m.get(key) !== current) return; // reset, or already replaced
    const shown = await current;
    if (shown.ideas.some((i) => i.eventId)) return;
    const next = await generate(conversationId, gameRef, userId).catch(() => null);
    if (m.get(key) !== current || shown.ideas.some((i) => i.eventId)) return;
    if (next?.source === "muse") m.set(key, Promise.resolve(next));
    else retryLater(m, key, current, conversationId, gameRef, userId, attempt + 1);
  }, RETRY_GAPS_MS[attempt - 1]);
  timer.unref?.();
}

/**
 * Turns plan `index` into an invite-only Facebook Event hosted by `hostId` with the whole chat invited. Once per plan:
 * a second member tapping gets the same event back with `created: false`, so only the first tap announces it.
 */
export async function makeIdeaEvent(conversationId: ID, gameRef: string, index: number, hostId: ID): Promise<FBEvent & { created: boolean }> {
  const c = getConversation(conversationId);
  if (!c || !c.participantIds.includes(hostId)) throw Object.assign(new Error("Not in this chat"), { status: 404 });
  const ideas = await ideasFor(conversationId, gameRef, hostId);
  const idea = ideas.ideas[index];
  if (!idea) throw Object.assign(new Error("No such idea"), { status: 404 });
  if (idea.eventId) {
    const existing = db().events.find((e) => e.id === idea.eventId);
    if (existing) return { ...existing, created: false };
  }
  const anchorEvent = idea.event ? db().events.find((e) => e.id === idea.event!.id) : undefined;
  const startsAt = anchorEvent?.startsAt ?? new Date(dayStartMs() + idea.daysFromNow * DAY + idea.hour * 3600e3).toISOString();
  const cover = idea.event?.cover ?? idea.listings[0]?.image ?? db().events[0]?.cover ?? "";
  const lines = [idea.pitch];
  if (idea.event) lines.push(`Built around: ${idea.event.title}.`);
  if (idea.listings.length) lines.push(`$${idea.total} of Marketplace finds, about $${idea.perPerson.toFixed(2)} each across ${c.participantIds.length} of you.`);
  lines.push(`Planned in ${ideas.chatName} with Muse.`);
  const e: FBEvent = {
    id: newId("e"),
    title: `${idea.emoji} ${idea.title}`,
    cover,
    startsAt,
    location: anchorEvent?.location ?? idea.where,
    hostId,
    description: lines.join("\n\n"),
    going: [hostId],
    interested: [],
    invited: c.participantIds.filter((id) => id !== hostId),
    inviteOnly: true,
    category: anchorEvent?.category ?? (idea.listings.length || topicsOfText(`${idea.title} ${idea.pitch}`).includes("food" as TopicId) ? "Food & Drink" : "Party"),
    kit: idea.listings.length ? { listingIds: idea.listings.map((l) => l.id), total: idea.total, perPerson: idea.perPerson, conversationId: c.id } : undefined,
  };
  db().events.push(e);
  idea.eventId = e.id;
  return { ...e, created: true };
}
