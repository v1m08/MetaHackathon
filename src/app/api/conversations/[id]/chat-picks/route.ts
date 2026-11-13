import { route } from "@/server/http";
import { chatPicksFor, markChatPicksShown } from "@/lib/events/chatPicks";

// GET ?ref=<game>: multi-surface post-game picks (Groups 40+, Events 60+, Marketplace 75+) for the game just finished.
// &peek=1: the viewer reopened the sheet themself, so the once-per-game / once-a-day cadence is skipped.
export const GET = route<{ id: string }>((req, { userId, params }) =>
  chatPicksFor(params.id, userId, req.nextUrl.searchParams.get("ref") ?? "", Date.now(), { peek: req.nextUrl.searchParams.get("peek") === "1" }),
);

// POST { ref }: records that the post-game sheet was shown (enforces once-per-game & once-a-day cadence).
export const POST = route<{ id: string }>(async (_req, { userId, params, body }) => {
  const b = await body();
  markChatPicksShown(params.id, userId, String(b.ref ?? ""));
  return { ok: true };
});
