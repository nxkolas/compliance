import {
  buildActionPlanCategoryResponseSchemaV3,
  normalizeActionPlanCategoryResponseV3,
  type ActionPlanCategoryPolicyV3,
  type ActionPlanCategoryResponseV3,
} from "./generation-schema-v3";

export type ActionPlanCategoryPolicyV4 = ActionPlanCategoryPolicyV3;
export type ActionPlanCategoryResponseV4 = ActionPlanCategoryResponseV3;

export const buildActionPlanCategoryResponseSchemaV4 =
  buildActionPlanCategoryResponseSchemaV3;
export const normalizeActionPlanCategoryResponseV4 =
  normalizeActionPlanCategoryResponseV3;
