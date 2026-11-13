import type { GameKind } from "@/components/ChatGames";
import { traySuggestionsFor } from "@/lib/context";
import { route } from "@/server/http";

export const GET = route((req, { userId }) => {
  const conversationId = req.nextUrl.searchParams.get("conversationId") ?? "";
  const game: GameKind = req.nextUrl.searchParams.get("game") === "orderup" ? "orderup" : "deepcuts";
  if (!conversationId) throw Object.assign(new Error("conversationId required"), { status: 400 });
  return traySuggestionsFor(conversationId, userId, game);
});
