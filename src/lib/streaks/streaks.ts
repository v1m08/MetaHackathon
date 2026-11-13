// The Hangout's streaks: one critter per friend with drawn art, kept awake by playing each day's Chat Game together.
// Code enforces: the streak number is Chat Games' own streakDays() (so it always matches the thread's ScoreBar);
// only the viewer's friends with a critter appear; only the viewer's own 1:1 chat with each is read.
import { ensureDaily } from "@/lib/play/daily";
import { act } from "@/lib/play/play";
import { streakDays } from "@/lib/play/score";
import { completedBy, dayKey, gamesIn, playStore, type Choice, type Round } from "@/lib/play/store";
import type { CritterState } from "@/lib/hangout/types";
import { db, getUser } from "@/server/db";
import type { ID } from "@/types";
import { CRITTER_ART, critterDesign } from "./art";
import type { DayMark, StreakCard, StreakDetail, StreakStatus, StreaksView } from "./views";

const DAY = 864e5;
const fail = (status: number, msg: string) => Object.assign(new Error(msg), { status });

const dmWith = (viewerId: ID, friendId: ID) =>
  db().conversations.find((c) => !c.isGroup && c.participantIds.length === 2 && c.participantIds.includes(viewerId) && c.participantIds.includes(friendId));

/** The first moment today's game day is over, whatever dayKey() counts as a day. */
export function dayEndsAt(now = Date.now()) {
  const today = dayKey(new Date(now));
  let t = Math.floor(now / 1e3) * 1e3;
  for (const step of [3600e3, 60e3, 1e3]) while (dayKey(new Date(t + step)) === today) t += step;
  return new Date(t + 1e3).toISOString();
}

const todayGame = (cid: ID, now: number) => playStore().byDay.get(`${cid}|${dayKey(new Date(now))}`);

function statusOf(cid: ID | undefined, viewerId: ID, friendId: ID, now: number): { streak: number; status: StreakStatus } {
  if (!cid) return { streak: 0, status: "new" };
  const streak = streakDays(cid, now);
  const gid = todayGame(cid, now);
  const done = gid ? completedBy(gid) : new Set<ID>();
  const me = done.has(viewerId), them = done.has(friendId);
  if (me && them) return { streak, status: "done" };
  if (them) return { streak, status: "yourTurn" };
  if (me) return { streak, status: "theirTurn" };
  if (streak > 0) return { streak, status: "atRisk" };
  const together = gamesIn(cid).some((g) => { const s = completedBy(g.id); return s.has(viewerId) && s.has(friendId); });
  return { streak, status: together ? "lost" : "new" };
}

const STATE: Record<StreakStatus, CritterState> = { done: "celebrating", yourTurn: "awake", theirTurn: "awake", atRisk: "sleepy", lost: "resting", new: "egg" };

function cardFor(viewerId: ID, friendId: ID, now: number): StreakCard | null {
  const u = getUser(friendId);
  const art = CRITTER_ART[friendId];
  if (!u || !art || !getUser(viewerId)?.friendIds.includes(friendId)) return null;
  const cid = dmWith(viewerId, friendId)?.id;
  const { streak, status } = statusOf(cid, viewerId, friendId, now);
  // A streak that starts today hatches; a longer one celebrates.
  const state = status === "done" && streak === 1 ? "hatching" : STATE[status];
  return { friendId, name: u.name, first: u.name.split(" ")[0], avatar: u.avatar, conversationId: cid, streak, status, state, design: critterDesign(friendId, state), animal: art.animal };
}

const URGENCY: StreakStatus[] = ["yourTurn", "atRisk", "theirTurn", "done", "new", "lost"];

export function streaksFor(viewerId: ID, now = Date.now()): StreaksView {
  const cards = Object.keys(CRITTER_ART).map((id) => cardFor(viewerId, id, now)).filter((c): c is StreakCard => !!c);
  return {
    host: { image: "/seed/muse/host-plush.webp" },
    friends: cards.sort((a, b) => URGENCY.indexOf(a.status) - URGENCY.indexOf(b.status) || b.streak - a.streak),
    endsAt: dayEndsAt(now),
  };
}

export function streakDetail(viewerId: ID, friendId: ID, now = Date.now()): StreakDetail {
  const card = cardFor(viewerId, friendId, now);
  if (!card) throw fail(404, "No streak with this person");
  const cid = card.conversationId;
  const byDay = new Map(cid ? gamesIn(cid).map((g) => [g.date, g.id]) : []);
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = dayKey(new Date(now - (13 - i) * DAY));
    const gid = byDay.get(date);
    if (!gid) return { date, mark: "nogame" as DayMark };
    const done = completedBy(gid);
    const n = Number(done.has(viewerId)) + Number(done.has(friendId));
    return { date, mark: (n === 2 ? "both" : n === 1 ? "one" : "none") as DayMark };
  });
  const gid = cid ? todayGame(cid, now) : undefined;
  const done = gid ? completedBy(gid) : new Set<ID>();
  return { ...card, days, endsAt: dayEndsAt(now), today: { gameId: gid, me: done.has(viewerId), them: done.has(friendId) } };
}

/** A choice any round accepts: first option, or every option in order, or all ten points on the first. */
function anyChoice(r: Round): Choice {
  const ids = r.options.map((o) => o.id);
  if (r.kind === "pick") return ids[0];
  if (r.kind === "split") return { pick: ids[0], predict: ids[ids.length - 1] };
  if (r.kind === "rank") return ids;
  return { [ids[0]]: 10 };
}

/** Demo: drop today's game if it isn't out yet and play it as the friend, so the room shows "your turn". */
export async function friendPlaysToday(viewerId: ID, friendId: ID): Promise<StreakDetail> {
  const card = cardFor(viewerId, friendId, Date.now());
  if (!card) throw fail(404, "No streak with this person");
  if (!card.conversationId) throw fail(409, `Say hi to ${card.first} first`);
  const game = await ensureDaily(card.conversationId, viewerId);
  if (!game) throw fail(409, "Today's game couldn't drop here (games muted, or try again in a minute)");
  if (!completedBy(game.id).has(friendId)) {
    await act(game.id, friendId, { action: "open" });
    for (const r of game.rounds) await act(game.id, friendId, { action: "answer", roundId: r.id, choice: anyChoice(r) });
    await act(game.id, friendId, { action: "complete" });
  }
  return streakDetail(viewerId, friendId);
}
