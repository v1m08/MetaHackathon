import { route } from "@/server/http";
import { sendMessage } from "@/server/db";
import { afterDemoMessage, museMentioned } from "@/server/demo";
import type { Message } from "@/types";
export const POST = route<{ id: string }>(async (_req, { userId, params, body }) => {
  const b = await body();
  const m = sendMessage(params.id, userId, String(b.text ?? ""), b.attachment as Message["attachment"]);
  // demo chat: Muse answers when texted, and suggests a plan once most of the group has played
  if (m.attachment?.type === "sqgamelog") afterDemoMessage(params.id);
  else if (!m.attachment) museMentioned(params.id, userId, m.text);
  return m;
});
