import type { TemplateId } from "../../../shared/schema";
import type { GameTemplate } from "../engine/engine";
import { catcher } from "./catcher";
import { dodger } from "./dodger";
import { shot } from "./shot";
import { trivia } from "./trivia";

/** Canvas templates. Word hunt is a DOM game (see games/wordhunt.ts). */
export const TEMPLATE_IMPLS: Partial<Record<TemplateId, GameTemplate>> = { dodger, shot, catcher, trivia };
