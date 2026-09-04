import { createHash } from "node:crypto";
import type { Locale } from "@/src/i18n/config";
import { analysisOutputRevisions, analysisOutputs, assessmentAnswers, assessmentRevisions, assessments, auditEvents } from "@/src/db/schema";
import {
  currentApplicabilityDefinitionHash,
  getCurrentApplicabilityDefinition,
} from "./release/current";
import { and, eq } from "drizzle-orm";
import { ApiError } from "../../platform/http/errors";
import { withAuthorizedOrganizationCommand } from "../../platform/auth/organization-scope";
import { localizeEvaluation } from "./localize-evaluation";
import { getVisibleQuestions, getVisibleOptions, isAnswered, type ApplicabilityAnswerValue } from "../compliance/runtime-release/question-visibility";
import { deriveFactsForAnswers } from "./fact-derivation";
import { parseStoredRuleEvaluationResult, type StoredRuleEvaluationResult } from "../compliance/nis2/rule-evaluation-schema";
import { evaluateRuleSet } from "../compliance/nis2/rules";
import { type SubmitApplicabilityCheckInput } from "./validation";
import type { ApplicabilityOptionDto, ApplicabilityResultDto, Definition, PreparedSubmission, StoredResultSnapshot, Transaction, ValidatedAnswer } from "./model";
import { toResultDto } from "./queries";

export const BUILD_HASH = process.env.APP_BUILD_SHA ?? currentApplicabilityDefinitionHash;

export const APPLICABILITY_KIND = "applicability" as const;

export async function submitApplicabilityCheckForUser(
  userId: string,
  organizationId: string,
  input: SubmitApplicabilityCheckInput,
): Promise<ApplicabilityResultDto> {
  const prepared = prepareSubmission(input);
  return withAuthorizedOrganizationCommand({ actorUserId: userId, organizationId, capability: "applicability:submit" }, ({ executor }) => persistSubmission(executor, userId, organizationId, prepared));
}

export function prepareSubmission(input: SubmitApplicabilityCheckInput): PreparedSubmission {
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

export function validateAnswers(
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
  const visible = getVisibleQuestions(definition.questions, record);
  for (const question of visible) {
    if (question.required && !isAnswered(values.get(question.id))) {
      throw new ApiError(400, "All required questions must be answered");
    }
  }
  return visible.flatMap((question): ValidatedAnswer[] => {
    const value = values.get(question.id);
    if (!isAnswered(value)) return [];
    const allowed = getVisibleOptions(definition.questions, question, record);
    const selectedValues = Array.isArray(value) ? [...new Set(value)] : [value];
    if (Array.isArray(value) !== (question.answerType === "multi_choice")) {
      throw new ApiError(400, "Answer value has the wrong shape");
    }
    if (selectedValues.length !== (Array.isArray(value) ? value.length : 1)) {
      throw new ApiError(400, "Multi-choice answers cannot contain duplicates");
    }
    const options = selectedValues.map((selected) => {
      const option = allowed.find((candidate) => candidate.stableValue === selected);
      if (!option) throw new ApiError(400, "Invalid answer value");
      return option;
    });
    assertNoExclusiveConflicts(options, selectedValues);
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

export function assertNoExclusiveConflicts(
  options: ApplicabilityOptionDto[],
  selectedValues: string[],
) {
  if (selectedValues.length < 2) return;
  const optionByValue = new Map(
    options.map((option) => [option.stableValue, option]),
  );
  const metadata = (stableValue: string) => {
    const option = optionByValue.get(stableValue);
    return option && isRecord(option.metadata) ? option.metadata : {};
  };
  const isExclusive = (stableValue: string) =>
    metadata(stableValue).exclusive === true ||
    stableValue === "none_of_these" ||
    stableValue === "unsure";

  const exclusiveValues = selectedValues.filter(isExclusive);
  if (exclusiveValues.length === 0) return;

  for (const exclusive of exclusiveValues) {
    const group = metadata(exclusive).sectorCode ?? exclusive;
    const conflicting = selectedValues.filter((other) => {
      if (other === exclusive) return false;
      if (group !== exclusive) return metadata(other).sectorCode === group;
      return true;
    });
    if (conflicting.length > 0) {
      throw new ApiError(400, "Exclusive answers cannot be combined");
    }
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function deriveFacts(definition: Definition, answers: ValidatedAnswer[]) {
  const byId = new Map(answers.map((answer) => [answer.questionId, answer.answerValue]));
  return deriveFactsForAnswers(
    definition.questions,
    Object.fromEntries(byId),
  );
}

export async function persistSubmission(
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
      sourceApplicabilityRevisionId: null,
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

export function isGapEligible(evidence: StoredRuleEvaluationResult) {
  return (
    evidence.jurisdiction.countryCode === "DE" &&
    (evidence.outcome === "essential_entity" || evidence.outcome === "important_entity")
  );
}

export async function countPriorOutputRevisions(tx: Transaction, outputId: string) {
  return (
    await tx
      .select({ id: analysisOutputRevisions.id })
      .from(analysisOutputRevisions)
      .where(eq(analysisOutputRevisions.outputId, outputId))
  ).length - 1;
}

export function hashRuleInput(input: unknown) {
  return createHash("sha256").update(JSON.stringify(sortJson(input))).digest("hex");
}

export function sortJson(value: unknown): unknown {
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
