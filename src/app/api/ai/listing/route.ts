import { route } from "@/server/http";
import { draftListing } from "@/lib/ai/features";
export const POST = route(async (_req, { userId, body }) => draftListing(userId, String((await body()).hint ?? "")));
