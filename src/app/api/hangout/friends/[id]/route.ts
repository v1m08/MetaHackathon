import { route } from "@/server/http";
import { markHatchSeen, setResting } from "@/server/hangout/actions";
import { friendView } from "@/server/hangout/views";
export const GET = route<{ id: string }>((_req, { params }) => friendView(params.id));
export const POST = route<{ id: string }>(async (_req, { params, body }) => {
  const b = await body();
  if (typeof b.resting === "boolean") setResting(params.id, b.resting);
  if (b.hatchSeen) markHatchSeen(params.id);
  return friendView(params.id);
});
