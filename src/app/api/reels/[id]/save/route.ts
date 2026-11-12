import { route } from "@/server/http";
import { toggleReel } from "@/server/db";
export const POST = route<{ id: string }>((_req, { userId, params }) => ({ saved: toggleReel(params.id, userId, "savedBy").savedBy.includes(userId) }));
