// GET the Hangout's streaks: one critter per friend with art, most urgent first.
import { streaksFor } from "@/lib/streaks/streaks";
import { route } from "@/server/http";

export const GET = route((_req, { userId }) => streaksFor(userId));
