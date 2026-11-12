// POST { action: "approve" | "edit" | "discard", text? } on a drafted message. Only the sender can act on it.
import { actOnDraft } from "@/lib/travel/coordinate";
import { route } from "@/server/http";

export const POST = route<{ id: string }>(async (_req, { userId, params, body }) => {
  const b = (await body()) as { action?: "approve" | "edit" | "discard"; text?: string };
  if (!b.action) throw Object.assign(new Error("action required"), { status: 400 });
  return actOnDraft(userId, params.id, b.action, b.text);
});
