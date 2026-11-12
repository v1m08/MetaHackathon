// Eval only: Muse picks the best host for a traveler from style lines + policies. Used for the blind A/B match set.
import { ai } from "@/lib/ai";
import { openDoorOf } from "@/lib/travel/openDoor";
import { styleConclusions } from "@/lib/travel/style";
import { getUser } from "@/server/db";
import { route } from "@/server/http";

export const maxDuration = 60;
export const POST = route(async (_req, { body }) => {
  const b = (await body()) as { travelerId: string; hostIds: string[] };
  const t = getUser(b.travelerId);
  if (!t) throw Object.assign(new Error("unknown traveler"), { status: 400 });
  const hosts = (b.hostIds ?? []).map(getUser).filter(Boolean) as NonNullable<ReturnType<typeof getUser>>[];
  const { data, trace } = await ai.json<{ hostId: string; why: string }>(
    `A traveler is choosing a host for a weekend. Pick the ONE host whose Open Door policy and travel style fit the traveler best, and say why in two sentences (refer to the host by id only).\nTraveler style: ${styleConclusions(t.id).join("; ") || "unknown"}.\nHosts:\n${hosts.map((h) => `${h.id}: policy "${openDoorOf(h).policy}"; style: ${styleConclusions(h.id).join("; ") || "unknown"}`).join("\n")}`,
    { task: "eval.opendoor.match", userId: t.id, schema: { type: "object", properties: { hostId: { type: "string", enum: hosts.map((h) => h.id) }, why: { type: "string" } }, required: ["hostId", "why"] }, maxTokens: 900, temperature: 0.2, cache: false, mock: () => ({ hostId: hosts[0]?.id, why: "(mock)" }) },
  );
  return { result: data, mode: trace.mode, costUsd: trace.costUsd ?? 0 };
});
