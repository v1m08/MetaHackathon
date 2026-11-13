import { route } from "@/server/http";
import { sendMessage } from "@/server/db";
import { afterDemoMessage } from "@/server/demo";
import type { Message } from "@/types";
export const POST = route<{ id: string }>(async (_req, { userId, params, body }) => {
  const b = await body();
  const m = sendMessage(params.id, userId, String(b.text ?? ""), b.attachment as Message["attachment"]);
  // demo chat: once most of the group finishes the game, Muse suggests a plan
  if (m.attachment?.type === "sqgamelog") afterDemoMessage(params.id);
  return m;
});
