import { contentHash } from "@/src/server/compliance/domain";

export const GAP_CATEGORY_EVALUATOR_KIND = "nis2_gap_category_v1";
export const GAP_CATEGORY_EVALUATOR_VERSION = 1;

export type GapAnswerValue =
  | "fully_implemented"
  | "partially_implemented"
  | "not_implemented"
  | "unsure"
  | "not_applicable";

export type DeterministicGapStatus =
  | "fulfilled"
  | "partially_fulfilled"
  | "not_fulfilled"
  | "insufficient_evidence";

const allowedValues = new Set<GapAnswerValue>([
  "fully_implemented",
  "partially_implemented",
  "not_implemented",
  "unsure",
  "not_applicable",
]);

export function evaluateGapCategory(
  answers: GapAnswerValue[],
): DeterministicGapStatus {
  if (answers.length === 0) throw new Error("Category has no answers");
  if (answers.some((answer) => !allowedValues.has(answer))) {
    throw new Error("Category contains an unknown answer value");
  }
  const applicable = answers.filter((answer) => answer !== "not_applicable");
  if (applicable.includes("not_implemented")) return "not_fulfilled";
  if (applicable.includes("partially_implemented")) {
    return "partially_fulfilled";
  }
  if (applicable.includes("unsure")) return "insufficient_evidence";
  if (applicable.includes("fully_implemented")) return "fulfilled";
  return "insufficient_evidence";
}

export function evaluateGapRequirement(input: {
  gapAnalysisReleaseId: string;
  questionnaireVersionId: string;
  assessmentRevisionId: string;
  requirementVersionId: string;
  answers: Array<{
    questionStableKey: string;
    stableValue: string;
  }>;
}) {
  const seen = new Set<string>();
  for (const answer of input.answers) {
    if (seen.has(answer.questionStableKey)) {
      throw new Error(`Duplicate answer ${answer.questionStableKey}`);
    }
    seen.add(answer.questionStableKey);
    if (!allowedValues.has(answer.stableValue as GapAnswerValue)) {
      throw new Error(`Unknown answer value ${answer.stableValue}`);
    }
  }
  const orderedAnswers = [...input.answers];
  return {
    status: evaluateGapCategory(
      orderedAnswers.map((answer) => answer.stableValue as GapAnswerValue),
    ),
    inputHash: contentHash({
      gapAnalysisReleaseId: input.gapAnalysisReleaseId,
      questionnaireVersionId: input.questionnaireVersionId,
      assessmentRevisionId: input.assessmentRevisionId,
      requirementVersionId: input.requirementVersionId,
      answers: orderedAnswers,
    }),
  };
}
