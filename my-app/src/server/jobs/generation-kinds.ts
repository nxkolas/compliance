export const gapGenerationJobKind = "gap_analysis" as const;
export const actionPlanGenerationJobKind = "action_plan_generation" as const;
export const GAP_GENERATION_JOB_KINDS = [gapGenerationJobKind] as const;
export const ACTION_PLAN_GENERATION_JOB_KINDS = [actionPlanGenerationJobKind] as const;
export function isGapGenerationJobKind(kind: string) { return kind === gapGenerationJobKind; }
export function isActionPlanGenerationJobKind(kind: string) { return kind === actionPlanGenerationJobKind; }
