export const GAP_GENERATION_JOB_KINDS = [
  "gap-generation",
  "gap-generation-v8",
  "gap-generation-v9",
  "gap-generation-v10",
  "gap-generation-v11",
] as const;

export const ACTION_PLAN_GENERATION_JOB_KINDS = [
  "action-plan-generation",
  "action-plan-generation-v2",
  "action-plan-generation-v3",
  "action-plan-generation-v4",
  "action-plan-generation-v5",
  "action-plan-generation-v6",
] as const;

export function gapGenerationJobKind(responseSchemaVersion: string) {
  if (responseSchemaVersion === "11") return GAP_GENERATION_JOB_KINDS[4];
  if (responseSchemaVersion === "10") return GAP_GENERATION_JOB_KINDS[3];
  if (responseSchemaVersion === "9") return GAP_GENERATION_JOB_KINDS[2];
  if (responseSchemaVersion === "8") return GAP_GENERATION_JOB_KINDS[1];
  return GAP_GENERATION_JOB_KINDS[0];
}

export function actionPlanGenerationJobKind(responseSchemaVersion: string) {
  if (responseSchemaVersion === "6") {
    return ACTION_PLAN_GENERATION_JOB_KINDS[5];
  }
  if (responseSchemaVersion === "5") {
    return ACTION_PLAN_GENERATION_JOB_KINDS[4];
  }
  if (responseSchemaVersion === "4") {
    return ACTION_PLAN_GENERATION_JOB_KINDS[3];
  }
  if (responseSchemaVersion === "3") {
    return ACTION_PLAN_GENERATION_JOB_KINDS[2];
  }
  if (responseSchemaVersion === "2") {
    return ACTION_PLAN_GENERATION_JOB_KINDS[1];
  }
  return ACTION_PLAN_GENERATION_JOB_KINDS[0];
}

export function isGapGenerationJobKind(kind: string) {
  return (GAP_GENERATION_JOB_KINDS as readonly string[]).includes(kind);
}

export function isActionPlanGenerationJobKind(kind: string) {
  return (ACTION_PLAN_GENERATION_JOB_KINDS as readonly string[]).includes(kind);
}
