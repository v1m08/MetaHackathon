// GET one friend's streak: today for each of you and the last 14 days.
// POST { action: friendPlays } (demo): the friend plays today's game, so the room can show "your turn".
import { friendPlaysToday, streakDetail } from "@/lib/streaks/streaks";
import { route } from "@/server/http";

export const GET = route<{ friendId: string }>((_req, { userId, params }) => streakDetail(userId, params.friendId));

export const POST = route<{ friendId: string }>(async (_req, { userId, params, body }) => {
  const { action } = (await body()) as { action?: string };
  if (action !== "friendPlays") throw Object.assign(new Error("unknown action"), { status: 400 });
  return friendPlaysToday(userId, params.friendId);
});
