// GET: today's one unprompted nudge for the viewer (the feed strip and the notification), or null.
import { dailyNudge } from "@/lib/reconnect/whynow";
import { route } from "@/server/http";

export const GET = route(async (_req, { userId }) => ({ nudge: await dailyNudge(userId) }));
