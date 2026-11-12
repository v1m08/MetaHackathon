import { route } from "@/server/http";
import { hang } from "@/server/hangout/store";
import { hangoutView } from "@/server/hangout/views";
export const GET = route(() => hangoutView());
export const POST = route(async (_req, { body }) => {
  const b = await body();
  if (b.theme === "critters" || b.theme === "plants") hang().theme = b.theme;
  return hangoutView();
});
