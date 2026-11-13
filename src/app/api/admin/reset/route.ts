import { clearFeedbackSignals } from "@/lib/context";
import { resetDb } from "@/server/db";
import { resetMuse } from "@/server/demo";
import { route } from "@/server/http";
export const POST = route(() => {
  clearFeedbackSignals();
  resetDb();
  resetMuse();
  return { ok: true, reset: true };
});
