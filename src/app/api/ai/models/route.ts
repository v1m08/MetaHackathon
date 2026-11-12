import { route } from "@/server/http";
import { ai } from "@/lib/ai";
export const GET = route(async () => {
  if (ai.mode() === "mock") return { models: [], note: "Mock mode: set MODEL_API_KEY to list live models." };
  return { models: await ai.listModels() };
});
