import { route } from "@/server/http";
import { museLatestFor, museNoteFor } from "@/server/demo";
// Muse for the current user: its newest notification (the slide-down banner) and its plan note (the Friends tab).
export const GET = route((_req, { userId }) => ({ latest: museLatestFor(userId), note: museNoteFor(userId) }));
