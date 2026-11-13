// GET one game as the viewer may see it (members of its chat only; answers and results hidden until they finish).
// POST { action: open | answer | skip | complete | react, roundId?, choice?, ms?, emoji? } -> { game, unlock? }.
import { act, viewGame, type ActBody } from "@/lib/play/play";
import { getGame } from "@/lib/play/store";
import { route } from "@/server/http";

export const GET = route<{ id: string }>((_req, { userId, params }) => {
  const g = getGame(params.id);
  if (!g) throw Object.assign(new Error("Game not found"), { status: 404 });
  return viewGame(g, userId);
});

export const POST = route<{ id: string }>(async (_req, { userId, params, body }) => act(params.id, userId, (await body()) as unknown as ActBody));
