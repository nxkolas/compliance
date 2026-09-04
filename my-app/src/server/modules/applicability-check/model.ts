import type { Locale } from "@/lib/i18n-config";
import { db } from "@/src/db";
import { getCurrentApplicabilityDefinition } from "./release/current";
import { type LocalizedRuleEvaluationResult } from "./localize-evaluation";
import { type ApplicabilityAnswerValue } from "../compliance/runtime-release/question-visibility";
import { type StoredRuleEvaluationResult } from "../compliance/nis2/rule-evaluation-schema";

export type Definition = ReturnType<typeof getCurrentApplicabilityDefinition>;

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ApplicabilityOptionDto = Definition["questions"][number]["options"][number];

export type ApplicabilityQuestionDto = Omit<
  Definition["questions"][number],
  "factMappings"
>;

export type ApplicabilityQuestionnaireDto = {
  id: string;
  locale: Locale;
  title: string;
  code: string;
  versionLabel: string;
  questions: ApplicabilityQuestionDto[];
  entityCatalogs: Record<string, ApplicabilityOptionDto[]>;
  contentByStableKey: Record<string, string>;
  defaultAnswers: Record<string, ApplicabilityAnswerValue>;
  latestAnswers: Record<string, ApplicabilityAnswerValue>;
  definition: {
    hash: string;
    versionLabel: string;
    supportedJurisdictionCodes: string[];
  };
  guestSession?: GuestApplicabilitySession;
};

export type ApplicabilityOverviewDto = {
  assessmentId: string;
  assessmentRevisionId: string;
  assessmentRevisionNumber: number;
  submittedAt: string;
  result: ApplicabilityResultDto | null;
};

export type ApplicabilityAnswersDto = {
  assessmentId: string;
  assessmentRevisionId: string;
  assessmentRevisionNumber: number;
  submittedAt: string;
  answers: Array<{
    questionId: string;
    questionStableKey: string;
    questionText: string;
    questionConfig: unknown;
    questionPosition: number;
    answerValue: unknown;
    answerLabel: string | null;
    answerMetadata: unknown;
  }>;
};

export type ApplicabilityResultDto = {
  outputRevisionId: string;
  outputRevisionNumber: number;
  createdAt: string;
  assessmentRevisionId: string | null;
  evidence: StoredRuleEvaluationResult;
  result: LocalizedRuleEvaluationResult;
  definition: {
    hash: string;
    versionLabel: string;
    isOutdated: boolean;
    supportedJurisdictionCodes: string[];
  };
};

export type GuestApplicabilitySession = { id: string; token: string };

export type GuestApplicabilityCheckDto = {
  id: string;
  submittedAt: string;
  expiresAt: string;
  result: ApplicabilityResultDto;
};

export type ClaimGuestApplicabilityCheckInput = {
  organizationId: string;
  checkId?: string;
};

export type ValidatedAnswer = {
  questionId: string;
  questionStableKey: string;
  questionText: string;
  questionPosition: number;
  answerValue: ApplicabilityAnswerValue;
  selectedOptionLabels: string[];
};

export type PreparedSubmission = {
  definition: Definition;
  locale: Locale;
  answers: ValidatedAnswer[];
  evidence: StoredRuleEvaluationResult;
  result: LocalizedRuleEvaluationResult;
  inputHash: string;
  now: Date;
};

export type StoredResultSnapshot = {
  evidence: StoredRuleEvaluationResult;
  result: LocalizedRuleEvaluationResult;
  versionLabel: string;
};
