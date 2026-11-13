// The daily drop: one game per chat per day, made the first time a member opens the thread that day.
// Code enforces: only participants trigger it, muted chats get nothing, a thread nobody has sent a real message in
// (empty, or holding only an unsent draft) gets nothing, concurrent loads share one generation (so one model call
// per chat per day), and a failed generation is not retried on every page load.
// When a game drops, every member is told with a "game" notification, except the one whose open made it drop.
import { getConversation, getUser, notify, sendMessage } from "@/server/db";
import type { Conversation, ID } from "@/types";
import { generateGame } from "./generate";
import { dayKey, FORMAT_LABEL, getGame, playStore, saveGame, type Format, type PlayGame } from "./store";
import type { TopicId } from "./taxonomy";

const RETRY_AFTER_MS = 10 * 60e3;
/** Has anyone actually sent something here? Until then the other side can't see the thread at all, so a game card
 *  (a visible, non-draft message) would open it for them. Earlier cards and other system lines don't count. */
export const hasStarted = (c: Conversation) => c.messages.some((m) => m.status !== "draft" && !m.system);

/** What a member calls this chat: its name, or who it is with. */
function chatNameFor(c: Conversation, memberId: ID) {
  if (c.name) return c.name;
  const others = c.participantIds.filter((id) => id !== memberId).map((id) => (getUser(id)?.name ?? id).split(" ")[0]);
  return others.length === 1 ? `your chat with ${others[0]}` : "your group chat";
}

/** Save a game as its chat's game for that day, post its card and tell the members. The card is a system line from the
 *  chat itself, not from whoever opened it. `openedBy` is the member whose open made the game drop: they are already
 *  looking at the thread, so they get no notification. */
export function postGame(game: PlayGame, openedBy?: ID): PlayGame {
  const c = getConversation(game.conversationId);
  if (!c) throw Object.assign(new Error("Conversation not found"), { status: 404 });
  saveGame(game);
  const m = sendMessage(game.conversationId, c.participantIds[0], `Today's game · ${FORMAT_LABEL[game.format]}: ${game.title}`, { type: "game", ref: game.id });
  m.system = true;
  m.readBy = [];
  game.messageId = m.id;
  // Its own type, "game": "play" stays what it was, one notification per member when the chat unlocks something.
  for (const id of c.participantIds) {
    if (id !== openedBy) notify(id, { type: "game", text: `Today's game is ready in **${chatNameFor(c, id)}**: ${game.title}`, href: `/messages/${game.conversationId}` });
  }
  return game;
}

/** Dev / eval: make a game now, replacing today's. A replaced game nobody had answered is removed with its card; a played one stays as history. */
export async function dropNow(conversationId: ID, force: { topic?: TopicId; format?: Format } = {}): Promise<PlayGame> {
  const c = getConversation(conversationId);
  if (c && !hasStarted(c)) throw Object.assign(new Error("Nobody has sent a message in this chat yet"), { status: 409 });
  const game = await generateGame(conversationId, force);
  const s = playStore();
  const old = getGame(s.byDay.get(`${conversationId}|${game.date}`) ?? "");
  if (c && old && !s.answers.get(old.id)?.size) {
    s.games.delete(old.id);
    s.events = s.events.filter((e) => e.gameId !== old.id);
    c.messages = c.messages.filter((m) => !(m.attachment?.type === "game" && m.attachment.ref === old.id));
  }
  return postGame(game);
}

export async function ensureDaily(conversationId: ID, viewerId: ID): Promise<PlayGame | null> {
  const c = getConversation(conversationId);
  const s = playStore();
  if (!c || !c.participantIds.includes(viewerId) || s.muted.has(conversationId)) return null;
  if (!hasStarted(c)) return null; // empty or draft-only thread: the other side cannot see it yet (not a failure: it drops once someone writes)
  const key = `${conversationId}|${dayKey()}`;
  const today = () => { const id = s.byDay.get(key); return id ? getGame(id) ?? null : null; };
  const have = today();
  if (have) return have;
  const running = s.pending.get(key);
  if (running) return running;
  if (Date.now() - (s.failed.get(key) ?? 0) < RETRY_AFTER_MS) return null;
  const job = (async () => {
    try {
      const game = await generateGame(conversationId);
      // Someone may have dropped a game (dev route) or muted the chat while the model was writing.
      const raced = today();
      if (raced) return raced;
      if (playStore().muted.has(conversationId) || !game.rounds.length) { if (!game.rounds.length) s.failed.set(key, Date.now()); return null; }
      return postGame(game, viewerId);
    } catch (err) {
      console.error("[play] daily game failed:", (err as Error).message);
      s.failed.set(key, Date.now());
      return null;
    } finally {
      s.pending.delete(key);
    }
  })();
  s.pending.set(key, job);
  return job;
}
