import { route } from "@/server/http";
import { markNotificationsRead } from "@/server/db";
export const POST = route(async (_req, { userId, body }) => {
  const b = await body();
  markNotificationsRead(userId, b.ids as string[] | undefined);
});
