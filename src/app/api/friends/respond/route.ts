import { route } from "@/server/http";
import { respondFriendRequest } from "@/server/db";
export const POST = route(async (_req, { userId, body }) => { const b = await body(); respondFriendRequest(userId, String(b.fromId), b.accept !== false); });
