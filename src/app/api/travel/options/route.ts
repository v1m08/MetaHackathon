// What the Discover screen needs before the user types anything: upcoming weekends, the viewer's home city,
// car status, taste summary and a couple of nudges (friends driving somewhere on a weekend the viewer is free).
import { cityById } from "@/data/cities";
import { weekendDates, weekendLabel } from "@/data/travel";
import { tasteFor } from "@/lib/travel/taste";
import { cityName, rideTouches } from "@/lib/travel/tools";
import { canSeeUser, connection } from "@/lib/travel/visibility";
import { db, getUser, requireUser } from "@/server/db";
import { route } from "@/server/http";

export const GET = route((_req, { userId }) => {
  const me = requireUser(userId);
  const weekends = Array.from({ length: 8 }, (_, i) => {
    const d = weekendDates(i + 1);
    return { n: i + 1, start: d[0], end: d[2], label: weekendLabel(i + 1), busy: db().events.some((e) => e.going.includes(userId) && e.city && e.city !== me.city && d.includes(e.startsAt.slice(0, 10))) };
  });
  const taste = tasteFor(userId);
  const nudges = db()
    .rides.filter((r) => r.fromCity === me.city && r.seatsOpen > 0 && r.driverId !== userId && canSeeUser(userId, getUser(r.driverId)!))
    .map((r) => {
      const wk = weekends.find((w) => rideTouches(r.departAt, r.returnAt, w.start, w.end));
      const d = getUser(r.driverId)!;
      const ev = r.eventId ? db().events.find((e) => e.id === r.eventId) : undefined;
      return { rideId: r.id, driver: { id: d.id, name: d.name, avatar: d.avatar, connection: connection(userId, d.id)?.label }, toCity: r.toCity, toCityName: cityName(r.toCity), departAt: r.departAt, seatsOpen: r.seatsOpen, event: ev ? { id: ev.id, title: ev.title } : undefined, weekend: wk && !wk.busy ? { start: wk.start, end: wk.end, label: wk.label } : undefined };
    })
    .filter((n) => n.weekend)
    .sort((a, b) => a.departAt.localeCompare(b.departAt));
  return { homeCity: me.city, homeCityName: cityById(me.city ?? "")?.name, hasCar: !!me.hasCar, taste: taste.top, tasteSummary: taste.summary, weekends, nudges, budgets: [60, 100, 150, 300] };
});
