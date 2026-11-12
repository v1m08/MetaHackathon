// GET: plans the viewer owns, and plans they were invited to (once sent).
import { plansFor } from "@/lib/reconnect/plan";
import { viewPlan } from "@/lib/reconnect/send";
import { route } from "@/server/http";

export const GET = route((_req, { userId }) => ({ plans: plansFor(userId).map((p) => viewPlan(userId, p)).filter(Boolean) }));
