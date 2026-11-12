import { route } from "@/server/http";
import { setNudgeStatus } from "@/server/hangout/actions";
import { hang } from "@/server/hangout/store";
import { nudgeView } from "@/server/hangout/views";
import type { NudgeStatus } from "@/lib/hangout/types";

const find = (id: string) => {
  const n = hang().nudges.find((x) => x.id === id);
  if (!n) throw Object.assign(new Error("Nudge not found"), { status: 404 });
  return n;
};
export const GET = route<{ id: string }>((_req, { params }) => nudgeView(find(params.id)));
export const POST = route<{ id: string }>(async (_req, { params, body }) => {
  const status = String((await body()).status) as NudgeStatus;
  if (!["sent", "dismissed", "rested"].includes(status)) throw Object.assign(new Error("Bad status"), { status: 400 });
  return nudgeView(setNudgeStatus(params.id, status));
});
