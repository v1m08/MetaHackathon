import { route } from "@/server/http";
import { sendMessage } from "@/server/db";
import type { Message } from "@/types";
export const POST = route<{ id: string }>(async (_req, { userId, params, body }) => {
  const b = await body();
  return sendMessage(params.id, userId, String(b.text ?? ""), b.attachment as Message["attachment"]);
});
