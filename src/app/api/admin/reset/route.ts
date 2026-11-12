import { route } from "@/server/http";
import { resetDb } from "@/server/db";
export const POST = route(() => { resetDb(); return { ok: true, reset: true }; });
