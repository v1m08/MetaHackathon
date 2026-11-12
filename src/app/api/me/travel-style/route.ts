// Travel style: opt-in, visible, editable. GET returns what exists (null until the user asks for it); POST
// {action:"refresh"} re-runs Muse over the user's own content; PATCH edits/removes lines; DELETE clears it.
import { clearStyle, editStyle, getStyle, inferTravelStyle } from "@/lib/travel/style";
import { route } from "@/server/http";

export const GET = route((_req, { userId }) => ({ style: getStyle(userId) }));
export const POST = route(async (_req, { userId }) => ({ style: await inferTravelStyle(userId) }));
export const PATCH = route(async (_req, { userId, body }) => ({ style: editStyle(userId, (await body()) as { lines?: { id: string; text?: string; label?: string }[]; remove?: string[] }) }));
export const DELETE = route((_req, { userId }) => { clearStyle(userId); return { style: null }; });
