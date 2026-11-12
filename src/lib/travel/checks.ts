// Fact checks shared by the evaluation and the persona simulation. Personas give opinions; this code checks facts.
import { db, getUser } from "@/server/db";
import type { ID } from "@/types";
import { datesBetween } from "./tools";
import type { Trip } from "./validate";
import type { DiscoverRun } from "./store";
import { canSeeEvent, canSeePost, canSeeReel, canSeeUser } from "./visibility";

export interface TripAudit {
  tripId: string;
  city: string;
  /** every id on the rendered card, and whether it exists + is visible to the viewer */
  elements: { kind: string; id: string; exists: boolean; visible: boolean; inDates?: boolean }[];
  renderedViolations: number;
  fitsBudget: boolean;
  ifYes: number;
  otherwise: number;
  solo: number;
  hostOptedIn: boolean | null;
  hostDegree: number | null;
  fofHasMutual: boolean | null;
}
export interface RunAudit {
  runId: string;
  viewerId: string;
  input: DiscoverRun["input"];
  mode: string;
  costUsd: number;
  latencyMs: number;
  /** raw model proposal: how many ids it emitted and how many were real + visible */
  raw: { ids: number; grounded: number; privacyViolationsCaught: number; invented: number };
  trips: TripAudit[];
  declined: boolean;
}

function auditTrip(viewerId: ID, t: Trip): TripAudit {
  const dates = datesBetween(t.start, t.end);
  const elements: TripAudit["elements"] = [];
  const person = (kind: string, id: ID) => {
    const u = getUser(id);
    elements.push({ kind, id, exists: !!u, visible: !!u && canSeeUser(viewerId, u) });
  };
  if (t.host) person("host", t.host.id);
  if (t.ride) {
    const r = db().rides.find((x) => x.id === t.ride!.id);
    elements.push({ kind: "ride", id: t.ride.id, exists: !!r, visible: !!r && canSeeUser(viewerId, getUser(r.driverId)!), inDates: !!r && r.departAt.slice(0, 10) <= t.end });
    person("driver", t.ride.driver.id);
  }
  if (t.event) {
    const e = db().events.find((x) => x.id === t.event!.id);
    elements.push({ kind: "event", id: t.event.id, exists: !!e, visible: !!e && canSeeEvent(viewerId, e), inDates: !!e && dates.includes(e.startsAt.slice(0, 10)) });
  }
  for (const p of t.people) person("person", p.id);
  for (const ev of t.evidence) {
    if (ev.kind === "post") {
      const p = db().posts.find((x) => x.id === ev.id);
      elements.push({ kind: "post", id: ev.id, exists: !!p, visible: !!p && canSeePost(viewerId, p) });
    } else {
      const r = db().reels.find((x) => x.id === ev.id);
      elements.push({ kind: "reel", id: ev.id, exists: !!r, visible: !!r && canSeeReel(viewerId, r) });
    }
  }
  const hostUser = t.host ? getUser(t.host.id) : undefined;
  return {
    tripId: t.id, city: t.city, elements,
    renderedViolations: elements.filter((e) => !e.exists || !e.visible || e.inDates === false).length,
    fitsBudget: t.fitsBudget, ifYes: t.prices.ifYes.total, otherwise: t.prices.otherwise.total, solo: t.prices.solo.total,
    hostOptedIn: hostUser ? !!hostUser.openToHosting : null, hostDegree: t.host?.degree ?? null, fofHasMutual: t.host?.degree === 2 ? !!t.host.via : null,
  };
}

/** Grounding of the RAW proposal: did every id the model emitted exist and belong to this viewer's visible world? */
function auditRaw(viewerId: ID, run: DiscoverRun) {
  let ids = 0;
  let grounded = 0;
  let privacy = 0;
  let invented = 0;
  for (const p of run.proposal?.trips ?? []) {
    const check = (exists: boolean, visible: boolean) => {
      ids++;
      if (exists && visible) grounded++;
      else if (exists) privacy++;
      else invented++;
    };
    if (p.hostId) {
      const u = getUser(p.hostId);
      check(!!u, !!u && canSeeUser(viewerId, u));
    }
    if (p.rideId) {
      const r = db().rides.find((x) => x.id === p.rideId);
      check(!!r, !!r && canSeeUser(viewerId, getUser(r.driverId)!));
    }
    if (p.eventId) {
      const e = db().events.find((x) => x.id === p.eventId);
      check(!!e, !!e && canSeeEvent(viewerId, e));
    }
    for (const id of p.peopleIds ?? []) {
      const u = getUser(id);
      check(!!u, !!u && canSeeUser(viewerId, u));
    }
    for (const ev of p.evidence ?? []) {
      if (ev.kind === "post") {
        const x = db().posts.find((q) => q.id === ev.id);
        check(!!x, !!x && canSeePost(viewerId, x));
      } else {
        const x = db().reels.find((q) => q.id === ev.id);
        check(!!x, !!x && canSeeReel(viewerId, x));
      }
    }
  }
  return { ids, grounded, privacyViolationsCaught: privacy, invented };
}

export function auditRun(run: DiscoverRun): RunAudit {
  return { runId: run.id, viewerId: run.viewerId, input: run.input, mode: run.mode, costUsd: run.costUsd, latencyMs: run.latencyMs, raw: auditRaw(run.viewerId, run), trips: run.trips.map((t) => auditTrip(run.viewerId, t)), declined: run.trips.length === 0 };
}
