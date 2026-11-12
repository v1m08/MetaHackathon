import { route } from "@/server/http";
import { composeSuggestions } from "@/lib/ai/features";
export const POST = route(async (_req, { userId, body }) => {
  const b = await body();
  return composeSuggestions(userId, String(b.draft ?? ""), String(b.tone ?? "casual"), b.groupId as string | undefined);
});
