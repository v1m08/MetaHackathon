import { route } from "@/server/http";
import { db } from "@/server/db";
export const GET = route(() => db().users);
