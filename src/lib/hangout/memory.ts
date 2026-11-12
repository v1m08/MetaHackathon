// Code check for the memory builder's output: keep only cited IDs that exist and include both people,
// then recompute counts and date ranges from those IDs so the model can't inflate them.
import type { EvidenceIndex } from "./evidence";
import type { InsideJoke, SharedPlace } from "./types";
import type { MemoryAi } from "./schemas";

const shared = (index: EvidenceIndex, id: string, friendId: string, meId: string) => {
  const e = index.get(id);
  return !!e && e.people.includes(meId) && e.people.includes(friendId);
};

export function verifyMemory(raw: MemoryAi, friendId: string, index: EvidenceIndex, meId = "me"): { sharedPlaces: SharedPlace[]; insideJokes: InsideJoke[]; dropped: string[] } {
  const dropped: string[] = [];
  const sharedPlaces: SharedPlace[] = [];
  for (const p of raw.sharedPlaces) {
    const photoIds = [...new Set(p.photoIds)].filter((id) => {
      const ok = shared(index, id, friendId, meId) && index.get(id)!.kind === "photo";
      if (!ok) dropped.push(id);
      return ok;
    });
    if (!photoIds.length) continue;
    const dates = photoIds.map((id) => index.get(id)!.date).sort();
    sharedPlaces.push({ name: p.name, count: photoIds.length, firstDate: dates[0], lastDate: dates.at(-1)!, photoIds: photoIds.sort((a, b) => index.get(a)!.date.localeCompare(index.get(b)!.date)) });
  }
  const insideJokes: InsideJoke[] = [];
  for (const j of raw.insideJokes) {
    const sourceIds = [...new Set(j.sourceIds)].filter((id) => {
      const ok = shared(index, id, friendId, meId);
      if (!ok) dropped.push(id);
      return ok;
    });
    if (sourceIds.length) insideJokes.push({ phrase: j.phrase, sourceIds });
  }
  sharedPlaces.sort((a, b) => b.count - a.count);
  return { sharedPlaces, insideJokes, dropped };
}
