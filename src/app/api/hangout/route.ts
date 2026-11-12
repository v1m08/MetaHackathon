import { route } from "@/server/http";
import { hangoutView } from "@/server/hangout/views";
export const GET = route(() => hangoutView());
