// The Hangout's streaks: one critter per friend with drawn art, kept awake by playing Sidequest games together in Messenger.
// Powered 100% by `src/lib/context` (Deep Cuts, Order Up!, Ghost Run, Sketch Off) and Austin local midnight (`America/Chicago`).
// Privacy invariants:
//   - Only the viewer's own friends with critter art appear.
//   - Only the viewer's own 1:1 DM with each friend is read (never group chats or third-party chats).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PRESET_MENUS } from "../../../sidequest/shared/kitchen";
import { chatDayActivityFor, ingestSidequestSessions, streakInfoFor, type SidequestSession } from "@/lib/context";
import { dayEndsAt as contextDayEndsAt, dayKey, prevDay } from "@/lib/context/day";
import { sqPid } from "@/lib/context/seed";
import type { CritterState } from "@/lib/hangout/types";
import { db, getUser, sendMessage } from "@/server/db";
import type { ID } from "@/types";
import { CRITTER_ART, critterDesign } from "./art";
import type { DayMark, StreakCard, StreakDetail, StreakStatus, StreaksView } from "./views";

const fail = (status: number, msg: string) => Object.assign(new Error(msg), { status });

const dmWith = (viewerId: ID, friendId: ID) =>
  db().conversations.find((c) => !c.isGroup && c.participantIds.length === 2 && c.participantIds.includes(viewerId) && c.participantIds.includes(friendId));

export const dayEndsAt = contextDayEndsAt;

function statusOf(
  cid: ID | undefined,
  viewerId: ID,
  friendId: ID,
  sessions: SidequestSession[],
  now: number,
): { streak: number; status: StreakStatus; meToday: boolean; themToday: boolean; todayRef?: string } {
  if (!cid) return { streak: 0, status: "new", meToday: false, themToday: false };
  const streak = streakInfoFor(cid, sessions, now).days;
  const { finishersByDay, gamesByDay } = chatDayActivityFor(cid, sessions);
  const todayKey = dayKey(now);
  const todayDone = finishersByDay.get(todayKey) ?? new Set<ID>();
  const meToday = todayDone.has(viewerId);
  const themToday = todayDone.has(friendId);
  const todayRef = [...(gamesByDay.get(todayKey) ?? [])].at(-1);

  if (meToday && themToday) return { streak, status: "done", meToday, themToday, todayRef };
  if (themToday) return { streak, status: "yourTurn", meToday, themToday, todayRef };
  if (meToday) return { streak, status: "theirTurn", meToday, themToday, todayRef };
  if (streak > 0) return { streak, status: "atRisk", meToday, themToday, todayRef };

  const everTogether = [...finishersByDay.values()].some((s) => s.has(viewerId) && s.has(friendId));
  return { streak: 0, status: everTogether ? "lost" : "new", meToday, themToday, todayRef };
}

const STATE: Record<StreakStatus, CritterState> = {
  done: "celebrating",
  yourTurn: "awake",
  theirTurn: "awake",
  atRisk: "sleepy",
  lost: "resting",
  new: "egg",
};

function cardFor(viewerId: ID, friendId: ID, sessions: SidequestSession[], now: number): StreakCard | null {
  const u = getUser(friendId);
  const art = CRITTER_ART[friendId];
  if (!u || !art || !getUser(viewerId)?.friendIds.includes(friendId)) return null;
  const cid = dmWith(viewerId, friendId)?.id;
  const { streak, status } = statusOf(cid, viewerId, friendId, sessions, now);
  const state = status === "done" && streak === 1 ? "hatching" : STATE[status];
  return {
    friendId,
    name: u.name,
    first: u.name.split(" ")[0],
    avatar: u.avatar,
    conversationId: cid,
    streak,
    status,
    state,
    design: critterDesign(friendId, state),
    animal: art.animal,
  };
}

const URGENCY: StreakStatus[] = ["yourTurn", "atRisk", "theirTurn", "done", "new", "lost"];

export function streaksFor(viewerId: ID, now = Date.now()): StreaksView {
  const sessions = ingestSidequestSessions();
  const cards = Object.keys(CRITTER_ART)
    .map((id) => cardFor(viewerId, id, sessions, now))
    .filter((c): c is StreakCard => !!c);
  return {
    host: { image: "/seed/muse/host-plush.webp" },
    friends: cards.sort((a, b) => URGENCY.indexOf(a.status) - URGENCY.indexOf(b.status) || b.streak - a.streak),
    endsAt: dayEndsAt(now),
  };
}

export function streakDetail(viewerId: ID, friendId: ID, now = Date.now()): StreakDetail {
  const sessions = ingestSidequestSessions();
  const card = cardFor(viewerId, friendId, sessions, now);
  if (!card) throw fail(404, "No streak with this person");
  const cid = card.conversationId;
  const { finishersByDay, gamesByDay } = cid ? chatDayActivityFor(cid, sessions) : { finishersByDay: new Map<string, Set<ID>>(), gamesByDay: new Map<string, Set<string>>() };

  const dates: string[] = [];
  let cursor = dayKey(now);
  for (let i = 0; i < 14; i++, cursor = prevDay(cursor)) dates.unshift(cursor);

  const days = dates.map((date) => {
    const done = finishersByDay.get(date);
    const hadGame = (gamesByDay.get(date)?.size ?? 0) > 0;
    if (!done && !hadGame) return { date, mark: "nogame" as DayMark };
    const n = Number(Boolean(done?.has(viewerId))) + Number(Boolean(done?.has(friendId)));
    return { date, mark: (n === 2 ? "both" : n === 1 ? "one" : "none") as DayMark };
  });

  const { meToday, themToday, todayRef } = statusOf(cid, viewerId, friendId, sessions, now);
  return {
    ...card,
    days,
    endsAt: dayEndsAt(now),
    today: { gameId: todayRef, me: meToday, them: themToday },
  };
}

/** Demo helper: drops a playable Sidequest game in the 1:1 DM if none exists today, and records the friend playing it. */
export async function friendPlaysToday(viewerId: ID, friendId: ID): Promise<StreakDetail> {
  const now = Date.now();
  const sessions = ingestSidequestSessions();
  const card = cardFor(viewerId, friendId, sessions, now);
  if (!card) throw fail(404, "No streak with this person");
  if (!card.conversationId) throw fail(409, `Say hi to ${card.first} first`);

  const cid = card.conversationId;
  const { finishersByDay, gamesByDay } = chatDayActivityFor(cid, sessions);
  const todayKey = dayKey(now);
  if (finishersByDay.get(todayKey)?.has(friendId)) return streakDetail(viewerId, friendId, now);

  let ref = [...(gamesByDay.get(todayKey) ?? [])].at(-1);
  let title = "Taco 'Bout It";
  let scoreText = "$218";

  if (!ref) {
    const roomId = `sqdm${friendId.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 4)}${String(now).slice(-2)}`;
    ref = `k:${roomId}`;
    const menu = PRESET_MENUS.find((m) => m.interest === "tacos") ?? PRESET_MENUS[0];
    title = menu.name;
    try {
      const dir = join(process.cwd(), "sidequest", ".cache", "kitchen");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, `${roomId}.json`),
        JSON.stringify({
          id: roomId,
          menu,
          seed: 41209,
          createdAt: new Date(now - 2000).toISOString(),
          players: {
            [sqPid(friendId)]: { name: card.first, best: 218, plays: 1, served: 16, lost: 0, combo: 6 },
          },
        }),
      );
    } catch {
      /* read-only fs fallback */
    }
    sendMessage(cid, friendId, `🎮 Order Up!: ${menu.interest[0].toUpperCase() + menu.interest.slice(1)}`, { type: "sqgame", ref });
  } else {
    const existing = sessions.find((s) => s.conversationId === cid && s.ref === ref);
    if (existing) {
      title = existing.title || existing.interest;
      scoreText = existing.gameKind === "ghostrun" ? "23.4s" : existing.gameKind === "sketchoff" ? "260 pts" : existing.gameKind === "deepcuts" ? "960 pts" : "$218";
    }
  }

  sendMessage(cid, friendId, `played ${title} · ${scoreText}`, { type: "sqgamelog", ref });
  return streakDetail(viewerId, friendId);
}
