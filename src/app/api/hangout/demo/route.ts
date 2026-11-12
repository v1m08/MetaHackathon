// Demo controls for /demo: time travel, reset, AI mode, scenario triggers, friend-side actions.
import { route } from "@/server/http";
import { confirmPlan, friendReplies, theyPickYou } from "@/server/hangout/actions";
import { rebuildAllMemory, runWhyNow } from "@/server/hangout/pipeline";
import { hang, reloadMemory, resetHang } from "@/server/hangout/store";
import { demoView } from "@/server/hangout/views";

const bad = (msg: string) => Object.assign(new Error(msg), { status: 400 });
const shift = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const GET = route(() => demoView());

export const POST = route(async (_req, { body }) => {
  const b = await body();
  const s = hang();
  switch (b.action) {
    case "setDate":
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date))) throw bad("date must be YYYY-MM-DD");
      s.demoDate = String(b.date);
      break;
    case "shiftDate":
      s.demoDate = shift(s.demoDate, Number(b.days) || 1);
      break;
    case "reset":
      resetHang(Boolean(b.full));
      reloadMemory();
      break;
    case "rebuildMemory":
      await rebuildAllMemory({ fallbackToCache: s.aiMode === "live" });
      break;
    case "mode":
      if (b.mode !== "live" && b.mode !== "cached") throw bad("mode must be live or cached");
      s.aiMode = b.mode;
      break;
    case "theme":
      if (b.theme !== "critters" && b.theme !== "plants") throw bad("theme must be critters or plants");
      s.theme = b.theme;
      break;
    case "scenario":
      return { result: await runWhyNow(String(b.id), { fallbackToCache: true }).then((r) => ({ outcome: r.outcome, reason: r.reason })), ...demoView() };
    case "reply":
      await friendReplies(String(b.friendId));
      break;
    case "pick":
      theyPickYou(String(b.personId));
      break;
    case "friendYes":
      confirmPlan(String(b.friendId), String(b.friendId));
      break;
    case "clearNudges":
      s.nudges = s.nudges.filter((n) => n.createdAt !== s.demoDate);
      break;
    default:
      throw bad(`Unknown action ${String(b.action)}`);
  }
  return demoView();
});
