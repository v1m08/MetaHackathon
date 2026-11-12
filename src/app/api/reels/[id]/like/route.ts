import { route } from "@/server/http";
import { toggleReel } from "@/server/db";
export const POST = route<{ id: string }>((_req, { userId, params }) => ({ liked: toggleReel(params.id, userId, "likes").likes.includes(userId) }));
