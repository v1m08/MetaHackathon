import { route } from "@/server/http";
import { groupDigest } from "@/lib/ai/features";
export const POST = route(async (_req, { userId, body }) => groupDigest(userId, String((await body()).groupId)));
