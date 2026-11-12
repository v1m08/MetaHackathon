// Demo switch: force replay mode on/off at runtime (also AI_MODE=replay in env). GET shows the current state.
import { aiStatus } from "@/lib/ai";
import { forceReplay, recordings, setForceReplay } from "@/lib/travel/replay";
import { route } from "@/server/http";

export const GET = route(() => ({ ...aiStatus(), forceReplay: forceReplay(), recordings: { discover: recordings().discover.length, guides: recordings().guides.length, recordedAt: recordings().recordedAt } }));
export const POST = route(async (_req, { body }) => {
  const b = (await body()) as { replay?: boolean };
  if (typeof b.replay === "boolean") setForceReplay(b.replay);
  return { forceReplay: forceReplay() };
});
