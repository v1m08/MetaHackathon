import { route } from "@/server/http";
import { getOrCreateDM } from "@/server/db";
export const POST = route<{ userId: string }>((_req, { userId, params }) => ({ id: getOrCreateDM(userId, params.userId).id }));
