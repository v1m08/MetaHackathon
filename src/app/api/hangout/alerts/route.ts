import { route } from "@/server/http";
import { markAlertSeen } from "@/server/hangout/actions";
import { latestAlert } from "@/server/hangout/views";
export const GET = route(() => ({ alert: latestAlert() }));
export const POST = route(async (_req, { body }) => {
  markAlertSeen(String((await body()).id));
  return { alert: latestAlert() };
});
