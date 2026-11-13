// Playing a game: what a member may see of it, and what happens when they act.
// Code enforces:
//   - only members of the chat can see or play its game (404 otherwise)
//   - the right answer, the cited sources and everyone else's answers stay hidden until the viewer has finished
//   - every choice is checked against the round (real option ids; a rank is a permutation; points are whole,
//     non-negative and sum to 10; a split has a pick and a prediction); nothing can be changed after finishing
//   - a viewer gets the chat's topics (names and game counts, never a number another member's score could be
//     solved from) and their own topic numbers; in a chat of two, only the topics the chat has actually played
//   - until the viewer has finished today's game, nobody's picks in it move anything the viewer is shown
import { db, getConversation, getUser } from "@/server/db";
import type { ID } from "@/types";
import { maybeUnlock, rankInventory, unlockFacts, viewUnlock } from "./recommend";
import { answerOf, performance, roundResults } from "./results";
import { affinityFor, chatScore, engagement, THRESHOLDS } from "./score";
import { answersFor, completedBy, dayKey, eventsFor, FORMAT_LABEL, gamesIn, getGame, logEvent, playStore, setAnswer, unlocksIn, type Choice, type PlayGame, type Round, type UnlockTier } from "./store";
import { TOPIC_IDS, topicLabel } from "./taxonomy";
import type { ChatView, GameView, MemberCard, UnlockView } from "./views";

const fail = (status: number, msg: string) => Object.assign(new Error(msg), { status });
const round2 = (n: number) => Math.round(n * 100) / 100;
const card = (id: ID): MemberCard => { const u = getUser(id); const name = u?.name ?? id; return { id, name, first: name.split(" ")[0], avatar: u?.avatar ?? "" }; };
function membersOf(conversationId: ID, viewerId: ID, what = "Conversation") {
  const c = getConversation(conversationId);
  if (!c || !c.participantIds.includes(viewerId)) throw fail(404, `${what} not found`);
  return c;
}

export function viewGame(game: PlayGame, viewerId: ID): GameView {
  const c = membersOf(game.conversationId, viewerId, "Game");
  const finished = completedBy(game.id);
  const done = finished.has(viewerId);
  // Until the viewer is done: no answer, and no source ids (an interest id names its owner, which would give Receipts away).
  const rounds: Round[] = game.rounds.map(({ answer: _answer, ...r }) => (done ? { ...r, answer: answerOf(game, { ...r, answer: _answer }) } : { ...r, evidenceIds: [] }));
  const reacted = eventsFor(game.id).filter((e) => e.kind === "react" && e.userId === viewerId).at(-1)?.choice;
  return {
    id: game.id, conversationId: game.conversationId, date: game.date, format: game.format, formatLabel: FORMAT_LABEL[game.format], topic: game.topic, topicLabel: topicLabel(game.topic),
    title: game.title, premise: game.premise, rounds,
    subject: game.subjectId ? card(game.subjectId) : undefined,
    iAmSubject: game.format === "hotseat" && game.subjectId === viewerId,
    members: c.participantIds.map(card),
    mine: { ...(answersFor(game.id).get(viewerId) ?? {}) },
    done,
    players: c.participantIds.filter((id) => finished.has(id)).map(card),
    memberCount: c.participantIds.length,
    results: done ? roundResults(game) : undefined,
    performance: done ? performance(game, viewerId) : undefined,
    madeFrom: done ? game.evidence.map((e) => ({ id: e.id, kind: e.kind, by: e.by ? card(e.by).first : undefined, text: e.text })) : undefined,
    mode: game.mode,
    reacted: typeof reacted === "string" ? reacted : undefined,
  };
}

/** Checks a choice against its round and returns it rebuilt from known keys only. Throws 400 with the reason. */
export function checkChoice(r: Round, choice: unknown): Choice {
  const ids = new Set(r.options.map((o) => o.id));
  const isId = (x: unknown): x is string => typeof x === "string" && ids.has(x);
  if (r.kind === "pick") {
    if (!isId(choice)) throw fail(400, "Pick one of the options");
    return choice;
  }
  if (r.kind === "split") {
    const c = choice as { pick?: unknown; predict?: unknown } | null;
    if (!c || typeof c !== "object" || Array.isArray(c) || !isId(c.pick) || !isId(c.predict)) throw fail(400, "A split needs your pick and your prediction");
    return { pick: c.pick, predict: c.predict };
  }
  if (r.kind === "rank") {
    if (!Array.isArray(choice) || choice.length !== ids.size || !choice.every(isId) || new Set(choice).size !== ids.size) throw fail(400, "Rank every option exactly once");
    return [...choice] as string[];
  }
  if (!choice || typeof choice !== "object" || Array.isArray(choice)) throw fail(400, "Spread 10 points across the options");
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(choice as Record<string, unknown>)) {
    if (!ids.has(k) || typeof v !== "number" || !Number.isInteger(v) || v < 0) throw fail(400, "Points must be whole, non-negative and on real options");
    out[k] = v;
  }
  if (Object.values(out).reduce((s, x) => s + x, 0) !== 10) throw fail(400, "Points must add up to 10");
  return out;
}

export interface ActBody { action: "open" | "answer" | "skip" | "complete" | "react"; roundId?: string; choice?: Choice; ms?: number; emoji?: string }
export async function act(gameId: string, userId: ID, body: ActBody): Promise<{ game: GameView; unlock?: UnlockView }> {
  const game = getGame(gameId);
  if (!game) throw fail(404, "Game not found");
  membersOf(game.conversationId, userId, "Game");
  const base = { gameId, conversationId: game.conversationId, userId };
  const done = completedBy(gameId).has(userId);
  const roundOf = () => { const r = game.rounds.find((x) => x.id === body.roundId); if (!r) throw fail(400, "Unknown round"); return r; };
  let unlock: UnlockView | undefined;
  // Anything that can move the chat score checks for an unlock; the action itself stands whatever happens here.
  const tryUnlock = async () => {
    try { const u = await maybeUnlock(game.conversationId); if (u) unlock = viewUnlock(u, userId); }
    catch (err) { console.error("[play] unlock check failed:", (err as Error).message); }
  };
  switch (body.action) {
    case "open":
      if (!eventsFor(gameId).some((e) => e.kind === "open" && e.userId === userId)) logEvent({ ...base, kind: "open" });
      break;
    case "answer": {
      if (done) throw fail(409, "You already finished this game");
      const r = roundOf();
      const choice = checkChoice(r, body.choice);
      const pickId = typeof choice === "string" ? choice : !Array.isArray(choice) && typeof (choice as { pick?: unknown }).pick === "string" ? (choice as { pick: string }).pick : undefined;
      const changed = setAnswer(gameId, userId, r.id, choice);
      const ms = typeof body.ms === "number" && Number.isFinite(body.ms) ? Math.max(0, Math.min(600_000, Math.round(body.ms))) : undefined;
      logEvent({ ...base, roundId: r.id, kind: changed ? "change" : "answer", choice, topic: r.options.find((o) => o.id === pickId)?.topic ?? game.topic, ms });
      break;
    }
    case "skip": {
      if (done) throw fail(409, "You already finished this game");
      logEvent({ ...base, roundId: roundOf().id, kind: "skip" });
      break;
    }
    case "complete": {
      if (done) break; // idempotent
      if (!Object.keys(answersFor(gameId).get(userId) ?? {}).length) throw fail(400, "Answer at least one round first");
      logEvent({ ...base, kind: "complete", topic: game.topic });
      await tryUnlock();
      break;
    }
    case "react": {
      if (!done) throw fail(409, "Finish the game to react to the results");
      const emoji = typeof body.emoji === "string" ? body.emoji.trim() : "";
      if (!emoji || [...emoji].length > 4) throw fail(400, "Send one emoji");
      logEvent({ ...base, kind: "react", choice: emoji });
      await tryUnlock(); // a reaction raises reciprocity, which can be what takes the chat over a threshold
      break;
    }
    default:
      throw fail(400, "unknown action");
  }
  return { game: viewGame(game, userId), unlock };
}

const TIERS = (Object.keys(THRESHOLDS) as UnlockTier[]).sort((a, b) => THRESHOLDS[a] - THRESHOLDS[b]);

export function chatView(conversationId: ID, viewerId: ID): ChatView {
  const c = membersOf(conversationId, viewerId);
  const todayGameId = playStore().byDay.get(`${conversationId}|${dayKey()}`);
  // Until the viewer has finished today's game, its answers are left out of the topics they see: otherwise a
  // number or an order that shifts when someone else finishes would tell them what that person picked.
  const hide = todayGameId && !completedBy(todayGameId).has(viewerId) ? todayGameId : undefined;
  const cs = chatScore(conversationId, Date.now(), hide);
  const mine = affinityFor(viewerId, Date.now(), hide).score; // same rule: being ranked first in a Lineup the viewer hasn't finished stays unseen
  // With two people, any figure built from both affinities gives the other person's away (the viewer knows their
  // own). So a DM lists only the topics it has played, most played first; nothing there depends on anyone's score.
  const small = c.participantIds.length < 3;
  const shown = small ? cs.topics.filter((t) => t.games > 0).sort((a, b) => b.games - a.games || a.topic.localeCompare(b.topic)) : cs.topics.filter((t) => t.score > 0);
  const unlocks = unlocksIn(conversationId);
  // The next unlock is the lowest tier this chat hasn't been given yet, whatever the score says.
  const pending = TIERS.find((t) => !unlocks.some((u) => u.tier === t));
  return {
    conversationId,
    muted: playStore().muted.has(conversationId),
    score: cs.score,
    parts: cs.parts,
    streakDays: cs.streakDays,
    games: cs.games,
    topics: shown.slice(0, 5).map((t) => ({ topic: t.topic, label: topicLabel(t.topic), games: t.games })),
    myTopics: TOPIC_IDS.map((t) => ({ topic: t, label: topicLabel(t), score: round2(mine[t]) })).filter((t) => t.score > 0).sort((a, b) => b.score - a.score).slice(0, 5),
    next: pending ? { tier: pending, at: THRESHOLDS[pending], ready: cs.earned.includes(pending) && !unlocks.some((u) => dayKey(u.createdAt) === dayKey()) } : undefined,
    thresholds: THRESHOLDS,
    unlocks: unlocks.map((u) => viewUnlock(u, viewerId)),
    todayGameId,
  };
}

/** Any member can turn games off (or back on) for the whole chat. */
export function setMuted(conversationId: ID, userId: ID, muted: boolean): ChatView {
  membersOf(conversationId, userId);
  if (muted) playStore().muted.add(conversationId);
  else playStore().muted.delete(conversationId);
  return chatView(conversationId, userId);
}

/** Everything, unfiltered, for /dev/play only. This is the demo inspector: it shows per-member numbers no product screen may. */
export function inspect(): unknown {
  const s = playStore();
  const tiers = TIERS;
  const touched = new Set<ID>([...[...s.games.values()].map((g) => g.conversationId), ...[...s.unlocks.values()].map((u) => u.conversationId), ...s.muted]);
  const chats = db().conversations.filter((c) => touched.has(c.id)).map((c) => {
    const cs = chatScore(c.id);
    return {
      conversationId: c.id,
      name: c.name ?? c.participantIds.map((id) => card(id).first).join(" & "),
      isGroup: c.isGroup,
      muted: s.muted.has(c.id),
      members: c.participantIds.map(card),
      score: cs.score, parts: cs.parts, streakDays: cs.streakDays, earned: cs.earned, next: cs.next, thresholds: THRESHOLDS,
      topics: cs.topics.filter((t) => t.score > 0 || t.games > 0).slice(0, 8).map((t) => ({ ...t, label: topicLabel(t.topic) })),
      affinity: c.participantIds.map((id) => { const a = affinityFor(id); return { user: card(id), topics: TOPIC_IDS.map((t) => ({ topic: t, score: round2(a.score[t]), observations: a.observations[t] })).filter((t) => t.score !== 0).sort((x, y) => y.score - x.score).slice(0, 6) }; }),
      games: gamesIn(c.id).map((g) => ({
        ...g,
        formatLabel: FORMAT_LABEL[g.format], topicLabel: topicLabel(g.topic),
        completed: [...completedBy(g.id)],
        answers: Object.fromEntries(answersFor(g.id)),
        engagement: c.participantIds.map((id) => ({ userId: id, ...engagement(g, id) })),
        results: roundResults(g),
        today: s.byDay.get(`${c.id}|${g.date}`) === g.id && g.date === dayKey(),
      })).reverse(),
      unlocks: unlocksIn(c.id),
      ranking: Object.fromEntries(tiers.map((t) => [t, rankInventory(c.id, t).slice(0, 5).map((x) => ({ id: x.item.id, title: x.item.title, topic: x.topic, topics: x.item.topics, score: x.score, parts: x.parts, facts: unlockFacts(c.id, x) }))])),
    };
  });
  return { chats, events: s.events.slice(-300).reverse(), totals: { games: s.games.size, events: s.events.length, unlocks: s.unlocks.size, costUsd: round2([...s.games.values()].reduce((n, g) => n + g.costUsd, 0) + [...s.unlocks.values()].reduce((n, u) => n + u.costUsd, 0)) } };
}
