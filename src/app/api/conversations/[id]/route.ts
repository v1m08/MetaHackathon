import { route } from "@/server/http";
import { cardFor, getConversation, markConversationRead, visibleMessages } from "@/server/db";
export const GET = route<{ id: string }>((_req, { userId, params }) => {
  const c = getConversation(params.id);
  if (!c || !c.participantIds.includes(userId) || !visibleMessages(c, userId).length) throw Object.assign(new Error("Conversation not found"), { status: 404 });
  markConversationRead(c.id, userId);
  const others = c.participantIds.filter((id) => id !== userId).map(cardFor);
  return { ...c, messages: visibleMessages(c, userId), name: c.name ?? others.map((o) => o.name).join(", "), participants: c.participantIds.map(cardFor), others };
});
