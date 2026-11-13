import { recordFeedbackSignal } from "@/lib/context";
import { topicsOfListing } from "@/lib/context/taxonomy";
import { toggleSaveListing } from "@/server/db";
import { route } from "@/server/http";
export const POST = route<{ id: string }>((_req, { userId, params }) => {
  const l = toggleSaveListing(params.id, userId);
  const saved = l.savedBy.includes(userId);
  const top = topicsOfListing(l)[0];
  if (top && saved) recordFeedbackSignal(userId, "listing", l.id, top, "in");
  return { saved };
});
