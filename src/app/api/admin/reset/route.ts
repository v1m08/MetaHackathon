import { resetPlayStore } from "@/lib/play/store";
import { resetDb } from "@/server/db";
import { route } from "@/server/http";
export const POST = route(() => {
  resetDb();
  resetPlayStore();
  return { ok: true, reset: true };
});
