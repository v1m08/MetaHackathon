import { route } from "@/server/http";
import { cardFor, notificationsFor } from "@/server/db";
export const GET = route((_req, { userId }) => notificationsFor(userId).map((n) => ({ ...n, actor: n.actorId ? cardFor(n.actorId) : undefined })));
