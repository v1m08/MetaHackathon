// GET today's game for this chat as the viewer may see it. Creates it on the first load of the day (once per chat per day).
import { ensureDaily } from "@/lib/play/daily";
import { viewGame } from "@/lib/play/play";
import { route } from "@/server/http";

export const GET = route<{ conversationId: string }>(async (_req, { userId, params }) => {
  const game = await ensureDaily(params.conversationId, userId);
  return { game: game ? viewGame(game, userId) : null };
});
