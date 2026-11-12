import { route } from "@/server/http";
import { sendFriendRequest } from "@/server/db";
export const POST = route(async (_req, { userId, body }) => { sendFriendRequest(userId, String((await body()).toId)); });
