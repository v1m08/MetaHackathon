// Dev only (inspector and eval): POST { conversationId, format?, topic? } generates a game now, makes it today's
// game for that chat and posts its message. A replaced game nobody had played is removed along with its message;
// one that was played stays as history. The game comes back as the caller may see it (as the chat's first member
// when the caller isn't in the chat, since this is the dev path).
import { dropNow } from "@/lib/play/daily";
import { viewGame } from "@/lib/play/play";
import { FORMATS, type Format } from "@/lib/play/store";
import { isTopic } from "@/lib/play/taxonomy";
import { getConversation } from "@/server/db";
import { route } from "@/server/http";

const bad = (msg: string, status = 400) => Object.assign(new Error(msg), { status });

export const POST = route(async (_req, { userId, body }) => {
  const b = (await body()) as { conversationId?: string; format?: string; topic?: string };
  const c = b.conversationId ? getConversation(b.conversationId) : undefined;
  if (!c) throw bad("Conversation not found", 404);
  if (b.format !== undefined && !FORMATS.includes(b.format as Format)) throw bad("unknown format");
  if (b.topic !== undefined && !isTopic(b.topic)) throw bad("unknown topic");
  // The format that comes back can differ from the one asked for (Split fallback when the chat can't support it).
  const game = await dropNow(c.id, { format: b.format as Format | undefined, topic: isTopic(b.topic) ? b.topic : undefined });
  return { game: viewGame(game, c.participantIds.includes(userId) ? userId : c.participantIds[0]) };
});
