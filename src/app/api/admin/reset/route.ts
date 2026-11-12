import { resetTravelStore } from "@/lib/travel/store";
import { resetReconnectStore } from "@/lib/reconnect/store";
import { resetDb } from "@/server/db";
import { route } from "@/server/http";
export const POST = route(() => {
  resetDb();
  resetTravelStore();
  resetReconnectStore();
  return { ok: true, reset: true };
});
