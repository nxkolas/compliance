import type { Locale } from "@/lib/i18n-config";
import { nextCachedRuntimeReleaseReader } from "../compliance/runtime-release/next-cached-reader";
import { NIS2_CHECK_CODE } from "../compliance/runtime-release";

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
  const resolved = await nextCachedRuntimeReleaseReader.getActive({
    checkCode: NIS2_CHECK_CODE,
    locale,
  });
  if (!resolved) return null;
  const release = resolved.published;
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
