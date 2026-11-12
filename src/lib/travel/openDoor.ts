// Open Door: who a host's door is open to, decided by code from the host's chosen tier and the real graph.
// The model never decides reach; it only interprets the policy text within the reach code allows.
import { db, getUser } from "@/server/db";
import type { ID, OpenDoor, OpenDoorTier, User } from "@/types";
import { connection, mutuals } from "./visibility";

export const DEFAULT_OPEN_DOOR: OpenDoor = { on: false, policy: "", tier: "friends", offers: ["couch"], maxGuests: 1 };
export const openDoorOf = (u: User): OpenDoor => u.openDoor ?? DEFAULT_OPEN_DOOR;
export const offersCouch = (u: User) => { const d = openDoorOf(u); return d.on && d.offers.includes("couch"); };
export const offersRide = (u: User) => { const d = openDoorOf(u); return d.on && d.offers.includes("ride"); };
export const offersTour = (u: User) => { const d = openDoorOf(u); return d.on && d.offers.includes("show-around"); };

/** Keep the legacy fields in sync so every older code path (cards, validator, eval) sees the same truth. */
export function syncLegacyHosting(u: User) {
  u.openToHosting = offersCouch(u);
  u.hostingNote = openDoorOf(u).on ? openDoorOf(u).policy.slice(0, 140) : undefined;
}

/** Shared groups make two people part of each other's "broader network" even without a mutual friend. */
export const sharedGroups = (a: ID, b: ID) => db().groups.filter((g) => g.memberIds.includes(a) && g.memberIds.includes(b)).map((g) => g.id);

/** The closest tier that connects traveler → host, or null if the host cannot be reached at all. */
export function reachTier(hostId: ID, travelerId: ID): OpenDoorTier | null {
  if (hostId === travelerId) return null;
  const c = connection(travelerId, hostId);
  if (c?.degree === 1) return "friends";
  if (c?.degree === 2) return "fof";
  if (sharedGroups(hostId, travelerId).length) return "network";
  return null;
}
const RANK: Record<OpenDoorTier, number> = { friends: 0, fof: 1, network: 2 };
/** Can this traveler's agent knock on this host's door? Tier is the host's choice; reach is the graph's fact. */
export function doorOpenTo(hostId: ID, travelerId: ID): { open: boolean; tier: OpenDoorTier | null; why: string } {
  const host = getUser(hostId);
  if (!host) return { open: false, tier: null, why: "no such person" };
  const d = openDoorOf(host);
  if (!d.on) return { open: false, tier: null, why: "door is off" };
  const t = reachTier(hostId, travelerId);
  if (!t) return { open: false, tier: null, why: "not connected" };
  const open = RANK[t] <= RANK[d.tier];
  return { open, tier: t, why: open ? `open to ${d.tier}, you are ${t}` : `only open to ${d.tier}, you are ${t}` };
}

/** How two people are connected, in words the reveal card can show: mutuals, shared school, shared hometown, shared groups. */
export function connectionFacts(a: ID, b: ID): string[] {
  const ua = getUser(a), ub = getUser(b);
  if (!ua || !ub) return [];
  const out: string[] = [];
  const c = connection(a, b);
  if (c?.degree === 1) out.push(c.label === "friends" ? "you're friends" : c.label);
  const m = mutuals(a, b).map((id) => getUser(id)?.name.split(" ")[0]).filter(Boolean);
  if (m.length) out.push(`${m.length} mutual friend${m.length === 1 ? "" : "s"}: ${m.slice(0, 3).join(", ")}${m.length > 3 ? ` +${m.length - 3}` : ""}`);
  const school = (s?: string) => s?.split("·")[0].trim();
  if (ua.school && ub.school && school(ua.school) === school(ub.school)) out.push(`you both went to ${school(ua.school)}`);
  if (ua.hometown && ub.hometown && ua.hometown === ub.hometown) out.push(`you're both from ${ua.hometown}`);
  const g = sharedGroups(a, b).map((id) => db().groups.find((x) => x.id === id)?.name).filter(Boolean);
  if (g.length) out.push(`both in ${g.slice(0, 2).join(" and ")}`);
  return out;
}

export function setOpenDoor(u: User, patch: Partial<OpenDoor>) {
  const cur = openDoorOf(u);
  const next: OpenDoor = {
    on: typeof patch.on === "boolean" ? patch.on : cur.on,
    policy: typeof patch.policy === "string" ? patch.policy.slice(0, 400) : cur.policy,
    tier: patch.tier && patch.tier in RANK ? patch.tier : cur.tier,
    offers: Array.isArray(patch.offers) ? (patch.offers.filter((o) => ["couch", "ride", "show-around"].includes(o)) as OpenDoor["offers"]) : cur.offers,
    maxGuests: typeof patch.maxGuests === "number" && patch.maxGuests >= 1 && patch.maxGuests <= 6 ? Math.round(patch.maxGuests) : cur.maxGuests,
    updatedAt: new Date().toISOString(),
  };
  u.openDoor = next;
  syncLegacyHosting(u);
  return next;
}
