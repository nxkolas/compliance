import { db } from "@/src/db";
import {
  assessmentAnswerOptions,
  assessmentAnswers,
  assessmentRevisions,
  assessments,
  auditEvents,
  gapAnalysisReleases,
  questionOptions,
  questions,
} from "@/src/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ApiError } from "../api/errors";
import { assertCanContributeToOrganization } from "../organizations/service";
import { assertGapInputsMutable } from "./lifecycle-guards";

export async function submitGapQuestionnaire(input: {
  userId: string;
  organizationId: string;
  assessmentId: string;
  answers: Array<{ questionId: string; optionId: string }>;
}) {
  await assertCanContributeToOrganization(input.userId, input.organizationId);
  const assessment = await db.query.assessments.findFirst({ columns: { id: true, organizationId: true, moduleId: true, questionnaireId: true, checkReleaseId: true, gapAnalysisReleaseId: true, applicabilityArtifactRevisionId: true, currentRevisionId: true, status: true, createdBy: true, createdAt: true },
    where: and(
      eq(assessments.id, input.assessmentId),
      eq(assessments.organizationId, input.organizationId),
      eq(assessments.status, "active"),
    ),
  });
  if (!assessment?.gapAnalysisReleaseId) {
    throw new ApiError(404, "Gap assessment not found");
  }
  await assertGapInputsMutable({
    organizationId: input.organizationId,
    moduleId: assessment.moduleId,
  });
  const release = await db.query.gapAnalysisReleases.findFirst({ columns: { id: true, releaseCode: true, versionLabel: true, moduleId: true, questionnaireId: true, questionnaireVersionId: true, requirementSetVersionId: true, compatibleCheckReleaseId: true, promptName: true, promptVersion: true, promptTemplateHash: true, responseSchemaVersion: true, evaluatorKind: true, evaluatorVersion: true, defaultLocale: true, status: true, aggregateHash: true, corpusReleaseSetHash: true, publishedAt: true, createdAt: true },
    where: eq(gapAnalysisReleases.id, assessment.gapAnalysisReleaseId),
  });
  if (!release) throw new ApiError(409, "Pinned gap release is unavailable");
  const questionRows = await db.query.questions.findMany({ columns: { id: true, questionnaireVersionId: true, stableKey: true, position: true, questionContentRevisionId: true, helpContentRevisionId: true, answerType: true, required: true, config: true, createdAt: true },
    where: eq(questions.questionnaireVersionId, release.questionnaireVersionId),
  });
  const required = questionRows.filter((question) => question.required);
  const answerByQuestion = new Map(
    input.answers.map((answer) => [answer.questionId, answer]),
  );
  if (
    answerByQuestion.size !== input.answers.length ||
    required.some((question) => !answerByQuestion.has(question.id)) ||
    input.answers.some(
      (answer) => !questionRows.some((question) => question.id === answer.questionId),
    )
  ) {
    throw new ApiError(400, "Every required gap question must be answered exactly once");
  }
  const optionRows = input.answers.length
    ? await db.query.questionOptions.findMany({ columns: { id: true, questionId: true, stableValue: true, labelContentRevisionId: true, factOptionId: true, position: true, metadata: true },
        where: inArray(
          questionOptions.id,
          input.answers.map((answer) => answer.optionId),
        ),
      })
    : [];
  if (
    optionRows.length !== input.answers.length ||
    input.answers.some(
      (answer) =>
        !optionRows.some(
          (option) =>
            option.id === answer.optionId && option.questionId === answer.questionId,
        ),
    )
  ) {
    throw new ApiError(400, "A selected answer option does not belong to its question");
  }
  const questionById = new Map(questionRows.map((question) => [question.id, question]));

  return db.transaction(async (tx) => {
    const latest = await tx.query.assessmentRevisions.findFirst({ columns: { id: true, assessmentId: true, questionnaireVersionId: true, revisionNumber: true, parentRevisionId: true, status: true, createdBy: true, createdAt: true, submittedAt: true },
      where: eq(assessmentRevisions.assessmentId, assessment.id),
      orderBy: [desc(assessmentRevisions.revisionNumber)],
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
    const answerRows = await tx
      .insert(assessmentAnswers)
      .values(
        input.answers.map((answer) => ({
          assessmentRevisionId: revision.id,
          questionId: answer.questionId,
          questionStableKey: requireQuestion(questionById, answer.questionId).stableKey,
        })),
      )
      .returning({ id: assessmentAnswers.id, questionId: assessmentAnswers.questionId });
    const answerIdByQuestion = new Map(
      answerRows.map((answer) => [answer.questionId, answer.id]),
    );
    await tx.insert(assessmentAnswerOptions).values(
      input.answers.map((answer) => ({
        assessmentAnswerId: requireId(answerIdByQuestion, answer.questionId),
        questionId: answer.questionId,
        questionOptionId: answer.optionId,
      })),
    );
    await tx
      .update(assessments)
      .set({ currentRevisionId: revision.id })
      .where(eq(assessments.id, assessment.id));
    await tx.insert(auditEvents).values({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      eventType: "gap_questionnaire.submitted",
      entityType: "assessment_revision",
      entityId: revision.id,
      metadata: { assessmentId: assessment.id },
    });
    return revision;
  });
}

export async function getGapQuestionnaireRevision(userId: string, organizationId: string, revisionId: string) {
  await assertCanContributeToOrganization(userId, organizationId);
  const [row] = await db.select({ revision: assessmentRevisions }).from(assessmentRevisions)
    .innerJoin(assessments, eq(assessmentRevisions.assessmentId, assessments.id))
    .where(and(eq(assessmentRevisions.id, revisionId), eq(assessments.organizationId, organizationId))).limit(1);
  if (!row) throw new ApiError(404, "Gap questionnaire revision not found", undefined, "GAP_QUESTIONNAIRE_REVISION_NOT_FOUND");
  return row.revision;
}

function requireQuestion(
  questionsById: Map<string, typeof questions.$inferSelect>,
  id: string,
) {
  const question = questionsById.get(id);
  if (!question) throw new ApiError(400, "Unknown question");
  return question;
}

function requireId(values: Map<string, string>, key: string) {
  const id = values.get(key);
  if (!id) throw new ApiError(500, "Assessment answer persistence is incomplete");
  return id;
}
