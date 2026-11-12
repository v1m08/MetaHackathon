// Persona simulation turn. A simulated young adult (played by Muse, cheap model) reacts to what the real product
// returned. Goes through the normal AI client so it is traced, cached and budget-guarded. Opinions only: facts
// (grounding, privacy, budget) are checked by /api/admin/audit, never by the persona.
import { ai } from "@/lib/ai";
import { route } from "@/server/http";

export const maxDuration = 60;

const VERDICT = {
  type: "object",
  properties: {
    pickTripIndex: { type: "integer", description: "Index of the trip you'd actually take, or -1 for none." },
    wouldTake: { type: "boolean" },
    surprising: { type: "integer", minimum: 1, maximum: 5 },
    trustworthy: { type: "integer", minimum: 1, maximum: 5 },
    reason: { type: "string", description: "One or two sentences in your own voice." },
    objections: { type: "array", items: { type: "string" } },
    looksBroken: { type: "array", items: { type: "string" }, description: "Anything that looks wrong, impossible or made up. Empty if nothing." },
  },
  required: ["pickTripIndex", "wouldTake", "surprising", "trustworthy", "reason", "objections", "looksBroken"],
};
const DRAFTS = {
  type: "object",
  properties: {
    decisions: { type: "array", items: { type: "object", properties: { draftId: { type: "string" }, action: { type: "string", enum: ["approve", "edit", "discard"] }, text: { type: "string", description: "Your edited message if action is edit." }, why: { type: "string" } }, required: ["draftId", "action", "why"] } },
    guideFeedback: { type: "string", description: "One sentence on the guide: was it for you, and did the credits make sense?" },
  },
  required: ["decisions", "guideFeedback"],
};

export const POST = route(async (_req, { userId, body }) => {
  const b = (await body()) as { persona: string; stage: "trips" | "drafts"; trips?: unknown; trip?: unknown; guide?: unknown; drafts?: unknown; budget?: number; weekend?: string };
  const system = `You are role-playing a specific young adult using a Facebook feature called "Where can my people take me?". Stay in character: ${b.persona}\nYou are blunt and specific. You are NOT the product's fan. Judge only what is shown; do not invent facts. This is a simulation for product testing.`;
  if (b.stage === "trips") {
    const { data, trace } = await ai.json(
      `You asked for a weekend (${b.weekend}) with a budget of about $${b.budget}. The app proposed these trips (JSON):\n${JSON.stringify(b.trips).slice(0, 9000)}\n\nReact as yourself. Would you take one? Which? How surprising (1-5) and how trustworthy (1-5) does it feel? What are your objections (money, strangers, distance, the people, the dates)? Does anything look broken or made up?`,
      { task: "sim.persona.trips", userId, schema: VERDICT, model: ai.models.fast(), maxTokens: 1200, temperature: 0.7, cache: false, mock: () => ({ pickTripIndex: 0, wouldTake: true, surprising: 3, trustworthy: 3, reason: "(mock) sure", objections: [], looksBroken: [] }) },
    );
    return { verdict: data, mode: trace.mode, costUsd: trace.costUsd ?? 0 };
  }
  const { data, trace } = await ai.json(
    `You picked this trip (JSON): ${JSON.stringify(b.trip).slice(0, 4000)}\n\nThe app built you this guide (JSON): ${JSON.stringify(b.guide).slice(0, 5000)}\n\nIt also drafted these messages for you to approve, edit or discard before anything is sent (JSON): ${JSON.stringify(b.drafts).slice(0, 4000)}\n\nDecide for each draft (by draftId). Approve only what you would really send. Edit if the words aren't you. Discard if you wouldn't ask this person.`,
    { task: "sim.persona.drafts", userId, schema: DRAFTS, model: ai.models.fast(), maxTokens: 1400, temperature: 0.7, cache: false, mock: () => ({ decisions: [], guideFeedback: "(mock)" }) },
  );
  return { decisions: data, mode: trace.mode, costUsd: trace.costUsd ?? 0 };
});
