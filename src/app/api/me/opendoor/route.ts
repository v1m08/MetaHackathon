// Open Door settings for the acting user. Policy text is theirs; tier/offers/maxGuests are simple controls.
import { openDoorOf, setOpenDoor } from "@/lib/travel/openDoor";
import { requireUser } from "@/server/db";
import { route } from "@/server/http";
import type { OpenDoor } from "@/types";

export const GET = route((_req, { userId }) => openDoorOf(requireUser(userId)));
export const POST = route(async (_req, { userId, body }) => setOpenDoor(requireUser(userId), (await body()) as Partial<OpenDoor>));
