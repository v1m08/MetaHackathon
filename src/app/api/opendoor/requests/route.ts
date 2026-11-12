// GET → the acting user's Open Door requests, as traveler and as host, redacted for their role.
import { requestsFor, viewRequest } from "@/lib/travel/negotiate";
import { route } from "@/server/http";

export const GET = route((_req, { userId }) => ({ requests: requestsFor(userId).map((r) => viewRequest(userId, r)).filter(Boolean) }));
