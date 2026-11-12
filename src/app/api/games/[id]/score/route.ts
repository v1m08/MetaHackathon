import { route } from "@/server/http";
import { submitScore } from "@/server/db";
export const POST = route<{ id: string }>(async (_req, { userId, params, body }) => {
  const b = await body();
  return submitScore(params.id, userId, Number(b.score), b.lowerIsBetter === true);
});
