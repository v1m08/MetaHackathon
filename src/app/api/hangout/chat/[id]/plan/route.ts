import { route } from "@/server/http";
import { confirmMeetup, confirmPlan } from "@/server/hangout/actions";
import { proposePlan } from "@/server/hangout/pipeline";
import { chatView } from "@/server/hangout/views";
// action: "propose" (Muse Wonder suggests a plan) | "confirm" (who: "me" or the friend) | "met" (We met up)
export const POST = route<{ id: string }>(async (_req, { params, body }) => {
  const b = await body();
  if (b.action === "propose") {
    const { plan, run } = await proposePlan(params.id, { fallbackToCache: true });
    if (!plan) throw Object.assign(new Error(run.outcome.replace(/^no plan: /, "")), { status: 409 });
  } else if (b.action === "confirm") confirmPlan(params.id, String(b.who));
  else if (b.action === "met") await confirmMeetup(params.id);
  else throw Object.assign(new Error("Unknown action"), { status: 400 });
  return chatView(params.id);
});
