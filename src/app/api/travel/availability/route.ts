// POST { personId, start, end, force? } → inferred availability of one person for the acting user's dates.
import { inferAvailability } from "@/lib/travel/availability";
import { route } from "@/server/http";

export const maxDuration = 60;
export const POST = route(async (_req, { userId, body }) => {
  const b = (await body()) as { personId?: string; start?: string; end?: string; force?: boolean; city?: string };
  if (!b.personId || !b.start || !b.end) throw Object.assign(new Error("personId, start, end required"), { status: 400 });
  return inferAvailability(userId, b.personId, b.start, b.end, { force: !!b.force, context: b.city });
});
