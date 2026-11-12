import { route } from "@/server/http";
import { friendRequestsFor, groupsFor, notificationsFor, requireUser, unreadCount } from "@/server/db";
export const GET = route((_req, { userId }) => {
  const me = requireUser(userId);
  return { ...me, unreadMessages: unreadCount(userId), unreadNotifications: notificationsFor(userId).filter((n) => !n.read).length, friendRequests: friendRequestsFor(userId).length, groupIds: groupsFor(userId).map((g) => g.id) };
});
