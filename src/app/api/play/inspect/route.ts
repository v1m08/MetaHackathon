// Dev only: everything in the play store, unfiltered, for the /dev/play inspector. Not a product surface.
import { inspect } from "@/lib/play/play";
import { route } from "@/server/http";

export const GET = route(() => inspect());
