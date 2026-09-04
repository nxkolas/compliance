import type { Locale } from "@/src/i18n/config";
import { db } from "@/src/db";
import { analysisOutputRevisions, assessmentAnswers, assessmentRevisions } from "@/src/db/schema";
import {
  currentApplicabilityDefinitionHash,
  getCurrentApplicabilityDefinition,
  SUPPORTED_JURISDICTION_CODES,
} from "./release/current";
import { and, asc, eq } from "drizzle-orm";
import { ApiError } from "../../platform/http/errors";
import { assertCanAccessOrganization } from "../organizations";
import { type ApplicabilityAnswerValue } from "../compliance/runtime-release/question-visibility";
import { parseStoredRuleEvaluationResult } from "../compliance/nis2/rule-evaluation-schema";
import type { ApplicabilityRecalculationLock } from "./recalculation-lock";
import type { ApplicabilityAnswersDto, ApplicabilityOverviewDto, ApplicabilityQuestionDto, ApplicabilityQuestionnaireDto, ApplicabilityResultDto, Definition, StoredResultSnapshot } from "./model";
import { APPLICABILITY_KIND } from "./submissions";

export async function getApplicabilityQuestionnaireForUser(
  userId: string,
  organizationId: string,
  locale: Locale,
): Promise<ApplicabilityQuestionnaireDto> {
  await assertCanAccessOrganization(userId, organizationId);
  const [latestAnswers, organization] = await Promise.all([
    getLatestAnswerMap(organizationId),
    db.query.organizations.findFirst({
      columns: { countryCode: true },
      where: { RAW: (table, operators) => eq(table.id, organizationId) ?? operators.sql`true` },
    }),
  ]);
  return toQuestionnaire(locale, latestAnswers, organization?.countryCode ?? null);
}

export async function getApplicabilityRecalculationLockForUser(
  userId: string,
  organizationId: string,
): Promise<ApplicabilityRecalculationLock> {
  await assertCanAccessOrganization(userId, organizationId);
  return { locked: false, gapAssessmentId: null };
}

export async function getApplicabilityOverviewForUser(
  userId: string,
  organizationId: string,
): Promise<ApplicabilityOverviewDto | null> {
  await assertCanAccessOrganization(userId, organizationId);
  const current = await getCurrentAssessmentRevision(organizationId);
  if (!current) return null;
  return {
    assessmentId: current.assessmentId,
    assessmentRevisionId: current.id,
    assessmentRevisionNumber: await revisionNumber(
      assessmentRevisions,
      assessmentRevisions.assessmentId,
      current.assessmentId,
      current.id,
    ),
    submittedAt: current.submittedAt.toISOString(),
    result: await getCurrentResult(organizationId),
  };
}

export async function getApplicabilityAnswersForUser(
  userId: string,
  organizationId: string,
): Promise<ApplicabilityAnswersDto | null> {
  await assertCanAccessOrganization(userId, organizationId);
  const current = await getCurrentAssessmentRevision(organizationId);
  if (!current) return null;
  const rows = await db
    .select()
    .from(assessmentAnswers)
    .where(eq(assessmentAnswers.assessmentRevisionId, current.id))
    .orderBy(asc(assessmentAnswers.position));
  return {
    assessmentId: current.assessmentId,
    assessmentRevisionId: current.id,
    assessmentRevisionNumber: await revisionNumber(
      assessmentRevisions,
      assessmentRevisions.assessmentId,
      current.assessmentId,
      current.id,
    ),
    submittedAt: current.submittedAt.toISOString(),
    answers: rows.map((row) => ({
      questionId: row.questionKey,
      questionStableKey: row.questionKey,
      questionText: row.questionText,
      questionConfig: null,
      questionPosition: row.position,
      answerValue: row.answerValue,
      answerLabel: row.selectedOptionLabels.join(", ") || null,
      answerMetadata: null,
    })),
  };
}

export async function getApplicabilityResultForUser(
  userId: string,
  organizationId: string,
): Promise<ApplicabilityResultDto | null> {
  await assertCanAccessOrganization(userId, organizationId);
  return getCurrentResult(organizationId);
}

export async function getApplicabilityResultRevisionForUser(
  userId: string,
  organizationId: string,
  revisionId: string,
): Promise<ApplicabilityResultDto | null> {
  await assertCanAccessOrganization(userId, organizationId);
  const row = await db.query.analysisOutputRevisions.findFirst({
    where: {
      RAW: (table, operators) =>
        and(eq(table.id, revisionId), eq(table.organizationId, organizationId)) ??
        operators.sql`true`,
    },
  });
  return row ? toResultDto(row) : null;
}

export function getOrganizationCountryDefault(input: {
  questions: ApplicabilityQuestionDto[];
  latestAnswers: Record<string, ApplicabilityAnswerValue>;
  organizationCountry: string | null;
}): Record<string, ApplicabilityAnswerValue> {
  const question = input.questions.find(
    (candidate) => candidate.stableKey === "bc.jurisdiction_country",
  );
  if (!question || input.latestAnswers[question.id]) return {};
  const countryCode = input.organizationCountry?.trim().toUpperCase();
  if (!countryCode || countryCode.length !== 2) return {};
  return question.options.some(
    (option) => option.stableValue.toUpperCase() === countryCode,
  )
    ? { [question.id]: countryCode }
    : {};
}

export function toQuestionnaire(
  locale: Locale,
  latestAnswers: Record<string, ApplicabilityAnswerValue>,
  organizationCountry: string | null,
): ApplicabilityQuestionnaireDto {
  const definition = getCurrentApplicabilityDefinition(locale);
  const questions = definition.questions.map(({ factMappings, ...question }) => {
    void factMappings;
    return question;
  });
  return {
    id: definition.questionnaireId,
    locale,
    title: definition.questionnaireTitle,
    code: definition.questionnaireCode,
    versionLabel: definition.releaseVersionLabel,
    questions,
    entityCatalogs: getEntityCatalogs(definition.questions),
    contentByStableKey: definition.contentByStableKey,
    defaultAnswers: getOrganizationCountryDefault({
      questions,
      latestAnswers,
      organizationCountry,
    }),
    latestAnswers,
    definition: {
      hash: currentApplicabilityDefinitionHash,
      versionLabel: definition.releaseVersionLabel,
      supportedJurisdictionCodes: [...SUPPORTED_JURISDICTION_CODES],
    },
  };
}

export async function getCurrentAssessmentRevision(organizationId: string) {
  const assessment = await db.query.assessments.findFirst({
    where: {
      RAW: (table, operators) =>
        and(eq(table.organizationId, organizationId), eq(table.kind, APPLICABILITY_KIND)) ??
        operators.sql`true`,
    },
  });
  if (!assessment?.currentRevisionId) return null;
  return db.query.assessmentRevisions.findFirst({
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.id, assessment.currentRevisionId!),
          eq(table.organizationId, organizationId),
        ) ?? operators.sql`true`,
    },
  });
}

export async function getLatestAnswerMap(organizationId: string) {
  const revision = await getCurrentAssessmentRevision(organizationId);
  if (!revision) return {};
  const rows = await db
    .select({ questionKey: assessmentAnswers.questionKey, value: assessmentAnswers.answerValue })
    .from(assessmentAnswers)
    .where(eq(assessmentAnswers.assessmentRevisionId, revision.id));
  return Object.fromEntries(
    rows.filter((row): row is typeof row & { value: ApplicabilityAnswerValue } =>
      isApplicabilityAnswerValue(row.value),
    ).map((row) => [row.questionKey, row.value]),
  );
}

export async function getCurrentResult(organizationId: string) {
  const output = await db.query.analysisOutputs.findFirst({
    where: {
      RAW: (table, operators) =>
        and(eq(table.organizationId, organizationId), eq(table.kind, APPLICABILITY_KIND)) ??
        operators.sql`true`,
    },
  });
  if (!output?.currentRevisionId) return null;
  const revision = await db.query.analysisOutputRevisions.findFirst({
    where: {
      RAW: (table, operators) =>
        and(eq(table.id, output.currentRevisionId!), eq(table.organizationId, organizationId)) ??
        operators.sql`true`,
    },
  });
  return revision ? toResultDto(revision) : null;
}

export async function toResultDto(
  row: typeof analysisOutputRevisions.$inferSelect,
  knownRevisionNumber?: number,
): Promise<ApplicabilityResultDto> {
  const snapshot = parseResultSnapshot(row.result);
  return {
    outputRevisionId: row.id,
    outputRevisionNumber:
      knownRevisionNumber ??
      (await revisionNumber(
        analysisOutputRevisions,
        analysisOutputRevisions.outputId,
        row.outputId,
        row.id,
      )),
    createdAt: row.createdAt.toISOString(),
    assessmentRevisionId: row.assessmentRevisionId,
    evidence: snapshot.evidence,
    result: snapshot.result,
    definition: {
      hash: row.definitionHash,
      versionLabel: snapshot.versionLabel,
      isOutdated: row.definitionHash !== currentApplicabilityDefinitionHash,
      supportedJurisdictionCodes: [...SUPPORTED_JURISDICTION_CODES],
    },
  };
}

export function parseResultSnapshot(value: unknown): StoredResultSnapshot {
  if (!value || typeof value !== "object") throw new ApiError(409, "Stored result is invalid");
  const candidate = value as Partial<StoredResultSnapshot>;
  if (!candidate.result || typeof candidate.versionLabel !== "string") {
    throw new ApiError(409, "Stored result is invalid");
  }
  return {
    evidence: parseStoredRuleEvaluationResult(candidate.evidence),
    result: candidate.result,
    versionLabel: candidate.versionLabel,
  };
}

export async function revisionNumber(
  table: typeof assessmentRevisions | typeof analysisOutputRevisions,
  parentColumn: typeof assessmentRevisions.assessmentId | typeof analysisOutputRevisions.outputId,
  parentId: string,
  revisionId: string,
) {
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(eq(parentColumn, parentId))
    .orderBy(
      asc(
        table === assessmentRevisions
          ? assessmentRevisions.submittedAt
          : analysisOutputRevisions.createdAt,
      ),
    );
  const index = rows.findIndex((row) => row.id === revisionId);
  return index < 0 ? 1 : index + 1;
}

export function isApplicabilityAnswerValue(value: unknown): value is ApplicabilityAnswerValue {
  return (
    (typeof value === "string" && value.length > 0) ||
    (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.length > 0))
  );
}

export function getEntityCatalogs(questions: Definition["questions"]) {
  const entityQuestion = questions.find((question) =>
    question.factMappings.some((mapping) => mapping.factKey === "nis2_entity_types"),
  );
  if (!entityQuestion) return {};
  const codes = new Set(
    entityQuestion.options
      .map((option) => option.catalogCode)
      .filter((code) => code !== "all"),
  );
  return Object.fromEntries(
    [...codes].map((code) => [
      code,
      entityQuestion.options.filter((option) => option.catalogCode === "all" || option.catalogCode === code),
    ]),
  );
}
