// Marks the Trips intake as done (or resets it). The intake itself is the travel style + the agent (Open Door) toggle.
import { requireUser } from "@/server/db";
import { route } from "@/server/http";
export const POST = route(async (_req, { userId, body }) => {
  const b = (await body()) as { done?: boolean };
  const me = requireUser(userId);
  me.tripsSetupAt = b.done === false ? undefined : new Date().toISOString();
  return { setupDone: !!me.tripsSetupAt };
});
