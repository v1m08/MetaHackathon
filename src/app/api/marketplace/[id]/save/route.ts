import { route } from "@/server/http";
import { toggleSaveListing } from "@/server/db";
export const POST = route<{ id: string }>((_req, { userId, params }) => ({ saved: toggleSaveListing(params.id, userId).savedBy.includes(userId) }));
