export {
  ACTION_PLAN_PROMPT_NAME,
  ACTION_PLAN_PROMPT_TEMPLATE,
  ACTION_PLAN_PROMPT_TEMPLATE_HASH,
  ACTION_PLAN_PROMPT_VERSION,
  ACTION_PLAN_RESPONSE_SCHEMA_VERSION,
} from "./prompt-contract";

export const ACTION_PLAN_GENERATION_JOB_POLICY = {
  maxAttempts: 5,
  cancellable: true,
  cancellationCapability: "plans:activate",
} as const;
