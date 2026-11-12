// POST { action: accept | decline | confirm } on one request. Role (traveler/host) is derived from the viewer.
import { actOnRequest } from "@/lib/travel/negotiate";
import { route } from "@/server/http";

export const POST = route<{ id: string }>(async (_req, { userId, params, body }) => {
  const { action } = (await body()) as { action?: "accept" | "decline" | "confirm" };
  if (!action || !["accept", "decline", "confirm"].includes(action)) throw Object.assign(new Error("action must be accept, decline or confirm"), { status: 400 });
  return actOnRequest(userId, params.id, action);
});
