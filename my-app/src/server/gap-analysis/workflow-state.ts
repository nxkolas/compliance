export function selectGapWorkflowRevisions<T extends { id: string }>(input: {
  current: T | null;
  accepted: T | null;
}) {
  return {
    accepted: input.accepted,
    candidate:
      input.current && input.current.id !== input.accepted?.id
        ? input.current
        : null,
  };
}

export const gapWorkflowSteps = [
  "questions",
  "documents",
  "review",
  "gaps",
] as const;

export type GapWorkflowStep = (typeof gapWorkflowSteps)[number];

export function deriveGapWorkflowNavigation(input: {
  prerequisiteSatisfied: boolean;
  hasAssessment: boolean;
  answeredQuestionCount: number;
  requiredQuestionCount: number;
  hasPreparedInputs: boolean;
  hasResult: boolean;
  requestedStep?: string | null;
}) {
  if (!input.prerequisiteSatisfied || !input.hasAssessment) {
    return {
      defaultStep: "questions" as const,
      activeStep: "questions" as const,
      allowedSteps: [] as GapWorkflowStep[],
    };
  }

  const questionsComplete =
    input.requiredQuestionCount > 0 &&
    input.answeredQuestionCount >= input.requiredQuestionCount;
  const allowedSteps: GapWorkflowStep[] = ["questions"];
  if (questionsComplete || input.hasResult) allowedSteps.push("documents");
  if (input.hasPreparedInputs || input.hasResult) allowedSteps.push("review");
  if (input.hasResult) allowedSteps.push("gaps");

  const defaultStep: GapWorkflowStep = input.hasResult
    ? "gaps"
    : input.hasPreparedInputs
      ? "review"
      : questionsComplete
        ? "documents"
        : "questions";
  const requested = gapWorkflowSteps.includes(
    input.requestedStep as GapWorkflowStep,
  )
    ? (input.requestedStep as GapWorkflowStep)
    : null;

  return {
    defaultStep,
    activeStep:
      requested && allowedSteps.includes(requested) ? requested : defaultStep,
    allowedSteps,
  };
}

export type GapStatus =
  | "fulfilled"
  | "partially_fulfilled"
  | "not_fulfilled"
  | "insufficient_evidence";

export const gapStatusOrder: GapStatus[] = [
  "not_fulfilled",
  "partially_fulfilled",
  "insufficient_evidence",
  "fulfilled",
];

export function countGapStatuses(
  findings: Array<{ finding: { status: GapStatus } }>,
) {
  const counts: Record<"all" | GapStatus, number> = {
    all: 0,
    fulfilled: 0,
    partially_fulfilled: 0,
    not_fulfilled: 0,
    insufficient_evidence: 0,
  };
  for (const row of findings) {
    counts[row.finding.status] += 1;
    if (row.finding.status !== "fulfilled") counts.all += 1;
  }
  return counts;
}

export function sortGapFindings<
  T extends {
    finding: { status: GapStatus };
    requirement: { position: number };
  },
>(findings: T[]) {
  return [...findings].sort(
    (left, right) =>
      gapStatusOrder.indexOf(left.finding.status) -
        gapStatusOrder.indexOf(right.finding.status) ||
      left.requirement.position - right.requirement.position,
  );
}

export function compareGapFindings<
  T extends {
    finding: { status: GapStatus };
    requirement: { stableRequirementId: string; title: unknown; position: number };
  },
>(accepted: T[], current: T[]) {
  const acceptedByRequirement = new Map(
    accepted.map((row) => [row.requirement.stableRequirementId, row]),
  );
  return current
    .map((row) => {
      const previous = acceptedByRequirement.get(
        row.requirement.stableRequirementId,
      );
      return {
        stableRequirementId: row.requirement.stableRequirementId,
        title: row.requirement.title,
        position: row.requirement.position,
        previousStatus: previous?.finding.status ?? null,
        currentStatus: row.finding.status,
        changed: previous?.finding.status !== row.finding.status,
      };
    })
    .sort((left, right) => left.position - right.position);
}
