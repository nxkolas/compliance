import type { Locale } from "@/lib/i18n-config";
import type { ruleSets } from "@/src/db/schema";

export type RuntimeReleaseOption = {
  id: string;
  stableValue: string;
  catalogCode: string;
  label: string;
  position: number;
  metadata: unknown;
};

export type RuntimeReleaseQuestion = {
  id: string;
  stableKey: string;
  position: number;
  questionText: string;
  helpText: string | null;
  answerType: string;
  required: boolean;
  config: unknown;
  options: RuntimeReleaseOption[];
  factMappings: Array<{ factKey: string; transform: unknown }>;
};

export type PublishedComplianceRelease = {
  checkCode: string;
  checkReleaseId: string;
  releaseVersionLabel: string;
  aggregateHash: string;
  defaultLocale: string;
  locale: Locale;
  moduleId: string;
  questionnaireId: string;
  questionnaireVersionId: string;
  questionnaireTitle: string;
  questionnaireCode: string;
  ruleSet: typeof ruleSets.$inferSelect;
  scopeModelVersionId: string;
  questions: RuntimeReleaseQuestion[];
  contentByStableKey: Record<string, string>;
  questionIndexByFactKey: Record<string, number>;
  optionIndexByQuestionAndValue: Record<
    string,
    { questionIndex: number; optionIndex: number }
  >;
};

export type ActiveReleasePointer = {
  checkCode: string;
  checkReleaseId: string;
  versionLabel: string;
};

export type ResolvedComplianceRelease = {
  published: PublishedComplianceRelease;
  activePointer: ActiveReleasePointer | null;
  isActive: boolean;
};

export type RuntimeReleaseReader = {
  getPublished(input: {
    checkReleaseId: string;
    locale: Locale;
  }): Promise<PublishedComplianceRelease | null>;
  getActive(input: {
    checkCode: string;
    locale: Locale;
  }): Promise<ResolvedComplianceRelease | null>;
  getActivePointer(checkCode: string): Promise<ActiveReleasePointer | null>;
};

export function optionIndexKey(questionId: string, stableValue: string) {
  return `${questionId}\u0000${stableValue}`;
}
