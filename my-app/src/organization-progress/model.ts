import {
  organizationProgressStepKeys,
  type OrganizationProgress,
  type OrganizationProgressStepKey,
  type OrganizationProgressStepStatus,
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

  return buildSequentialProgress(completed, notApplicable);
}

export function applyWelcomeCompletion(
  progress: OrganizationProgress,
  completed: boolean,
): OrganizationProgress {
  if (!completed || progress.steps[0].status === "completed") {
    return progress;
  }

  const completedSteps = new Set<OrganizationProgressStepKey>(["welcome"]);
  const notApplicableSteps = new Set<OrganizationProgressStepKey>();

  for (const step of progress.steps) {
    if (step.status === "completed") completedSteps.add(step.key);
    if (step.status === "not_applicable") notApplicableSteps.add(step.key);
  }

  return buildSequentialProgress(completedSteps, notApplicableSteps);
}

function buildSequentialProgress(
  completed: ReadonlySet<OrganizationProgressStepKey>,
  notApplicable: ReadonlySet<OrganizationProgressStepKey>,
): OrganizationProgress {
  let prerequisiteComplete = true;
  let currentStep: OrganizationProgressStepKey | null = null;

  const steps = organizationProgressStepKeys.map((key) => {
    let status: OrganizationProgressStepStatus;

    if (notApplicable.has(key)) {
      status = "not_applicable";
    } else if (prerequisiteComplete && completed.has(key)) {
      status = "completed";
    } else if (currentStep === null) {
      status = "current";
      currentStep = key;
      prerequisiteComplete = false;
    } else {
      status = "upcoming";
      prerequisiteComplete = false;
    }

    return { key, status };
  }) as OrganizationProgress["steps"];

  const applicableSteps = steps.filter(
    (step) => step.status !== "not_applicable",
  );

  return {
    currentStep,
    completedCount: applicableSteps.filter(
      (step) => step.status === "completed",
    ).length,
    totalCount: applicableSteps.length as 2 | 6,
    steps,
  };
}
