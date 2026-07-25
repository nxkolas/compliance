import { db } from "@/src/db";
import {
  assessmentAnswerOptions,
  assessmentAnswers,
  assessmentRequirementEvaluations,
  assessmentRevisions,
  assessments,
  auditEvents,
  gapQuestionnaireDrafts,
} from "@/src/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { assertCanContributeToOrganization } from "../organizations/service";
import {
  evaluateGapRequirement,
  GAP_CATEGORY_EVALUATOR_KIND,
  GAP_CATEGORY_EVALUATOR_VERSION,
} from "./deterministic-evaluator";
import { assertGapInputsMutable } from "./lifecycle-guards";

export async function submitGapQuestionnaire(input: {
  userId: string;
  organizationId: string;
  assessmentId: string;
  draftId: string;
  expectedVersion: number;
}) {
  await assertCanContributeToOrganization(input.userId, input.organizationId);
  const assessment = await db.query.assessments.findFirst({
    columns: {
      id: true,
      organizationId: true,
      moduleId: true,
      gapAnalysisReleaseId: true,
      currentRevisionId: true,
      status: true,
    },
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.id, input.assessmentId),
          eq(table.organizationId, input.organizationId),
          eq(table.status, "active"),
        ) ?? operators.sql`true`,
    },
  });
  if (!assessment?.gapAnalysisReleaseId) {
    throw new ApiError(404, "Gap assessment not found");
  }
  await assertGapInputsMutable({
    organizationId: input.organizationId,
    moduleId: assessment.moduleId,
  });
  const release = await db.query.gapAnalysisReleases.findFirst({
    columns: {
      id: true,
      questionnaireVersionId: true,
      evaluatorKind: true,
      evaluatorVersion: true,
    },
    where: {
      RAW: (table, operators) =>
        eq(table.id, assessment.gapAnalysisReleaseId!) ??
        operators.sql`true`,
    },
  });
  if (!release) throw new ApiError(409, "Pinned gap release is unavailable");
  if (
    release.evaluatorKind !== GAP_CATEGORY_EVALUATOR_KIND ||
    release.evaluatorVersion !== GAP_CATEGORY_EVALUATOR_VERSION
  ) {
    throw new ApiError(409, "Pinned gap evaluator is unsupported");
  }

  return db.transaction(async (tx) => {
    const [draft] = await tx
      .select({
        id: gapQuestionnaireDrafts.id,
        organizationId: gapQuestionnaireDrafts.organizationId,
        assessmentId: gapQuestionnaireDrafts.assessmentId,
        gapAnalysisReleaseId: gapQuestionnaireDrafts.gapAnalysisReleaseId,
        questionnaireVersionId:
          gapQuestionnaireDrafts.questionnaireVersionId,
        status: gapQuestionnaireDrafts.status,
        version: gapQuestionnaireDrafts.version,
      })
      .from(gapQuestionnaireDrafts)
      .where(
        and(
          eq(gapQuestionnaireDrafts.id, input.draftId),
          eq(gapQuestionnaireDrafts.organizationId, input.organizationId),
          eq(gapQuestionnaireDrafts.assessmentId, input.assessmentId),
        ),
      )
      .limit(1)
      .for("update");
    if (!draft) throw new ApiError(404, "Questionnaire draft not found");
    if (draft.status !== "open") {
      throw new ApiError(409, "Questionnaire draft is locked");
    }
    if (
      draft.version !== input.expectedVersion ||
      draft.gapAnalysisReleaseId !== release.id ||
      draft.questionnaireVersionId !== release.questionnaireVersionId
    ) {
      throw new ApiError(
        412,
        "A newer questionnaire draft is available",
        undefined,
        "GAP_QUESTIONNAIRE_DRAFT_CHANGED",
      );
    }
    const questionRows = await tx.query.questions.findMany({
      columns: {
        id: true,
        stableKey: true,
        required: true,
        position: true,
      },
      where: {
        RAW: (table, operators) =>
          eq(
            table.questionnaireVersionId,
            release.questionnaireVersionId,
          ) ?? operators.sql`true`,
      },
      orderBy: { position: "asc" },
    });
    const draftAnswers =
      await tx.query.gapQuestionnaireDraftAnswers.findMany({
        columns: {
          draftId: true,
          questionId: true,
          questionOptionId: true,
        },
        where: {
          RAW: (table, operators) =>
            eq(table.draftId, draft.id) ?? operators.sql`true`,
        },
      });
    const required = questionRows.filter((question) => question.required);
    const answerByQuestion = new Map(
      draftAnswers.map((answer) => [answer.questionId, answer]),
    );
    if (
      draftAnswers.length !== answerByQuestion.size ||
      required.some((question) => !answerByQuestion.has(question.id)) ||
      draftAnswers.some(
        (answer) =>
          !questionRows.some((question) => question.id === answer.questionId),
      )
    ) {
      throw new ApiError(
        400,
        "Every required gap question must be answered exactly once",
      );
    }
    const optionRows = draftAnswers.length
      ? await tx.query.questionOptions.findMany({
          columns: { id: true, questionId: true, stableValue: true },
          where: {
            RAW: (table, operators) =>
              inArray(
                table.id,
                draftAnswers.map((answer) => answer.questionOptionId),
              ) ?? operators.sql`true`,
          },
        })
      : [];
    if (
      optionRows.length !== draftAnswers.length ||
      draftAnswers.some(
        (answer) =>
          !optionRows.some(
            (option) =>
              option.id === answer.questionOptionId &&
              option.questionId === answer.questionId,
          ),
      )
    ) {
      throw new ApiError(
        400,
        "A selected answer option does not belong to its question",
      );
    }
    const latest = await tx.query.assessmentRevisions.findFirst({
      columns: { id: true, revisionNumber: true },
      where: {
        RAW: (table, operators) =>
          eq(table.assessmentId, assessment.id) ?? operators.sql`true`,
      },
      orderBy: { revisionNumber: "desc" },
    });
    const [revision] = await tx
      .insert(assessmentRevisions)
      .values({
        assessmentId: assessment.id,
        questionnaireVersionId: release.questionnaireVersionId,
        revisionNumber: (latest?.revisionNumber ?? 0) + 1,
        parentRevisionId: assessment.currentRevisionId,
        status: "submitted",
        createdBy: input.userId,
        submittedAt: new Date(),
      })
      .returning();
    if (!revision) throw new ApiError(500, "Could not submit gap questionnaire");
    if (assessment.currentRevisionId) {
      await tx
        .update(assessmentRevisions)
        .set({ status: "superseded" })
        .where(eq(assessmentRevisions.id, assessment.currentRevisionId));
    }
    const questionById = new Map(
      questionRows.map((question) => [question.id, question]),
    );
    const answerRows = await tx
      .insert(assessmentAnswers)
      .values(
        draftAnswers.map((answer) => ({
          assessmentRevisionId: revision.id,
          questionId: answer.questionId,
          questionStableKey: requireValue(
            questionById,
            answer.questionId,
          ).stableKey,
        })),
      )
      .returning({ id: assessmentAnswers.id, questionId: assessmentAnswers.questionId });
    const answerIdByQuestion = new Map(
      answerRows.map((answer) => [answer.questionId, answer.id]),
    );
    await tx.insert(assessmentAnswerOptions).values(
      draftAnswers.map((answer) => ({
        assessmentAnswerId: requireValue(
          answerIdByQuestion,
          answer.questionId,
        ),
        questionId: answer.questionId,
        questionOptionId: answer.questionOptionId,
      })),
    );

    const mappings = await tx.query.gapRequirementQuestionMappings.findMany({
      columns: {
        requirementVersionId: true,
        questionId: true,
        position: true,
      },
      where: {
        RAW: (table, operators) =>
          eq(table.gapAnalysisReleaseId, release.id) ?? operators.sql`true`,
      },
      orderBy: { position: "asc" },
    });
    const requirementIds = [...new Set(
      mappings.map((mapping) => mapping.requirementVersionId),
    )];
    if (
      requirementIds.length !== 10 ||
      mappings.length !== questionRows.length
    ) {
      throw new ApiError(
        409,
        "Gap category evaluation coverage is incomplete",
      );
    }
    const optionById = new Map(optionRows.map((option) => [option.id, option]));
    const evaluations = requirementIds.map((requirementVersionId) => {
      const categoryMappings = mappings
        .filter(
          (mapping) =>
            mapping.requirementVersionId === requirementVersionId,
        )
        .sort((left, right) => left.position - right.position);
      const evaluated = evaluateGapRequirement({
        gapAnalysisReleaseId: release.id,
        questionnaireVersionId: release.questionnaireVersionId,
        assessmentRevisionId: revision.id,
        requirementVersionId,
        answers: categoryMappings.map((mapping) => {
          const draftAnswer = requireValue(
            answerByQuestion,
            mapping.questionId,
          );
          return {
            questionStableKey: requireValue(
              questionById,
              mapping.questionId,
            ).stableKey,
            stableValue: requireValue(
              optionById,
              draftAnswer.questionOptionId,
            ).stableValue,
          };
        }),
      });
      return {
        assessmentRevisionId: revision.id,
        requirementVersionId,
        status: evaluated.status,
        evaluatorKind: release.evaluatorKind,
        evaluatorVersion: release.evaluatorVersion,
        inputHash: evaluated.inputHash,
      };
    });
    await tx.insert(assessmentRequirementEvaluations).values(evaluations);
    await tx
      .update(assessments)
      .set({ currentRevisionId: revision.id })
      .where(eq(assessments.id, assessment.id));
    await tx
      .update(gapQuestionnaireDrafts)
      .set({
        lastSubmittedAssessmentRevisionId: revision.id,
        updatedBy: input.userId,
        updatedAt: new Date(),
      })
      .where(eq(gapQuestionnaireDrafts.id, draft.id));
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "gap_questionnaire.submitted",
      entityType: "assessment_revision",
      entityId: revision.id,
      metadata: {
        assessmentId: assessment.id,
        draftId: draft.id,
        draftVersion: draft.version,
        answeredCount: draftAnswers.length,
      },
    });
    return revision;
  });
}

export async function getGapQuestionnaireRevision(
  userId: string,
  organizationId: string,
  revisionId: string,
) {
  await assertCanContributeToOrganization(userId, organizationId);
  const [row] = await db
    .select({ revision: assessmentRevisions })
    .from(assessmentRevisions)
    .innerJoin(
      assessments,
      eq(assessmentRevisions.assessmentId, assessments.id),
    )
    .where(
      and(
        eq(assessmentRevisions.id, revisionId),
        eq(assessments.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new ApiError(
      404,
      "Gap questionnaire revision not found",
      undefined,
      "GAP_QUESTIONNAIRE_REVISION_NOT_FOUND",
    );
  }
  return row.revision;
}

function requireValue<K, V>(values: Map<K, V>, key: K) {
  const value = values.get(key);
  if (!value) throw new ApiError(500, `Required value ${String(key)} is missing`);
  return value;
}
