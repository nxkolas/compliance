import { db } from "@/src/db";
import {
  complianceFrameworkVersions,
  complianceFrameworks,
  complianceModules,
  questionOptionTranslations,
  questionOptions,
  questionTranslations,
  questionnaireVersions,
  questionnaires,
  questions,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { and, asc, eq } from "drizzle-orm";

export const ACTIVE_FRAMEWORK_CODE = "nis2";
export const ACTIVE_FRAMEWORK_VERSION_LABEL = "2026-v1";
export const ACTIVE_MODULE_CODE = "betroffenheitscheck";
export const ACTIVE_QUESTIONNAIRE_CODE = "betroffenheitscheck";

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
  const rows = await db
    .select({
      questionnaireId: questionnaires.id,
      questionnaireCode: questionnaires.code,
      questionnaireTitle: questionnaires.title,
      versionLabel: questionnaireVersions.versionLabel,
      questionId: questions.id,
      questionStableKey: questions.stableKey,
      questionPosition: questions.position,
      questionText: questions.questionText,
      questionHelpText: questions.helpText,
      translatedQuestionText: questionTranslations.questionText,
      translatedQuestionHelpText: questionTranslations.helpText,
      questionAnswerType: questions.answerType,
      questionRequired: questions.required,
      questionConfig: questions.config,
      optionId: questionOptions.id,
      optionStableValue: questionOptions.stableValue,
      optionLabel: questionOptions.label,
      translatedOptionLabel: questionOptionTranslations.label,
      optionPosition: questionOptions.position,
      optionMetadata: questionOptions.metadata,
    })
    .from(questionnaires)
    .innerJoin(
      complianceModules,
      eq(questionnaires.moduleId, complianceModules.id),
    )
    .innerJoin(
      complianceFrameworkVersions,
      eq(complianceModules.frameworkVersionId, complianceFrameworkVersions.id),
    )
    .innerJoin(
      complianceFrameworks,
      eq(complianceFrameworkVersions.frameworkId, complianceFrameworks.id),
    )
    .innerJoin(
      questionnaireVersions,
      eq(questionnaireVersions.questionnaireId, questionnaires.id),
    )
    .innerJoin(
      questions,
      eq(questions.questionnaireVersionId, questionnaireVersions.id),
    )
    .leftJoin(
      questionTranslations,
      and(
        eq(questionTranslations.questionId, questions.id),
        eq(questionTranslations.locale, locale),
      ),
    )
    .leftJoin(questionOptions, eq(questionOptions.questionId, questions.id))
    .leftJoin(
      questionOptionTranslations,
      and(
        eq(questionOptionTranslations.questionOptionId, questionOptions.id),
        eq(questionOptionTranslations.locale, locale),
      ),
    )
    .where(
      and(
        eq(complianceFrameworks.code, ACTIVE_FRAMEWORK_CODE),
        eq(
          complianceFrameworkVersions.versionLabel,
          ACTIVE_FRAMEWORK_VERSION_LABEL,
        ),
        eq(complianceFrameworkVersions.status, "published"),
        eq(complianceModules.code, ACTIVE_MODULE_CODE),
        eq(questionnaires.code, ACTIVE_QUESTIONNAIRE_CODE),
        eq(questionnaireVersions.versionLabel, ACTIVE_FRAMEWORK_VERSION_LABEL),
        eq(questionnaireVersions.status, "published"),
      ),
    )
    .orderBy(asc(questions.position), asc(questionOptions.position));

  if (rows.length === 0) {
    return null;
  }

  const firstRow = rows[0];
  const questionMap = new Map<string, QuestionnairePreviewQuestionDto>();

  for (const row of rows) {
    let question = questionMap.get(row.questionId);

    if (!question) {
      question = {
        id: row.questionId,
        stableKey: row.questionStableKey,
        position: row.questionPosition,
        questionText: row.translatedQuestionText ?? row.questionText,
        helpText: row.translatedQuestionHelpText ?? row.questionHelpText,
        answerType: row.questionAnswerType,
        required: row.questionRequired,
        config: row.questionConfig,
        options: [],
      };
      questionMap.set(row.questionId, question);
    }

    if (row.optionId) {
      question.options.push({
        id: row.optionId,
        stableValue: row.optionStableValue ?? "",
        label: row.translatedOptionLabel ?? row.optionLabel ?? "",
        position: row.optionPosition ?? 0,
        metadata: row.optionMetadata,
      });
    }
  }

  return {
    id: firstRow.questionnaireId,
    title: firstRow.questionnaireTitle,
    code: firstRow.questionnaireCode,
    versionLabel: firstRow.versionLabel,
    questions: Array.from(questionMap.values()),
  };
}
