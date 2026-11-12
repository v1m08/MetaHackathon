import { route } from "@/server/http";
import { seeAgainAttendees, submitSeeAgain } from "@/server/hangout/actions";
import { hang } from "@/server/hangout/store";

const view = () => {
  const { gathering, people } = seeAgainAttendees();
  const s = hang().seeAgain;
  // Never expose who picked whom: only your own picks and mutual matches.
  return { gathering: { id: gathering.id, name: gathering.name, place: gathering.place, date: gathering.date }, people: people.map((p) => ({ id: p.id, name: p.name, avatar: p.avatarPhoto })), myPicks: s.myPicks, submitted: s.submitted, matches: s.matches };
};
export const GET = route(() => view());
export const POST = route(async (_req, { body }) => {
  const picks = (await body()).picks;
  submitSeeAgain(Array.isArray(picks) ? picks.map(String) : []);
  return view();
});
