import { contentHash } from "@/src/server/compliance";
import {
  ACTION_PLAN_PROMPT_NAME,
  ACTION_PLAN_PROMPT_TEMPLATE,
  ACTION_PLAN_PROMPT_TEMPLATE_HASH,
  ACTION_PLAN_PROMPT_VERSION,
  ACTION_PLAN_RESPONSE_SCHEMA_VERSION,
  actionPlanPrompt,
  actionPlanRepairPrompt,
} from "./prompt-contract";
import {
  buildActionPlanCategoryResponseSchema,
  normalizeActionPlanCategoryResponse,
  type ActionPlanCategoryPolicy,
  type ActionPlanCategoryResponse,
} from "./generation-schema";

export const CURRENT_ACTION_PLAN_PROMPT_METADATA = {
  name: ACTION_PLAN_PROMPT_NAME,
  version: ACTION_PLAN_PROMPT_VERSION,
  templateHash: ACTION_PLAN_PROMPT_TEMPLATE_HASH,
  responseSchemaVersion: ACTION_PLAN_RESPONSE_SCHEMA_VERSION,
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

export {
  ACTION_PLAN_PROMPT_TEMPLATE,
  actionPlanPrompt,
  actionPlanRepairPrompt,
  buildActionPlanCategoryResponseSchema,
  normalizeActionPlanCategoryResponse,
};

export type { ActionPlanCategoryPolicy, ActionPlanCategoryResponse };
