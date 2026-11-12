import { route } from "@/server/http";
import { confirmMeetup, confirmPlan, dismissPlan, sharePlan } from "@/server/hangout/actions";
import { proposePlan } from "@/server/hangout/pipeline";
import { chatView } from "@/server/hangout/views";
// action: "propose" (Muse Wonder drafts a plan, visible only to you) | "share" (you post it in the chat) | "dismiss"
//         | "confirm" (who: "me" or the friend) | "met" (We met up)
export const POST = route<{ id: string }>(async (_req, { params, body }) => {
  const b = await body();
  if (b.action === "propose") {
    const { plan, run } = await proposePlan(params.id, { fallbackToCache: true });
    if (!plan) throw Object.assign(new Error(run.outcome.replace(/^no plan: /, "")), { status: 409 });
  } else if (b.action === "share") sharePlan(params.id);
  else if (b.action === "dismiss") dismissPlan(params.id);
  else if (b.action === "confirm") confirmPlan(params.id, String(b.who));
  else if (b.action === "met") await confirmMeetup(params.id);
  else throw Object.assign(new Error("Unknown action"), { status: 400 });
  return chatView(params.id);
});
