import { route } from "@/server/http";
import { aiStatus, traceStats } from "@/lib/ai";
export const GET = route(() => ({ ...aiStatus(), ...traceStats() }));
