// GET one plan as the viewer may see it. POST { action: draft | send | join | leave | confirm | unconfirm, text? }.
import { confirmPlan, draftInvite, joinPlan, sendPlan, viewPlan } from "@/lib/reconnect/send";
import { getPlan } from "@/lib/reconnect/store";
import { route } from "@/server/http";

export const GET = route<{ id: string }>((_req, { userId, params }) => {
  const p = getPlan(params.id);
  const v = p ? viewPlan(userId, p) : null;
  if (!v) throw Object.assign(new Error("Plan not found"), { status: 404 });
  return v;
});

export const POST = route<{ id: string }>(async (_req, { userId, params, body }) => {
  const b = (await body()) as { action?: string; text?: string };
  switch (b.action) {
    case "draft": {
      const r = await draftInvite(userId, params.id);
      return { ...r, plan: viewPlan(userId, r.plan) };
    }
    case "send": {
      const r = sendPlan(userId, params.id, b.text);
      return { ...r, plan: viewPlan(userId, r.plan) };
    }
    case "join": return viewPlan(userId, joinPlan(userId, params.id, true));
    case "leave": return viewPlan(userId, joinPlan(userId, params.id, false));
    case "confirm": return viewPlan(userId, confirmPlan(userId, params.id, true));
    case "unconfirm": return viewPlan(userId, confirmPlan(userId, params.id, false));
  }
  throw Object.assign(new Error("unknown action"), { status: 400 });
});
