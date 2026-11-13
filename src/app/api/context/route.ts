import { userContextFor } from "@/lib/context";
import { db } from "@/server/db";
import { route } from "@/server/http";

export const GET = route((req, { userId }) => {
  const target = req.nextUrl.searchParams.get("for") ?? userId;
  const profile = userContextFor(target);
  if (!profile) throw Object.assign(new Error("User not found"), { status: 404 });
  const users = db().users.map((u) => ({ id: u.id, name: u.name, first: u.name.split(" ")[0], avatar: u.avatar }));
  return { profile, users };
});
