export type {
  AtomicGapKind,
  GapStatementBasis,
  ValidatedCategoryGapResult,
} from "./generation-schema-v7";
export {
  GAP_GROUNDING_INSTRUCTION,
  gapOutputLocaleInstruction,
} from "./grounding-instruction";
export {
  evaluateGapApplicabilityPrerequisite,
} from "./applicability-eligibility";

export type QuestionnaireRevision = {
  id: string;
  assessmentId: string;
  revisionNumber: number;
  questionnaireVersionId: string;
};

export type GapAnalysisRevision = {
  id: string;
  artifactId: string;
  revisionNumber: number;
  outputLocale: "de" | "en";
};

export type GapAnalysisCycle = {
  id: string;
  assessmentId: string;
  assessmentRevisionId: string;
  status: "open" | "locked" | "generated" | "failed" | "cancelled";
  outputLocale: "de" | "en";
  lockVersion: number;
  generationJobId: string | null;
  outputGapRevisionId: string | null;
};
export type {
  GapApplicabilityPrerequisite,
} from "./applicability-eligibility";
