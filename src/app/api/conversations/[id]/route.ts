import { connectionScoreFor, ingestSidequestSessions } from "@/lib/context";
import { topic, topicsOfEvent } from "@/lib/context/taxonomy";
import { canSeeEvent } from "@/lib/context/visibility";
import { CRITTER_ART } from "@/lib/streaks/art";
import { route } from "@/server/http";
import { cardFor, db, getConversation, markConversationRead } from "@/server/db";
export const GET = route<{ id: string }>((_req, { userId, params }) => {
  const c = getConversation(params.id);
  if (!c || !c.participantIds.includes(userId)) throw Object.assign(new Error("Conversation not found"), { status: 404 });
  markConversationRead(c.id, userId);
  const others = c.participantIds.filter((id) => id !== userId).map(cardFor);

  const sessions = ingestSidequestSessions();
  const coSessions = sessions.filter((s) => s.conversationId === c.id && s.players.has(userId) && s.players.size >= 2);
  const cs = connectionScoreFor(c.id, coSessions.length ? coSessions : sessions);
  const st = cs.streak;
  const otherId = !c.isGroup ? others[0]?.id : undefined;
  const critterFriendId = otherId && CRITTER_ART[otherId] ? otherId : undefined;

  let matchedEvent: { id: string; title: string; startsAt: string; location: string; topicLabel: string; alreadyShared: boolean } | undefined;
  if (coSessions.length > 0 && cs.earnedTiers.includes("event")) {
    const settledMap = new Map(cs.topics.filter((t) => t.settled || (t.games >= 1 && t.observedBy >= 2 && t.score > 0.08)).map((t) => [t.topic, t.score]));
    const now = Date.now();
    const candidates = db()
      .events.filter((e) => {
        if (new Date(e.startsAt).getTime() <= now) return false;
        if (!c.participantIds.every((m) => canSeeEvent(m, e))) return false;
        const alreadyIn = new Set([...e.going, ...(e.hostId ? [e.hostId] : [])]);
        return others.some((o) => !alreadyIn.has(o.id));
      })
      .map((e) => {
        const ts = topicsOfEvent(e);
        let bestTopic = ts[0];
        let bestScore = 0;
        for (const t of ts) {
          const sc = settledMap.get(t) ?? 0;
          if (sc > bestScore) {
            bestScore = sc;
            bestTopic = t;
          }
        }
        const daysAway = Math.max(0, (new Date(e.startsAt).getTime() - now) / 864e5);
        const soon = Math.max(0, 1 - daysAway / 21) * 0.08;
        return { e, bestTopic, score: bestScore + (bestScore > 0 ? soon : 0) };
      })
      .filter((x) => x.score > 0.08 && x.bestTopic)
      .sort((a, b) => b.score - a.score);

    const top = candidates[0];
    if (top && top.bestTopic) {
      matchedEvent = {
        id: top.e.id,
        title: top.e.title,
        startsAt: top.e.startsAt,
        location: top.e.location,
        topicLabel: topic(top.bestTopic).label,
        alreadyShared: c.messages.some((m) => m.attachment?.type === "event" && m.attachment.ref === top.e.id),
      };
    }
  }

  return {
    ...c,
    name: c.name ?? others.map((o) => o.name).join(", "),
    participants: c.participantIds.map(cardFor),
    others,
    chatContext: {
      streakDays: st.days,
      lockedInToday: st.today.lockedIn,
      hourglass: st.hourglass,
      closenessScore: coSessions.length ? cs.score : 0,
      critterFriendId,
      matchedEvent,
    },
  };
});
