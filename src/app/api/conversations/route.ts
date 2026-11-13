import { route } from "@/server/http";
import { cardFor, conversationsFor, visibleMessages } from "@/server/db";
export const GET = route((_req, { userId }) =>
  conversationsFor(userId).map((c) => {
    const others = c.participantIds.filter((id) => id !== userId).map(cardFor);
    const msgs = visibleMessages(c, userId);
    const last = msgs.at(-1);
    return { id: c.id, isGroup: c.isGroup, name: c.name ?? others.map((o) => o.name.split(" ")[0]).join(", "), emoji: c.emoji, participants: others, avatar: others[0]?.avatar, last: last ? { ...last, mine: last.senderId === userId, senderName: cardFor(last.senderId).name.split(" ")[0] } : undefined, unread: msgs.filter((m) => (m.system || m.senderId !== userId) && !m.readBy?.includes(userId)).length, drafts: msgs.filter((m) => m.status === "draft").length };
  }),
);
