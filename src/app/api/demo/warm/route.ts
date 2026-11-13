import { route } from "@/server/http";
import { warmDemo } from "@/server/demo";
// Before the demo (npm run demo:public calls this): Muse picks the game from the group's data and generates it now,
// so it posts instantly when the first judge opens the chat.
export const maxDuration = 300;
export const POST = route(async () => {
  try {
    return await warmDemo();
  } catch (e) {
    throw Object.assign(new Error(`Muse couldn't prepare the game: ${(e as Error).message}. Is the game server running?`), { status: 502 });
  }
});
