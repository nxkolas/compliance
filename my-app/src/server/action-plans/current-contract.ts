import { contentHash } from "@/src/server/compliance";
import {
  ACTION_PLAN_PROMPT_V6_NAME,
  ACTION_PLAN_PROMPT_V6_TEMPLATE,
  ACTION_PLAN_PROMPT_V6_TEMPLATE_HASH,
  ACTION_PLAN_PROMPT_V6_VERSION,
  ACTION_PLAN_RESPONSE_SCHEMA_V6_VERSION,
  actionPlanPromptV6,
  actionPlanRepairPromptV6,
} from "../ai/generation/action-plan-v6-contract";
import {
  buildActionPlanCategoryResponseSchemaV5,
  normalizeActionPlanCategoryResponseV5,
  type ActionPlanCategoryPolicyV5,
  type ActionPlanCategoryResponseV5,
} from "./generation-schema-v5";

export const CURRENT_ACTION_PLAN_PROMPT_METADATA = {
  name: ACTION_PLAN_PROMPT_V6_NAME,
  version: ACTION_PLAN_PROMPT_V6_VERSION,
  templateHash: ACTION_PLAN_PROMPT_V6_TEMPLATE_HASH,
  responseSchemaVersion: ACTION_PLAN_RESPONSE_SCHEMA_V6_VERSION,
} as const;

export const actionPlanDefinitionHash = contentHash({
  prompt: CURRENT_ACTION_PLAN_PROMPT_METADATA,
  generation: {
    categoryScoped: true,
    gapCoverage: "within-category-many-to-many",
    outputLocale: "caller-selected",
    responseNormalization: "current",
  },
});

export const actionPlanPrompt = actionPlanPromptV6;
export const actionPlanRepairPrompt = actionPlanRepairPromptV6;
export const ACTION_PLAN_PROMPT_TEMPLATE = ACTION_PLAN_PROMPT_V6_TEMPLATE;
export const buildActionPlanCategoryResponseSchema =
  buildActionPlanCategoryResponseSchemaV5;
export const normalizeActionPlanCategoryResponse =
  normalizeActionPlanCategoryResponseV5;

export type ActionPlanCategoryPolicy = ActionPlanCategoryPolicyV5;
export type ActionPlanCategoryResponse = ActionPlanCategoryResponseV5;
