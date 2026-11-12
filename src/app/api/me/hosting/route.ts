// The "Open to hosting friends" setting. Hosting is opt-in: the travel agent only ever proposes people who turned this on.
import { requireUser } from "@/server/db";
import { route } from "@/server/http";

export const POST = route(async (_req, { userId, body }) => {
  const b = (await body()) as { openToHosting?: boolean; hostingNote?: string };
  const me = requireUser(userId);
  if (typeof b.openToHosting === "boolean") me.openToHosting = b.openToHosting;
  if (typeof b.hostingNote === "string") me.hostingNote = b.hostingNote.slice(0, 140);
  return { openToHosting: !!me.openToHosting, hostingNote: me.hostingNote ?? "" };
});
