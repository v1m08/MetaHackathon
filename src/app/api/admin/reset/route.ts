import { clearFeedbackSignals } from "@/lib/context";
import { resetPlayStore } from "@/lib/play/store";
import { resetDb } from "@/server/db";
import { route } from "@/server/http";
export const POST = route(() => {
  clearFeedbackSignals();
  resetDb();
  resetPlayStore();
  return { ok: true, reset: true };
});
