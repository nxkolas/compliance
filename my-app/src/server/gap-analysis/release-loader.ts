import { db } from "@/src/db";
import {
  activeGapAnalysisReleases,
  contentTranslations,
  gapAnalysisReleaseApplicabilityRules,
  gapAnalysisReleases,
  gapRequirementSetMembers,
  gapRequirementVersions,
  questionOptions,
  questionnaireVersions,
  questionnaires,
  questions,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { asc, eq, inArray } from "drizzle-orm";

type Localized = { de: string; en: string };

export type LoadedGapRelease = {
  id: string;
  releaseCode: string;
  versionLabel: string;
  moduleId: string;
  questionnaireId: string;
  questionnaireVersionId: string;
  questionnaireTitle: string;
  compatibleCheckReleaseId: string;
  prompt: {
    name: string;
    version: string;
    templateHash: string;
    responseSchemaVersion: string;
  };
  evaluator: { kind: string; version: number };
  modelPolicy: unknown;
  questions: Array<{
    id: string;
    stableKey: string;
    position: number;
    questionText: string;
    helpText: string | null;
    answerType: string;
    required: boolean;
    options: Array<{
      id: string;
      stableValue: string;
      label: string;
      position: number;
    }>;
  }>;
  requirements: Array<{
    id: string;
    stableRequirementId: string;
    code: string;
    position: number;
    criticality: "low" | "medium" | "high" | "critical";
    title: string;
    requirementText: string;
    recommendation: string;
    legalReferences: unknown;
    applicabilityOutcomeCodes: string[];
    questionStableKeys: string[];
  }>;
};

export async function getActiveGapAnalysisRelease(
  releaseCode: string,
  locale: Locale,
) {
  const active = await db.query.activeGapAnalysisReleases.findFirst({
    where: eq(activeGapAnalysisReleases.releaseCode, releaseCode),
  });
  if (!active) return null;
  return loadGapAnalysisRelease(active.gapAnalysisReleaseId, locale);
}

export async function loadGapAnalysisRelease(
  releaseId: string,
  locale: Locale,
): Promise<LoadedGapRelease | null> {
  const release = await db.query.gapAnalysisReleases.findFirst({
    where: eq(gapAnalysisReleases.id, releaseId),
  });
  if (!release || release.status !== "published") return null;
  const questionnaireVersion = await db.query.questionnaireVersions.findFirst({
    where: eq(questionnaireVersions.id, release.questionnaireVersionId),
  });
  if (!questionnaireVersion) return null;
  const questionnaire = await db.query.questionnaires.findFirst({
    where: eq(questionnaires.id, questionnaireVersion.questionnaireId),
  });
  if (!questionnaire) return null;

  const questionRows = await db.query.questions.findMany({
    where: eq(questions.questionnaireVersionId, questionnaireVersion.id),
    orderBy: [asc(questions.position)],
  });
  const optionRows = questionRows.length
    ? await db.query.questionOptions.findMany({
        where: inArray(
          questionOptions.questionId,
          questionRows.map((question) => question.id),
        ),
        orderBy: [asc(questionOptions.position)],
      })
    : [];
  const contentRevisionIds = [
    ...questionRows.flatMap((question) => [
      question.questionContentRevisionId,
      ...(question.helpContentRevisionId ? [question.helpContentRevisionId] : []),
    ]),
    ...optionRows.map((option) => option.labelContentRevisionId),
  ];
  const translations = contentRevisionIds.length
    ? await db.query.contentTranslations.findMany({
        where: inArray(contentTranslations.contentRevisionId, contentRevisionIds),
      })
    : [];
  const translated = new Map<string, Map<string, string>>();
  for (const row of translations) {
    const values = translated.get(row.contentRevisionId) ?? new Map();
    values.set(row.locale, row.value);
    translated.set(row.contentRevisionId, values);
  }
  const text = (revisionId: string) => {
    const values = translated.get(revisionId);
    return values?.get(locale) ?? values?.get("de") ?? values?.get("en") ?? "";
  };

  const members = await db
    .select({
      position: gapRequirementSetMembers.position,
      requirement: gapRequirementVersions,
    })
    .from(gapRequirementSetMembers)
    .innerJoin(
      gapRequirementVersions,
      eq(
        gapRequirementSetMembers.requirementVersionId,
        gapRequirementVersions.id,
      ),
    )
    .where(
      eq(
        gapRequirementSetMembers.requirementSetVersionId,
        release.requirementSetVersionId,
      ),
    )
    .orderBy(asc(gapRequirementSetMembers.position));
  const rules = await db.query.gapAnalysisReleaseApplicabilityRules.findMany({
    where: eq(
      gapAnalysisReleaseApplicabilityRules.gapAnalysisReleaseId,
      release.id,
    ),
  });
  const ruleByRequirement = new Map(
    rules.map((rule) => [rule.requirementVersionId, parseConditions(rule.conditions)]),
  );

  return {
    id: release.id,
    releaseCode: release.releaseCode,
    versionLabel: release.versionLabel,
    moduleId: release.moduleId,
    questionnaireId: questionnaire.id,
    questionnaireVersionId: questionnaireVersion.id,
    questionnaireTitle: questionnaire.title,
    compatibleCheckReleaseId: release.compatibleCheckReleaseId,
    prompt: {
      name: release.promptName,
      version: release.promptVersion,
      templateHash: release.promptTemplateHash,
      responseSchemaVersion: release.responseSchemaVersion,
    },
    evaluator: { kind: release.evaluatorKind, version: release.evaluatorVersion },
    modelPolicy: release.modelPolicy,
    questions: questionRows.map((question) => ({
      id: question.id,
      stableKey: question.stableKey,
      position: question.position,
      questionText: text(question.questionContentRevisionId),
      helpText: question.helpContentRevisionId
        ? text(question.helpContentRevisionId)
        : null,
      answerType: question.answerType,
      required: question.required,
      options: optionRows
        .filter((option) => option.questionId === question.id)
        .map((option) => ({
          id: option.id,
          stableValue: option.stableValue,
          label: text(option.labelContentRevisionId),
          position: option.position,
        })),
    })),
    requirements: members.map(({ position, requirement }) => {
      const conditions = ruleByRequirement.get(requirement.id) ?? {
        applicabilityOutcomeCodes: [],
        questionStableKeys: [],
      };
      return {
        id: requirement.id,
        stableRequirementId: requirement.requirementId,
        code: requirement.code,
        position,
        criticality: requirement.criticality,
        title: localize(requirement.title, locale),
        requirementText: localize(requirement.requirementText, locale),
        recommendation: localize(requirement.recommendation, locale),
        legalReferences: requirement.legalReferences,
        ...conditions,
      };
    }),
  };
}

function localize(value: unknown, locale: Locale) {
  const candidate = value as Partial<Localized>;
  return candidate[locale] ?? candidate.de ?? candidate.en ?? "";
}

function parseConditions(value: unknown) {
  const candidate = value as {
    applicabilityOutcomeCodes?: unknown;
    questionStableKeys?: unknown;
  };
  return {
    applicabilityOutcomeCodes: Array.isArray(candidate.applicabilityOutcomeCodes)
      ? candidate.applicabilityOutcomeCodes.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    questionStableKeys: Array.isArray(candidate.questionStableKeys)
      ? candidate.questionStableKeys.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  };
}
