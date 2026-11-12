import { route } from "@/server/http";
import { sendMessage } from "@/server/hangout/actions";
import { chatView } from "@/server/hangout/views";
export const GET = route<{ id: string }>((_req, { params }) => chatView(params.id));
// The user's own words only. Nothing here is ever written or sent by the model.
export const POST = route<{ id: string }>(async (_req, { params, body }) => {
  const b = await body();
  sendMessage(params.id, { text: b.text as string | undefined, photoId: b.photoId as string | undefined, nudgeId: b.nudgeId as string | undefined });
  return chatView(params.id);
});
