import {
  organizationProgressStepKeys,
  type OrganizationProgress,
  type OrganizationProgressStepKey,
} from "@/src/contracts/organization-progress";

const terminalActionPlanItemStatuses = new Set(["done", "cancelled"]);

export type OrganizationProgressSignals = {
  welcomeCompleted?: boolean;
  hasAcceptedApplicability: boolean;
  applicabilityOutcome: string | null;
  hasAcceptedGapAnalysis: boolean;
  hasUploadedDocument: boolean;
  hasActivatedActionPlan: boolean;
  activeActionPlanItemStatuses: readonly string[] | null;
};

export function deriveOrganizationProgress(
  signals: OrganizationProgressSignals,
): OrganizationProgress {
  const completed = new Set<OrganizationProgressStepKey>();

  if (signals.welcomeCompleted || signals.hasAcceptedApplicability) {
    completed.add("welcome");
  }
  if (signals.hasAcceptedApplicability) {
    completed.add("applicability_check");
  }
  if (signals.hasAcceptedGapAnalysis) {
    completed.add("gap_analysis");
  }
  if (signals.hasUploadedDocument) {
    completed.add("documents_uploaded");
  }
  if (signals.hasActivatedActionPlan) {
    completed.add("action_plan");
  }
  if (
    signals.activeActionPlanItemStatuses !== null &&
    signals.activeActionPlanItemStatuses.every((status) =>
      terminalActionPlanItemStatuses.has(status),
    )
  ) {
    completed.add("next_steps");
  }

  const notApplicable =
    signals.hasAcceptedApplicability &&
    signals.applicabilityOutcome === "not_directly_in_scope"
      ? new Set<OrganizationProgressStepKey>([
          "gap_analysis",
          "documents_uploaded",
          "action_plan",
          "next_steps",
        ])
      : new Set<OrganizationProgressStepKey>();

  return buildProgress(completed, notApplicable);
}

export function applyWelcomeCompletion(
  progress: OrganizationProgress,
  completed: boolean,
): OrganizationProgress {
  if (!completed || progress.steps[0].completed) {
    return progress;
  }

  const completedSteps = new Set<OrganizationProgressStepKey>(["welcome"]);

  for (const step of progress.steps) {
    if (step.completed) completedSteps.add(step.key);
  }

  return buildProgress(completedSteps, new Set());
}

function buildProgress(
  completed: ReadonlySet<OrganizationProgressStepKey>,
  notApplicable: ReadonlySet<OrganizationProgressStepKey>,
): OrganizationProgress {
  const steps = organizationProgressStepKeys.map((key) => ({
    key,
    completed: completed.has(key),
  })) as OrganizationProgress["steps"];

  const applicableStepKeys = organizationProgressStepKeys.filter(
    (key) => !notApplicable.has(key),
  );

  return {
    completedCount: applicableStepKeys.filter((key) => completed.has(key))
      .length,
    totalCount: applicableStepKeys.length as 2 | 6,
    steps,
  };
}
