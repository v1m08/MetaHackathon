import { resetTravelStore } from "@/lib/travel/store";
import { resetReconnectStore } from "@/lib/reconnect/store";
import { resetPlayStore } from "@/lib/play/store";
import { resetDb } from "@/server/db";
import { route } from "@/server/http";
export const POST = route(() => {
  resetDb();
  resetTravelStore();
  resetReconnectStore();
  resetPlayStore();
  return { ok: true, reset: true };
});
