import { db } from "@/src/db";
import {
  activeComplianceCheckReleases,
  complianceCheckReleases,
  contentTranslations,
  factOptions,
  legalProvisions,
  questionFactMappings,
  questionOptions,
  questionnaireVersions,
  questionnaires,
  questions,
  ruleSets,
  scopeEntityTypeLegalProvisions,
  scopeEntityTypes,
  scopeEntityTypeVersions,
  scopeSectorVersions,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { and, asc, eq, inArray } from "drizzle-orm";

export const NIS2_CHECK_CODE = "nis2_applicability";

export type LoadedComplianceRelease = {
  checkReleaseId: string;
  releaseVersionLabel: string;
  aggregateHash: string;
  defaultLocale: string;
  moduleId: string;
  questionnaireId: string;
  questionnaireVersionId: string;
  questionnaireTitle: string;
  questionnaireCode: string;
  ruleSet: typeof ruleSets.$inferSelect;
  scopeModelVersionId: string;
  isActive: boolean;
  activeReleaseVersionLabel: string;
  questions: Array<{
    id: string;
    stableKey: string;
    position: number;
    questionText: string;
    helpText: string | null;
    answerType: string;
    required: boolean;
    config: unknown;
    options: Array<{
      id: string;
      stableValue: string;
      catalogCode: string;
      label: string;
      position: number;
      metadata: unknown;
    }>;
    factMappings: Array<{ factKey: string; transform: unknown }>;
  }>;
};

export async function loadActiveComplianceRelease(locale: Locale = "de") {
  const pointer = await db.query.activeComplianceCheckReleases.findFirst({
    where: eq(activeComplianceCheckReleases.checkCode, NIS2_CHECK_CODE),
  });
  if (!pointer) return null;
  return loadComplianceRelease(pointer.checkReleaseId, locale, pointer.checkReleaseId);
}

export async function loadComplianceRelease(
  checkReleaseId: string,
  locale: Locale = "de",
  knownActiveReleaseId?: string,
): Promise<LoadedComplianceRelease | null> {
  const release = await db.query.complianceCheckReleases.findFirst({
    where: eq(complianceCheckReleases.id, checkReleaseId),
  });
  if (!release || !["published", "retired", "superseded"].includes(release.status)) return null;

  const activePointer = knownActiveReleaseId
    ? { checkReleaseId: knownActiveReleaseId }
    : await db.query.activeComplianceCheckReleases.findFirst({
        where: eq(activeComplianceCheckReleases.checkCode, release.checkCode),
      });
  const activeRelease = activePointer
    ? await db.query.complianceCheckReleases.findFirst({ where: eq(complianceCheckReleases.id, activePointer.checkReleaseId) })
    : null;
  const questionnaireVersion = await db.query.questionnaireVersions.findFirst({
    where: eq(questionnaireVersions.id, release.questionnaireVersionId),
  });
  if (!questionnaireVersion) return null;
  const questionnaire = await db.query.questionnaires.findFirst({
    where: eq(questionnaires.id, questionnaireVersion.questionnaireId),
  });
  const ruleSet = await db.query.ruleSets.findFirst({ where: eq(ruleSets.id, release.ruleSetId) });
  if (!questionnaire || !ruleSet) return null;

  const questionRows = await db.query.questions.findMany({
    where: eq(questions.questionnaireVersionId, questionnaireVersion.id),
    orderBy: [asc(questions.position)],
  });
  if (questionRows.length === 0) return null;
  const questionIds = questionRows.map((question) => question.id);
  const [optionRows, mappingRows] = await Promise.all([
    db.query.questionOptions.findMany({ where: inArray(questionOptions.questionId, questionIds), orderBy: [asc(questionOptions.position)] }),
    db.query.questionFactMappings.findMany({ where: inArray(questionFactMappings.questionId, questionIds) }),
  ]);

  const factOptionIds = optionRows.flatMap((option) => option.factOptionId ? [option.factOptionId] : []);
  const factOptionRows = factOptionIds.length > 0
    ? await db.query.factOptions.findMany({ where: inArray(factOptions.id, factOptionIds) })
    : [];
  const entityIds = factOptionRows.flatMap((option) => option.scopeEntityTypeId ? [option.scopeEntityTypeId] : []);
  const entityRows = entityIds.length > 0
    ? await db.select({
        entityId: scopeEntityTypes.id,
        entityCode: scopeEntityTypes.code,
        versionId: scopeEntityTypeVersions.id,
        annex: scopeEntityTypeVersions.annex,
        labelContentRevisionId: scopeEntityTypeVersions.labelContentRevisionId,
        descriptionContentRevisionId: scopeEntityTypeVersions.descriptionContentRevisionId,
        sectorLabelContentRevisionId: scopeSectorVersions.labelContentRevisionId,
      }).from(scopeEntityTypeVersions)
        .innerJoin(scopeEntityTypes, eq(scopeEntityTypeVersions.scopeEntityTypeId, scopeEntityTypes.id))
        .innerJoin(scopeSectorVersions, eq(scopeEntityTypeVersions.scopeSectorVersionId, scopeSectorVersions.id))
        .where(and(eq(scopeEntityTypeVersions.scopeModelVersionId, release.scopeModelVersionId), inArray(scopeEntityTypes.id, entityIds)))
    : [];

  const entityVersionIds = entityRows.map((entity) => entity.versionId);
  const provisionRows = entityVersionIds.length > 0
    ? await db.select({ entityVersionId: scopeEntityTypeLegalProvisions.scopeEntityTypeVersionId, citationContentRevisionId: legalProvisions.citationContentRevisionId })
        .from(scopeEntityTypeLegalProvisions)
        .innerJoin(legalProvisions, eq(scopeEntityTypeLegalProvisions.legalProvisionId, legalProvisions.id))
        .where(inArray(scopeEntityTypeLegalProvisions.scopeEntityTypeVersionId, entityVersionIds))
    : [];

  const contentRevisionIds = [...new Set([
    ...questionRows.flatMap((question) => [question.questionContentRevisionId, question.helpContentRevisionId].filter((id): id is string => Boolean(id))),
    ...optionRows.map((option) => option.labelContentRevisionId),
    ...entityRows.flatMap((entity) => [entity.labelContentRevisionId, entity.descriptionContentRevisionId, entity.sectorLabelContentRevisionId]),
    ...provisionRows.flatMap((provision) => provision.citationContentRevisionId ? [provision.citationContentRevisionId] : []),
  ])];
  const translationRows = await db.query.contentTranslations.findMany({
    where: inArray(contentTranslations.contentRevisionId, contentRevisionIds),
  });
  const translations = new Map(translationRows.map((row) => [`${row.contentRevisionId}:${row.locale}`, row.value]));
  const resolveContent = (revisionId: string | null) => {
    if (!revisionId) return null;
    const translated = translations.get(`${revisionId}:${locale}`);
    const fallback = translations.get(`${revisionId}:${release.defaultLocale}`);
    if (!translated && !fallback) throw new Error(`Published release content ${revisionId} has no runtime translation`);
    return translated ?? fallback ?? null;
  };

  const factOptionById = new Map(factOptionRows.map((option) => [option.id, option]));
  const entityById = new Map(entityRows.map((entity) => [entity.entityId, entity]));
  return {
    checkReleaseId: release.id,
    releaseVersionLabel: release.versionLabel,
    aggregateHash: release.aggregateHash,
    defaultLocale: release.defaultLocale,
    moduleId: release.moduleId,
    questionnaireId: questionnaire.id,
    questionnaireVersionId: questionnaireVersion.id,
    questionnaireTitle: questionnaire.title,
    questionnaireCode: questionnaire.code,
    ruleSet,
    scopeModelVersionId: release.scopeModelVersionId,
    isActive: activePointer?.checkReleaseId === release.id,
    activeReleaseVersionLabel: activeRelease?.versionLabel ?? release.versionLabel,
    questions: questionRows.map((question) => ({
      id: question.id,
      stableKey: question.stableKey,
      position: question.position,
      questionText: resolveContent(question.questionContentRevisionId) ?? "",
      helpText: resolveContent(question.helpContentRevisionId),
      answerType: question.answerType,
      required: question.required,
      config: question.config,
      options: optionRows.filter((option) => option.questionId === question.id).map((option) => {
        const factOption = option.factOptionId ? factOptionById.get(option.factOptionId) : undefined;
        const entity = factOption?.scopeEntityTypeId ? entityById.get(factOption.scopeEntityTypeId) : undefined;
        const legalReferences = entity
          ? provisionRows.filter((row) => row.entityVersionId === entity.versionId).flatMap((row) => {
              const value = resolveContent(row.citationContentRevisionId);
              return value ? [value] : [];
            })
          : [];
        return {
          id: option.id,
          stableValue: option.stableValue,
          catalogCode: factOption?.catalogCode ?? "all",
          label: resolveContent(option.labelContentRevisionId) ?? "",
          position: option.position,
          metadata: entity
            ? { ...asRecord(option.metadata), sectorLabel: resolveContent(entity.sectorLabelContentRevisionId), description: resolveContent(entity.descriptionContentRevisionId), annex: entity.annex, legalReferences }
            : option.metadata,
        };
      }),
      factMappings: mappingRows.filter((mapping) => mapping.questionId === question.id).map((mapping) => ({ factKey: mapping.factKey, transform: mapping.transform })),
    })),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
