import { route } from "@/server/http";
import { datingSwipe } from "@/server/db";
export const POST = route(async (_req, { userId, body }) => {
  const b = await body();
  return datingSwipe(userId, String(b.targetId), b.action === "like" ? "like" : "pass");
});
