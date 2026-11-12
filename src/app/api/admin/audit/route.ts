// GET /api/admin/audit?runId=… → fact-check a Discover run (grounding, privacy, budget). Used by the eval and the sim.
import { auditRun } from "@/lib/travel/checks";
import { travelStore } from "@/lib/travel/store";
import { route } from "@/server/http";

export const GET = route((req) => {
  const runId = req.nextUrl.searchParams.get("runId");
  const runs = travelStore().runs;
  if (runId) {
    const run = runs.find((r) => r.id === runId);
    if (!run) throw Object.assign(new Error("run not found"), { status: 404 });
    return auditRun(run);
  }
  return runs.map(auditRun);
});
