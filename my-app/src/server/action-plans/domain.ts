export {
  ACTION_PLAN_PROMPT_NAME,
  ACTION_PLAN_PROMPT_TEMPLATE,
  ACTION_PLAN_PROMPT_TEMPLATE_HASH,
  ACTION_PLAN_PROMPT_VERSION,
  ACTION_PLAN_RESPONSE_SCHEMA_VERSION,
} from "./prompt-contract";
export { ACTION_PLAN_PROMPT_V3_TEMPLATE_HASH } from "./prompt-contract-v3";
export { ACTION_PLAN_PROMPT_V4_TEMPLATE_HASH } from "./prompt-contract-v4";
export { ACTION_PLAN_PROMPT_V5_TEMPLATE_HASH } from "./prompt-contract-v5";
export { ACTION_PLAN_PROMPT_V6_TEMPLATE_HASH } from "./prompt-contract-v6";

export const ACTION_PLAN_GENERATION_JOB_POLICY = {
  maxAttempts: 3,
  cancellable: true,
  cancellationCapability: "plans:activate",
} as const;
