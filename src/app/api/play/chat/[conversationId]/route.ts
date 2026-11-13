// GET the chat's interaction score, streak, top topics, the viewer's own topics and its unlocks.
// POST { action: mute | unmute }: any member can turn games off for the chat.
import { chatView, setMuted } from "@/lib/play/play";
import { route } from "@/server/http";

export const GET = route<{ conversationId: string }>((_req, { userId, params }) => chatView(params.conversationId, userId));

export const POST = route<{ conversationId: string }>(async (_req, { userId, params, body }) => {
  const { action } = (await body()) as { action?: string };
  if (action !== "mute" && action !== "unmute") throw Object.assign(new Error("unknown action"), { status: 400 });
  return setMuted(params.conversationId, userId, action === "mute");
});
