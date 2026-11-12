// Legacy "Open to hosting friends" toggle: now a thin wrapper over Open Door (couch offer on/off, policy text).
import { openDoorOf, setOpenDoor } from "@/lib/travel/openDoor";
import { requireUser } from "@/server/db";
import { route } from "@/server/http";

export const POST = route(async (_req, { userId, body }) => {
  const b = (await body()) as { openToHosting?: boolean; hostingNote?: string };
  const me = requireUser(userId);
  const cur = openDoorOf(me);
  if (typeof b.openToHosting === "boolean") setOpenDoor(me, { on: b.openToHosting, offers: b.openToHosting && !cur.offers.includes("couch") ? [...cur.offers, "couch"] : cur.offers });
  if (typeof b.hostingNote === "string") setOpenDoor(me, { policy: b.hostingNote });
  return { openToHosting: !!me.openToHosting, hostingNote: me.hostingNote ?? "" };
});
