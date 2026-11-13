import { clearFeedbackSignals } from "@/lib/context";
import { resetDb } from "@/server/db";
import { route } from "@/server/http";
export const POST = route(() => {
  clearFeedbackSignals();
  resetDb();
  return { ok: true, reset: true };
});
