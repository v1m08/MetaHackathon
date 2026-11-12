import { route } from "@/server/http";
import { clearTraces, traces } from "@/lib/ai";
export const GET = route(() => traces());
export const DELETE = route(() => { clearTraces(); });
