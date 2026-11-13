import type { TemplateId } from "../../../shared/schema";
import type { GameTemplate } from "../engine/engine";
import { catcher } from "./catcher";
import { dodger } from "./dodger";
import { shot } from "./shot";
import { trivia } from "./trivia";

export const TEMPLATE_IMPLS: Record<TemplateId, GameTemplate> = { dodger, shot, catcher, trivia };
