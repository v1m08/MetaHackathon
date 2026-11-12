import { route } from "@/server/http";
import { artGallery } from "@/server/hangout/views";
export const GET = route(() => ({ friends: artGallery() }));
