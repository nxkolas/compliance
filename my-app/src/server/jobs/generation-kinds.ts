export const GAP_GENERATION_JOB_KINDS = [
  "gap-generation",
  "gap-generation-v8",
] as const;

export const ACTION_PLAN_GENERATION_JOB_KINDS = [
  "action-plan-generation",
  "action-plan-generation-v2",
] as const;

export function gapGenerationJobKind(responseSchemaVersion: string) {
  return responseSchemaVersion === "8"
    ? GAP_GENERATION_JOB_KINDS[1]
    : GAP_GENERATION_JOB_KINDS[0];
}

export function actionPlanGenerationJobKind(responseSchemaVersion: string) {
  return responseSchemaVersion === "2"
    ? ACTION_PLAN_GENERATION_JOB_KINDS[1]
    : ACTION_PLAN_GENERATION_JOB_KINDS[0];
}

export function isGapGenerationJobKind(kind: string) {
  return (GAP_GENERATION_JOB_KINDS as readonly string[]).includes(kind);
}

export function isActionPlanGenerationJobKind(kind: string) {
  return (ACTION_PLAN_GENERATION_JOB_KINDS as readonly string[]).includes(
    kind,
  );
}
