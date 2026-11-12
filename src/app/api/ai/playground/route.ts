import { route } from "@/server/http";
import { playground } from "@/lib/ai/features";
export const POST = route(async (_req, { userId, body }) => {
  const b = await body();
  const kind = (b.kind as "text" | "json" | "image" | "tools") ?? "text";
  return { result: await playground(userId, kind, String(b.prompt ?? "")) };
});
