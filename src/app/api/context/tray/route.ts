import type { GameKind } from "@/components/ChatGames";
import { traySuggestionsFor } from "@/lib/context";
import { route } from "@/server/http";

const VALID = new Set(["auto", "deepcuts", "orderup", "ghostrun", "sketchoff"]);

export const GET = route((req, { userId }) => {
  const conversationId = req.nextUrl.searchParams.get("conversationId") ?? "";
  const raw = req.nextUrl.searchParams.get("game") ?? "auto";
  const game = (VALID.has(raw) ? raw : "auto") as GameKind | "auto";
  if (!conversationId) throw Object.assign(new Error("conversationId required"), { status: 400 });
  return traySuggestionsFor(conversationId, userId, game);
});
