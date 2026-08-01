import { db } from "@/src/db";
import {
  auditEvents,
  gapQuestionnaireDraftAnswers,
  gapQuestionnaireDrafts,
} from "@/src/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { assertCanContributeToOrganization } from "../organizations/service";
import { assertGapInputsMutable } from "./lifecycle-guards";

export async function createOrOpenQuestionnaireDraft(input: {
  userId: string;
  organizationId: string;
  assessment: {
    id: string;
    organizationId: string;
    moduleId: string;
    gapAnalysisReleaseId: string | null;
    currentRevisionId: string | null;
  };
  questionnaireVersionId: string;
}) {
  if (!input.assessment.gapAnalysisReleaseId) {
    throw new ApiError(409, "Assessment has no Gap release");
  }
  const existing = await db.query.gapQuestionnaireDrafts.findFirst({
    columns: {
      id: true,
      organizationId: true,
      assessmentId: true,
      gapAnalysisReleaseId: true,
      questionnaireVersionId: true,
      status: true,
      version: true,
      lastSubmittedAssessmentRevisionId: true,
      createdBy: true,
      updatedBy: true,
      createdAt: true,
      updatedAt: true,
    },
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.assessmentId, input.assessment.id),
          eq(table.status, "open"),
        ) ?? operators.sql`true`,
    },
  });
  if (existing) return existing;

  return db.transaction(async (tx) => {
    const [draft] = await tx
      .insert(gapQuestionnaireDrafts)
      .values({
        organizationId: input.organizationId,
        assessmentId: input.assessment.id,
        gapAnalysisReleaseId: input.assessment.gapAnalysisReleaseId!,
        questionnaireVersionId: input.questionnaireVersionId,
        createdBy: input.userId,
        updatedBy: input.userId,
      })
      .onConflictDoNothing()
      .returning();
    const current =
      draft ??
      (await tx.query.gapQuestionnaireDrafts.findFirst({
        columns: {
          id: true,
          organizationId: true,
          assessmentId: true,
          gapAnalysisReleaseId: true,
          questionnaireVersionId: true,
          status: true,
          version: true,
          lastSubmittedAssessmentRevisionId: true,
          createdBy: true,
          updatedBy: true,
          createdAt: true,
          updatedAt: true,
        },
        where: {
          RAW: (table, operators) =>
            and(
              eq(table.assessmentId, input.assessment.id),
              eq(table.status, "open"),
            ) ?? operators.sql`true`,
        },
      }));
    if (!current) throw new ApiError(500, "Could not create questionnaire draft");
    if (draft && input.assessment.currentRevisionId) {
      const answerRows = await tx.query.assessmentAnswers.findMany({
        columns: { id: true, questionId: true },
        where: {
          RAW: (table, operators) =>
            eq(
              table.assessmentRevisionId,
              input.assessment.currentRevisionId!,
            ) ?? operators.sql`true`,
        },
      });
      const selected = answerRows.length
        ? await tx.query.assessmentAnswerOptions.findMany({
            columns: {
              assessmentAnswerId: true,
              questionId: true,
              questionOptionId: true,
            },
            where: {
              RAW: (table, operators) =>
                inArray(
                  table.assessmentAnswerId,
                  answerRows.map((answer) => answer.id),
                ) ?? operators.sql`true`,
            },
          })
        : [];
      if (selected.length) {
        await tx.insert(gapQuestionnaireDraftAnswers).values(
          selected.map((answer) => ({
            draftId: current.id,
            questionId: answer.questionId,
            questionOptionId: answer.questionOptionId,
            updatedBy: input.userId,
          })),
        );
      }
    }
    return current;
  });
}

export async function readQuestionnaireDraft(
  assessmentId: string,
  organizationId: string,
) {
  const draft = await db.query.gapQuestionnaireDrafts.findFirst({
    columns: {
      id: true,
      version: true,
      status: true,
      updatedAt: true,
    },
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.assessmentId, assessmentId),
          eq(table.organizationId, organizationId),
          eq(table.status, "open"),
        ) ?? operators.sql`true`,
    },
  });
  if (!draft || draft.status !== "open") return null;
  const rows = await db.query.gapQuestionnaireDraftAnswers.findMany({
    columns: { questionId: true, questionOptionId: true },
    where: {
      RAW: (table, operators) =>
        eq(table.draftId, draft.id) ?? operators.sql`true`,
    },
  });
  return {
    id: draft.id,
    version: draft.version,
    status: "open" as const,
    answers: Object.fromEntries(
      rows.map((row) => [row.questionId, row.questionOptionId]),
    ),
    updatedAt: draft.updatedAt.toISOString(),
  };
}

export async function saveQuestionnaireDraftAnswer(input: {
  userId: string;
  organizationId: string;
  draftId: string;
  questionId: string;
  optionId: string;
  expectedVersion: number;
}) {
  await assertCanContributeToOrganization(input.userId, input.organizationId);
  const draft = await db.query.gapQuestionnaireDrafts.findFirst({
    columns: {
      id: true,
      organizationId: true,
      assessmentId: true,
      gapAnalysisReleaseId: true,
      questionnaireVersionId: true,
      status: true,
      version: true,
    },
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.id, input.draftId),
          eq(table.organizationId, input.organizationId),
        ) ?? operators.sql`true`,
    },
  });
  if (!draft) throw new ApiError(404, "Questionnaire draft not found");
  if (draft.status !== "open") {
    throw new ApiError(409, "Questionnaire draft is locked", undefined, "GAP_INPUTS_LOCKED");
  }
  const assessment = await db.query.assessments.findFirst({
    columns: { moduleId: true },
    where: {
      RAW: (table, operators) =>
        eq(table.id, draft.assessmentId) ?? operators.sql`true`,
    },
  });
  if (!assessment) throw new ApiError(404, "Gap assessment not found");
  await assertGapInputsMutable({
    organizationId: input.organizationId,
    moduleId: assessment.moduleId,
  });
  const [question, option] = await Promise.all([
    db.query.questions.findFirst({
      columns: { id: true, questionnaireVersionId: true },
      where: {
        RAW: (table, operators) =>
          and(
            eq(table.id, input.questionId),
            eq(table.questionnaireVersionId, draft.questionnaireVersionId),
          ) ?? operators.sql`true`,
      },
    }),
    db.query.questionOptions.findFirst({
      columns: { id: true, questionId: true },
      where: {
        RAW: (table, operators) =>
          and(
            eq(table.id, input.optionId),
            eq(table.questionId, input.questionId),
          ) ?? operators.sql`true`,
      },
    }),
  ]);
  if (!question || !option) {
    throw new ApiError(400, "The option does not belong to the draft question");
  }
  return db.transaction(async (tx) => {
    const now = new Date();
    const [updated] = await tx
      .update(gapQuestionnaireDrafts)
      .set({
        version: input.expectedVersion + 1,
        updatedBy: input.userId,
        updatedAt: now,
      })
      .where(
        and(
          eq(gapQuestionnaireDrafts.id, input.draftId),
          eq(gapQuestionnaireDrafts.organizationId, input.organizationId),
          eq(gapQuestionnaireDrafts.status, "open"),
          eq(gapQuestionnaireDrafts.version, input.expectedVersion),
        ),
      )
      .returning({ version: gapQuestionnaireDrafts.version });
    if (!updated) {
      throw new ApiError(
        412,
        "A newer questionnaire draft is available",
        undefined,
        "GAP_QUESTIONNAIRE_DRAFT_CHANGED",
      );
    }
    await tx
      .insert(gapQuestionnaireDraftAnswers)
      .values({
        draftId: input.draftId,
        questionId: input.questionId,
        questionOptionId: input.optionId,
        updatedBy: input.userId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          gapQuestionnaireDraftAnswers.draftId,
          gapQuestionnaireDraftAnswers.questionId,
        ],
        set: {
          questionOptionId: input.optionId,
          updatedBy: input.userId,
          updatedAt: now,
        },
      });
    const requiredQuestions = await tx.query.questions.findMany({
      columns: { id: true },
      where: {
        RAW: (table, operators) =>
          and(
            eq(table.questionnaireVersionId, draft.questionnaireVersionId),
            eq(table.required, true),
          ) ?? operators.sql`true`,
      },
    });
    const answered = requiredQuestions.length
      ? await tx.query.gapQuestionnaireDraftAnswers.findMany({
      columns: { questionId: true },
      where: {
        RAW: (table, operators) =>
          and(
            eq(table.draftId, input.draftId),
            inArray(
              table.questionId,
              requiredQuestions.map((question) => question.id),
            ),
          ) ?? operators.sql`true`,
      },
    })
      : [];
    const completion = {
      answeredRequired: new Set(answered.map((answer) => answer.questionId)).size,
      totalRequired: requiredQuestions.length,
      complete: requiredQuestions.length === 0 || answered.length === requiredQuestions.length,
    };
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "gap_questionnaire_draft.updated",
      entityType: "gap_questionnaire_draft",
      entityId: input.draftId,
      metadata: {
        assessmentId: draft.assessmentId,
        version: updated.version,
        answeredCount: completion.answeredRequired,
        requiredCount: completion.totalRequired,
      },
    });
    return {
      answer: {
        draftId: input.draftId,
        version: updated.version,
        questionId: input.questionId,
        optionId: input.optionId,
        updatedAt: now.toISOString(),
      },
      completion,
    };
  });
}
