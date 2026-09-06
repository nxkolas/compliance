import { db } from "@/src/db";
import { gapAnalysisCycles } from "@/src/db/schema";
import {
  currentGapDefinitionHash,
  getCurrentGapDefinition,
} from "./release/current";
import { and, eq, ne } from "drizzle-orm";
import { ApiError } from "../../platform/http/errors";
import { withAuthorizedOrganizationCommand, type OrganizationScopeExecutor } from "../../platform/auth/organization-scope";

const BUILD_HASH = process.env.APP_BUILD_SHA ?? currentGapDefinitionHash;

export async function createOrOpenQuestionnaireDraft(input: {
  userId: string;
  organizationId: string;
  assessment: { id: string; organizationId: string; currentRevisionId: string | null };
  questionnaireVersionId?: string;
  locale?: "de" | "en";
  executor?: OrganizationScopeExecutor;
}) {
  const executor = input.executor ?? db;
  const existing = await findOpenCycle(input.organizationId, executor);
  if (existing) return toDraft(existing);
  const [cycle] = await executor.insert(gapAnalysisCycles).values({
    organizationId: input.organizationId,
    definitionHash: currentGapDefinitionHash,
    buildHash: BUILD_HASH,
    locale: input.locale ?? "de",
    stage: "questions",
    draftAnswers: {},
    createdBy: input.userId,
  }).returning();
  if (!cycle) throw new Error("Gap questionnaire draft was not created");
  return toDraft(cycle);
}

export async function readQuestionnaireDraft(
  _assessmentId: string,
  organizationId: string,
) {
  const cycle = await findOpenCycle(organizationId);
  return cycle ? { ...toDraft(cycle), answers: answerIds(cycle.draftAnswers) } : null;
}

export async function saveQuestionnaireDraftAnswer(input: {
  userId: string;
  organizationId: string;
  draftId: string;
  questionId: string;
  optionId: string;
  expectedVersion?: number;
}) {
  return withAuthorizedOrganizationCommand({ actorUserId: input.userId, organizationId: input.organizationId, capability: "gap:contribute" }, async ({ executor }) => {
  const cycle = await executor.query.gapAnalysisCycles.findFirst({
    where: { RAW: (table, operators) => and(eq(table.id, input.draftId), eq(table.organizationId, input.organizationId)) ?? operators.sql`true` },
  });
  if (!cycle) throw new ApiError(404, "Gap questionnaire draft not found");
  if (cycle.stage !== "questions") throw new ApiError(409, "Gap answers are locked", undefined, "GAP_ANSWERS_LOCKED");
  const definition = getCurrentGapDefinition(cycle.locale as "de" | "en");
  const question = definition.questions.find((item) => item.id === input.questionId || item.stableKey === input.questionId);
  if (!question) throw new ApiError(400, "Unknown Gap question");
  const option = question.options.find((item) => item.id === input.optionId || item.stableValue === input.optionId);
  if (!option) throw new ApiError(400, "Unknown Gap answer option");
  const draftAnswers = { ...cycle.draftAnswers, [question.stableKey]: option.stableValue };
  const [updated] = await executor.update(gapAnalysisCycles).set({ draftAnswers, updatedAt: new Date() })
    .where(and(eq(gapAnalysisCycles.id, cycle.id), eq(gapAnalysisCycles.organizationId, input.organizationId), eq(gapAnalysisCycles.stage, "questions"))).returning();
  if (!updated) throw new ApiError(409, "Gap answers changed", undefined, "GAP_QUESTIONNAIRE_DRAFT_CHANGED");
  return {
    answer: {
      draftId: updated.id,
      questionId: question.id,
      optionId: option.id,
      version: 1,
    },
    draft: toDraft(updated),
  };
  });
}

function findOpenCycle(organizationId: string, executor: OrganizationScopeExecutor = db) {
  return executor.query.gapAnalysisCycles.findFirst({
    where: { RAW: (table, operators) => and(eq(table.organizationId, organizationId), ne(table.stage, "generated")) ?? operators.sql`true` },
    orderBy: { createdAt: "desc" },
  });
}

function toDraft(cycle: typeof gapAnalysisCycles.$inferSelect) {
  return {
    id: cycle.id,
    organizationId: cycle.organizationId,
    status: cycle.stage === "questions" ? "open" : "submitted",
    version: 1,
    lastSubmittedAssessmentRevisionId: cycle.assessmentRevisionId,
    createdBy: cycle.createdBy,
    updatedBy: cycle.createdBy,
    createdAt: cycle.createdAt,
    updatedAt: cycle.updatedAt,
  };
}

function answerIds(answers: Record<string, unknown>) {
  const definition = getCurrentGapDefinition("de");
  return Object.fromEntries(Object.entries(answers).flatMap(([key, value]) => {
    if (typeof value !== "string") return [];
    const question = definition.questions.find((item) => item.stableKey === key);
    const option = question?.options.find((item) => item.stableValue === value);
    return question && option ? [[question.id, option.id]] : [];
  }));
}
