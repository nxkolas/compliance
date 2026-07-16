import type { Locale } from "@/lib/i18n-config";
import { loadActiveComplianceRelease } from "../compliance/release-service";

export type QuestionnairePreviewDto = {
  id: string;
  title: string;
  code: string;
  versionLabel: string;
  questions: QuestionnairePreviewQuestionDto[];
};

export type QuestionnairePreviewQuestionDto = {
  id: string;
  stableKey: string;
  position: number;
  questionText: string;
  helpText: string | null;
  answerType: string;
  required: boolean;
  config: unknown;
  options: QuestionnairePreviewOptionDto[];
};

export type QuestionnairePreviewOptionDto = {
  id: string;
  stableValue: string;
  label: string;
  position: number;
  metadata: unknown;
};

export async function getActiveApplicabilityQuestionnaire(
  locale: Locale,
): Promise<QuestionnairePreviewDto | null> {
  const release = await loadActiveComplianceRelease(locale);
  if (!release) return null;
  return {
    id: release.questionnaireId,
    title: release.questionnaireTitle,
    code: release.questionnaireCode,
    versionLabel: release.releaseVersionLabel,
    questions: release.questions.map(({ factMappings, ...question }) => {
      void factMappings;
      return question;
    }),
  };
}
