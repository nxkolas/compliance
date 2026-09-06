export type DashboardProgressInput = {
  applicabilityAccepted: boolean;
  applicabilityOutcome?: string | null;
  gapAccepted: boolean;
  gapAnswered: number;
  gapTotal: number;
  actionStatuses: {
    open: number;
    inProgress: number;
    done: number;
    cancelled: number;
  };
  actionPlanExists: boolean;
};

export type DashboardProgress = {
  percentage: number;
  applicability: number;
  gapAnalysis: number;
  actionPlan: number;
};

export function calculateDashboardProgress(
  input: DashboardProgressInput,
): DashboardProgress {
  if (
    input.applicabilityAccepted &&
    input.applicabilityOutcome === "not_directly_in_scope"
  ) {
    return {
      percentage: 100,
      applicability: 100,
      gapAnalysis: 100,
      actionPlan: 100,
    };
  }

  const applicability = input.applicabilityAccepted ? 100 : 0;
  const gapAnalysis = input.gapAccepted
    ? 100
    : percentage(input.gapAnswered, input.gapTotal);
  const nonCancelled =
    input.actionStatuses.open +
    input.actionStatuses.inProgress +
    input.actionStatuses.done;
  const actionPlan = input.actionPlanExists
    ? percentage(
        input.actionStatuses.done + input.actionStatuses.inProgress * 0.5,
        nonCancelled,
      )
    : 0;

  return {
    percentage: Math.round((applicability + gapAnalysis + actionPlan) / 3),
    applicability,
    gapAnalysis,
    actionPlan,
  };
}

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}
