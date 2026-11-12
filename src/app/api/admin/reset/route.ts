import { resetTravelStore } from "@/lib/travel/store";
import { resetDb } from "@/server/db";
import { route } from "@/server/http";
export const POST = route(() => {
  resetDb();
  resetTravelStore();
  return { ok: true, reset: true };
});
