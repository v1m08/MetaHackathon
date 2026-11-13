import { ingestSidequestSessions, streakInfoFor } from "@/lib/context";
import { DEMO_CHAT, isDemoUser } from "@/lib/demo";
import { route } from "@/server/http";
import { cardFor, conversationsFor } from "@/server/db";
export const GET = route((_req, { userId }) => {
  const sessions = ingestSidequestSessions();
  // demo judges see just their group chat here; their 1:1 DMs live behind the Hangout's critters
  return conversationsFor(userId).filter((c) => !isDemoUser(userId) || c.id === DEMO_CHAT).map((c) => {
    const others = c.participantIds.filter((id) => id !== userId).map(cardFor);
    const last = c.messages.at(-1);
    const st = streakInfoFor(c.id, sessions);
    return {
      id: c.id,
      isGroup: c.isGroup,
      name: c.name ?? others.map((o) => o.name.split(" ")[0]).join(", "),
      emoji: c.emoji,
      participants: others,
      avatar: others[0]?.avatar,
      last: last ? { ...last, mine: last.senderId === userId, senderName: cardFor(last.senderId).name.split(" ")[0] } : undefined,
      unread: c.messages.filter((m) => m.senderId !== userId && !m.readBy?.includes(userId)).length,
      streak: st.days > 0 ? { days: st.days, atRisk: !st.today.lockedIn } : undefined,
    };
  });
});
