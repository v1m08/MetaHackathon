// zod schemas for every Muse response. The JSON Schema sent to the model is derived from these;
// refinements (word limits, "nudge needs evidence") are enforced by zod after the call.
import { z } from "zod";
import { ACCESSORY_IDS, BODY_IDS, COLOR_IDS, KEEPSAKE_IDS } from "./parts";

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const NO_EM_DASH = (s: string) => !s.includes("—");

/** A. Memory builder (Muse Ember). Counts and dates are recomputed in code from the verified photo IDs. */
export const MemoryAiSchema = z.object({
  sharedPlaces: z.array(z.object({ name: z.string().min(1), photoIds: z.array(z.string()) })),
  insideJokes: z.array(z.object({ phrase: z.string().min(1), sourceIds: z.array(z.string()) })),
});
export type MemoryAi = z.infer<typeof MemoryAiSchema>;

/** C. Why-now detector (Muse Wonder). */
export const WhyNowSchema = z
  .object({
    nudge: z.boolean(),
    type: z.enum(["place", "joke", "life_update", "drift"]).nullable(),
    reason: z.string(),
    evidenceIds: z.array(z.string()),
    action: z.enum(["send_photo", "say_hi", "suggest_plan"]).nullable(),
    photoId: z.string().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.nudge) return;
    if (!v.type) ctx.addIssue({ code: "custom", path: ["type"], message: "required when nudge is true" });
    if (!v.action) ctx.addIssue({ code: "custom", path: ["action"], message: "required when nudge is true" });
    if (!v.reason.trim()) ctx.addIssue({ code: "custom", path: ["reason"], message: "required when nudge is true" });
    if (words(v.reason) > 20) ctx.addIssue({ code: "custom", path: ["reason"], message: "max 20 words" });
    if (!NO_EM_DASH(v.reason)) ctx.addIssue({ code: "custom", path: ["reason"], message: "no em-dashes" });
    if (!v.evidenceIds.length) ctx.addIssue({ code: "custom", path: ["evidenceIds"], message: "cite at least one shared item" });
  });
export type WhyNow = z.infer<typeof WhyNowSchema>;

/** E. Critter designer (Muse Wonder). */
export const CritterSchema = z.object({
  body: z.enum(BODY_IDS),
  color: z.enum(COLOR_IDS),
  accessory: z.enum(ACCESSORY_IDS),
  why: z.string().min(1).refine((s) => words(s) <= 16, "max 16 words").refine(NO_EM_DASH, "no em-dashes"),
});
export type CritterAi = z.infer<typeof CritterSchema>;

/** F. Plan proposer (Muse Wonder). Slot and cost are checked in code. */
export const PlanSchema = z.object({
  place: z.string().min(1),
  slotId: z.string().min(1),
  estCostPerPerson: z.number().min(0),
  reason: z.string().min(1).refine((s) => words(s) <= 20, "max 20 words").refine(NO_EM_DASH, "no em-dashes"),
});
export type PlanAi = z.infer<typeof PlanSchema>;

/** G. Keepsake picker (Muse Wonder). */
export const KeepsakeSchema = z.object({
  pin: z.enum(KEEPSAKE_IDS),
  why: z.string().min(1).refine((s) => words(s) <= 10, "max 10 words"),
});
export type KeepsakeAi = z.infer<typeof KeepsakeSchema>;

/** Models love em-dashes. Swap them for commas before validating instead of burning a retry. */
export function softenDashes<T>(raw: T): T {
  if (typeof raw === "string") return raw.replace(/\s*—\s*/g, ", ") as T;
  if (Array.isArray(raw)) return raw.map(softenDashes) as T;
  if (raw && typeof raw === "object") return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, softenDashes(v)])) as T;
  return raw;
}
