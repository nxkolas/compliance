import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Locale } from "@/lib/i18n-config";
import { db } from "@/src/db";
import {
  analysisOutputRevisions,
  analysisOutputs,
  assessmentAnswers,
  assessmentRevisions,
  assessments,
  auditEvents,
  guestApplicabilityChecks,
  organizations,
} from "@/src/db/schema";
import {
  currentApplicabilityDefinitionHash,
  getCurrentApplicabilityDefinition,
  SUPPORTED_JURISDICTION_CODES,
} from "@/src/server/definitions";
import { and, asc, eq, gt } from "drizzle-orm";
import { ApiError } from "../api/errors";
import {
  requireOrganizationCapability,
} from "../auth/capability-service";
import { assertCanAccessOrganization } from "../organizations/service";
import { catalogOptionsForCountry } from "./entity-catalog";
import { guestSubmittedExpiry } from "./guest-lifecycle";
import {
  localizeEvaluation,
  type LocalizedRuleEvaluationResult,
} from "./localize-evaluation";
import {
  getVisibleQuestions,
  isAnswered,
  type ApplicabilityAnswerValue,
} from "./question-visibility";
import {
  parseStoredRuleEvaluationResult,
  type StoredRuleEvaluationResult,
} from "./rule-evaluation-schema";
import { evaluateRuleSet } from "./rules";
import {
  submitApplicabilityCheckSchema,
  type SubmitApplicabilityCheckInput,
} from "./validation";
import type { ApplicabilityRecalculationLock } from "./recalculation-lock";

const BUILD_HASH = process.env.APP_BUILD_SHA ?? currentApplicabilityDefinitionHash;
const APPLICABILITY_KIND = "applicability" as const;

type Definition = ReturnType<typeof getCurrentApplicabilityDefinition>;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

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

type ValidatedAnswer = {
  questionId: string;
  questionStableKey: string;
  questionText: string;
  questionPosition: number;
  answerValue: ApplicabilityAnswerValue;
  selectedOptionLabels: string[];
};

type PreparedSubmission = {
  definition: Definition;
  locale: Locale;
  answers: ValidatedAnswer[];
  evidence: StoredRuleEvaluationResult;
  result: LocalizedRuleEvaluationResult;
  inputHash: string;
  now: Date;
};

type StoredResultSnapshot = {
  evidence: StoredRuleEvaluationResult;
  result: LocalizedRuleEvaluationResult;
  versionLabel: string;
};

export type { LocalizedRuleEvaluationResult } from "./localize-evaluation";

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

export async function getApplicabilityQuestionnaireForGuest(
  locale: Locale,
): Promise<ApplicabilityQuestionnaireDto> {
  const questionnaire = toQuestionnaire(locale, {}, null);
  questionnaire.guestSession = {
    id: randomUUID(),
    token: randomBytes(32).toString("base64url"),
  };
  return questionnaire;
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
  _locale: Locale,
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

export async function submitApplicabilityCheckForUser(
  userId: string,
  organizationId: string,
  input: SubmitApplicabilityCheckInput,
): Promise<ApplicabilityResultDto> {
  await requireOrganizationCapability(userId, organizationId, "applicability:submit");
  const prepared = prepareSubmission(input);
  return db.transaction((tx) => persistSubmission(tx, userId, organizationId, prepared));
}

export async function submitApplicabilityCheckForGuest(
  input: SubmitApplicabilityCheckInput,
): Promise<{ id: string; token: string; result: ApplicabilityResultDto }> {
  const prepared = prepareSubmission(input);
  const id = input.guestSession?.id ?? randomUUID();
  const token = input.guestSession?.token ?? randomBytes(32).toString("base64url");
  const expiresAt = guestSubmittedExpiry(prepared.now);
  const result = guestResultDto(id, prepared);
  try {
    await db.insert(guestApplicabilityChecks).values({
      id,
      claimTokenHash: hashGuestToken(token),
      definitionHash: currentApplicabilityDefinitionHash,
      buildHash: BUILD_HASH,
      locale: prepared.locale,
      answerSnapshot: input.answers,
      resultSnapshot: {
        evidence: prepared.evidence,
        result: prepared.result,
        versionLabel: prepared.definition.releaseVersionLabel,
      } satisfies StoredResultSnapshot,
      submittedAt: prepared.now,
      expiresAt,
    });
  } catch {
    throw new ApiError(409, "This guest applicability check was already submitted");
  }
  return { id, token, result };
}

export async function getGuestApplicabilityCheck(
  token: string | undefined,
  checkId?: string,
): Promise<GuestApplicabilityCheckDto | null> {
  const row = await findGuestCheck(token, checkId);
  if (!row) return null;
  return {
    id: row.id,
    submittedAt: row.submittedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    result: guestStoredResultDto(row),
  };
}

export async function deleteGuestApplicabilityCheck(
  token: string | undefined,
  checkId?: string,
): Promise<void> {
  if (!token) return;
  await db
    .delete(guestApplicabilityChecks)
    .where(
      checkId
        ? and(
            eq(guestApplicabilityChecks.id, checkId),
            eq(guestApplicabilityChecks.claimTokenHash, hashGuestToken(token)),
          )
        : eq(guestApplicabilityChecks.claimTokenHash, hashGuestToken(token)),
    );
}

export async function claimGuestApplicabilityCheckForUser(
  userId: string,
  token: string | undefined,
  checkId: string | undefined,
  input: ClaimGuestApplicabilityCheckInput,
): Promise<ApplicabilityResultDto> {
  await requireOrganizationCapability(
    userId,
    input.organizationId,
    "applicability:submit",
  );
  const row = await findGuestCheck(token, checkId ?? input.checkId);
  if (!row || !token) {
    throw new ApiError(404, "Guest applicability check not found");
  }
  if (row.definitionHash !== currentApplicabilityDefinitionHash) {
    throw new ApiError(409, "The guest check uses an obsolete definition and cannot be claimed");
  }
  const answers = submitApplicabilityCheckSchema.shape.answers.safeParse(row.answerSnapshot);
  if (!answers.success) throw new ApiError(409, "Stored guest answers are invalid");
  const prepared = prepareSubmission({ answers: answers.data, locale: row.locale as Locale });
  return db.transaction(async (tx) => {
    const [claimed] = await tx
      .delete(guestApplicabilityChecks)
      .where(
        and(
          eq(guestApplicabilityChecks.id, row.id),
          eq(guestApplicabilityChecks.claimTokenHash, hashGuestToken(token)),
          gt(guestApplicabilityChecks.expiresAt, new Date()),
        ),
      )
      .returning({ id: guestApplicabilityChecks.id });
    if (!claimed) throw new ApiError(404, "Guest applicability check not found");
    return persistSubmission(tx, userId, input.organizationId, prepared);
  });
}

export function hashGuestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
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

function toQuestionnaire(
  locale: Locale,
  latestAnswers: Record<string, ApplicabilityAnswerValue>,
  organizationCountry: string | null,
): ApplicabilityQuestionnaireDto {
  const definition = getCurrentApplicabilityDefinition(locale);
  const questions = definition.questions.map(({ factMappings: _, ...question }) => question);
  return {
    id: definition.questionnaireId,
    locale,
    title: definition.questionnaireTitle,
    code: definition.questionnaireCode,
    versionLabel: definition.releaseVersionLabel,
    questions,
    entityCatalogs: getEntityCatalogs(definition.questions),
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

function prepareSubmission(input: SubmitApplicabilityCheckInput): PreparedSubmission {
  const locale = input.locale as Locale;
  const definition = getCurrentApplicabilityDefinition(locale);
  const definitionEn = getCurrentApplicabilityDefinition("en");
  const answers = validateAnswers(definition, input);
  const facts = deriveFacts(definition, answers);
  const answerContext = Object.fromEntries(
    answers.map((answer) => [answer.questionStableKey, answer.answerValue]),
  );
  const now = new Date();
  const inputHash = hashRuleInput({
    answers: answerContext,
    facts,
    definitionHash: currentApplicabilityDefinitionHash,
  });
  const evaluation = evaluateRuleSet(definition.ruleSet.rules, {
    facts,
    answers: answerContext,
  });
  const evidence = parseStoredRuleEvaluationResult({
    ...evaluation,
    checkReleaseId: currentApplicabilityDefinitionHash,
    ruleSetId: currentApplicabilityDefinitionHash,
    inputHash,
    evaluatedAt: now.toISOString(),
  });
  return {
    definition,
    locale,
    answers,
    evidence,
    result: localizeEvaluation(evidence, definition, definitionEn),
    inputHash,
    now,
  };
}

function validateAnswers(
  definition: Definition,
  input: SubmitApplicabilityCheckInput,
): ValidatedAnswer[] {
  const questionById = new Map(definition.questions.map((question) => [question.id, question]));
  const values = new Map<string, ApplicabilityAnswerValue>();
  for (const answer of input.answers) {
    if (!questionById.has(answer.questionId)) throw new ApiError(400, "Unknown questionId");
    if (values.has(answer.questionId)) throw new ApiError(400, "Each question can only be answered once");
    values.set(answer.questionId, answer.value);
  }
  const record = Object.fromEntries(values);
  const countryQuestion = definition.questions.find((question) =>
    question.factMappings.some((mapping) => mapping.factKey === "jurisdiction_country"),
  );
  const countryValue = countryQuestion ? values.get(countryQuestion.id) : undefined;
  const countryCode = typeof countryValue === "string" ? countryValue : null;
  const visible = getVisibleQuestions(definition.questions, record);
  for (const question of visible) {
    if (question.required && !isAnswered(values.get(question.id))) {
      throw new ApiError(400, "All required questions must be answered");
    }
  }
  return visible.flatMap((question): ValidatedAnswer[] => {
    const value = values.get(question.id);
    if (!isAnswered(value)) return [];
    const allowed = catalogOptionsForCountry(question.options, countryCode);
    const selectedValues = Array.isArray(value) ? [...new Set(value)] : [value];
    if (Array.isArray(value) !== (question.answerType === "multi_choice")) {
      throw new ApiError(400, "Answer value has the wrong shape");
    }
    if (selectedValues.length !== (Array.isArray(value) ? value.length : 1)) {
      throw new ApiError(400, "Multi-choice answers cannot contain duplicates");
    }
    if (
      selectedValues.length > 1 &&
      selectedValues.some((item) => item === "none_of_these" || item === "unsure")
    ) {
      throw new ApiError(400, "Exclusive answers cannot be combined");
    }
    const options = selectedValues.map((selected) => {
      const option = allowed.find((candidate) => candidate.stableValue === selected);
      if (!option) throw new ApiError(400, "Invalid answer value");
      return option;
    });
    return [{
      questionId: question.id,
      questionStableKey: question.stableKey,
      questionText: question.questionText,
      questionPosition: question.position,
      answerValue: value,
      selectedOptionLabels: options.map((option) => option.label),
    }];
  });
}

function deriveFacts(definition: Definition, answers: ValidatedAnswer[]) {
  const byId = new Map(answers.map((answer) => [answer.questionId, answer.answerValue]));
  const facts: Record<string, unknown> = {};
  for (const question of definition.questions) {
    const value = byId.get(question.id);
    if (value === undefined) continue;
    for (const mapping of question.factMappings) facts[mapping.factKey] = value;
  }
  return facts;
}

async function persistSubmission(
  tx: Transaction,
  userId: string,
  organizationId: string,
  prepared: PreparedSubmission,
): Promise<ApplicabilityResultDto> {
  await tx
    .insert(assessments)
    .values({ organizationId, kind: APPLICABILITY_KIND })
    .onConflictDoNothing({ target: [assessments.organizationId, assessments.kind] });
  const assessment = await tx.query.assessments.findFirst({
    where: {
      RAW: (table, operators) =>
        and(eq(table.organizationId, organizationId), eq(table.kind, APPLICABILITY_KIND)) ??
        operators.sql`true`,
    },
  });
  if (!assessment) throw new Error("Applicability assessment was not created");
  const [revision] = await tx
    .insert(assessmentRevisions)
    .values({
      organizationId,
      assessmentId: assessment.id,
      previousRevisionId: assessment.currentRevisionId,
      definitionHash: currentApplicabilityDefinitionHash,
      buildHash: BUILD_HASH,
      locale: prepared.locale,
      deterministicEvaluations: { applicability: prepared.evidence },
      inputHash: prepared.inputHash,
      submittedBy: userId,
      submittedAt: prepared.now,
    })
    .returning();
  if (!revision) throw new Error("Applicability revision was not created");
  await tx.insert(assessmentAnswers).values(
    prepared.answers.map((answer) => ({
      organizationId,
      assessmentRevisionId: revision.id,
      questionKey: answer.questionStableKey,
      questionText: answer.questionText,
      answerValue: answer.answerValue,
      selectedOptionLabels: answer.selectedOptionLabels,
      position: answer.questionPosition,
    })),
  );
  await tx
    .update(assessments)
    .set({ currentRevisionId: revision.id, updatedAt: prepared.now })
    .where(eq(assessments.id, assessment.id));

  await tx
    .insert(analysisOutputs)
    .values({ organizationId, kind: APPLICABILITY_KIND })
    .onConflictDoNothing({ target: [analysisOutputs.organizationId, analysisOutputs.kind] });
  const output = await tx.query.analysisOutputs.findFirst({
    where: {
      RAW: (table, operators) =>
        and(eq(table.organizationId, organizationId), eq(table.kind, APPLICABILITY_KIND)) ??
        operators.sql`true`,
    },
  });
  if (!output) throw new Error("Applicability output was not created");
  const snapshot: StoredResultSnapshot = {
    evidence: prepared.evidence,
    result: prepared.result,
    versionLabel: prepared.definition.releaseVersionLabel,
  };
  const [outputRevision] = await tx
    .insert(analysisOutputRevisions)
    .values({
      organizationId,
      outputId: output.id,
      previousRevisionId: output.currentRevisionId,
      assessmentRevisionId: revision.id,
      sourceApplicabilityRevisionId: revision.id,
      definitionHash: currentApplicabilityDefinitionHash,
      buildHash: BUILD_HASH,
      locale: prepared.locale,
      inputHash: prepared.inputHash,
      result: snapshot,
      jurisdictionCode: prepared.evidence.jurisdiction.countryCode,
      outcomeCode: prepared.evidence.outcome,
      gapEligible: isGapEligible(prepared.evidence),
      createdBy: userId,
      createdAt: prepared.now,
    })
    .returning();
  if (!outputRevision) throw new Error("Applicability output revision was not created");
  await tx
    .update(analysisOutputs)
    .set({ currentRevisionId: outputRevision.id, updatedAt: prepared.now })
    .where(eq(analysisOutputs.id, output.id));
  await tx.insert(auditEvents).values({
    organizationId,
    actorUserId: userId,
    eventType: "applicability.submitted",
    entityType: "analysis_output_revision",
    entityId: outputRevision.id,
    metadata: {
      assessmentRevisionId: revision.id,
      definitionHash: currentApplicabilityDefinitionHash,
      outcome: prepared.evidence.outcome,
    },
  });
  return toResultDto(outputRevision, 1 + (output.currentRevisionId ? await countPriorOutputRevisions(tx, output.id) : 0));
}

function isGapEligible(evidence: StoredRuleEvaluationResult) {
  return (
    evidence.jurisdiction.countryCode === "DE" &&
    (evidence.outcome === "essential_entity" || evidence.outcome === "important_entity")
  );
}

async function getCurrentAssessmentRevision(organizationId: string) {
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

async function getLatestAnswerMap(organizationId: string) {
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

async function getCurrentResult(organizationId: string) {
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

async function findGuestCheck(token: string | undefined, checkId?: string) {
  if (!token) return null;
  const row = await db.query.guestApplicabilityChecks.findFirst({
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.claimTokenHash, hashGuestToken(token)),
          gt(table.expiresAt, new Date()),
          ...(checkId ? [eq(table.id, checkId)] : []),
        ) ?? operators.sql`true`,
    },
  });
  if (row) return row;
  await db
    .delete(guestApplicabilityChecks)
    .where(eq(guestApplicabilityChecks.claimTokenHash, hashGuestToken(token)));
  return null;
}

function guestResultDto(id: string, prepared: PreparedSubmission): ApplicabilityResultDto {
  return {
    outputRevisionId: id,
    outputRevisionNumber: 1,
    createdAt: prepared.now.toISOString(),
    assessmentRevisionId: null,
    evidence: prepared.evidence,
    result: prepared.result,
    definition: {
      hash: currentApplicabilityDefinitionHash,
      versionLabel: prepared.definition.releaseVersionLabel,
      isOutdated: false,
      supportedJurisdictionCodes: [...SUPPORTED_JURISDICTION_CODES],
    },
  };
}

function guestStoredResultDto(row: typeof guestApplicabilityChecks.$inferSelect) {
  const snapshot = parseResultSnapshot(row.resultSnapshot);
  return {
    outputRevisionId: row.id,
    outputRevisionNumber: 1,
    createdAt: row.submittedAt.toISOString(),
    assessmentRevisionId: null,
    evidence: snapshot.evidence,
    result: snapshot.result,
    definition: {
      hash: row.definitionHash,
      versionLabel: snapshot.versionLabel,
      isOutdated: row.definitionHash !== currentApplicabilityDefinitionHash,
      supportedJurisdictionCodes: [...SUPPORTED_JURISDICTION_CODES],
    },
  } satisfies ApplicabilityResultDto;
}

async function toResultDto(
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

function parseResultSnapshot(value: unknown): StoredResultSnapshot {
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

async function revisionNumber(
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

async function countPriorOutputRevisions(tx: Transaction, outputId: string) {
  return (
    await tx
      .select({ id: analysisOutputRevisions.id })
      .from(analysisOutputRevisions)
      .where(eq(analysisOutputRevisions.outputId, outputId))
  ).length - 1;
}

function isApplicabilityAnswerValue(value: unknown): value is ApplicabilityAnswerValue {
  return (
    (typeof value === "string" && value.length > 0) ||
    (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.length > 0))
  );
}

function getEntityCatalogs(questions: Definition["questions"]) {
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

function hashRuleInput(input: unknown) {
  return createHash("sha256").update(JSON.stringify(sortJson(input))).digest("hex");
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortJson(child)]),
    );
  }
  return value;
}
