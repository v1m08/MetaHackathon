import { route } from "@/server/http";
import { kickoffDemo } from "@/server/demo";
// Called when someone opens the demo group chat: Muse picks and sends the group its game (once, in the background).
export const POST = route(async (_req, { body }) => {
  const b = await body();
  return kickoffDemo(String(b.conversationId ?? ""));
});
