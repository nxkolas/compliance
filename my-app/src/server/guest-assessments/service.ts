import { db } from "@/src/db";
import {
  guestAssessmentSessions,
  organizationMembers,
  organizations,
  questionnaireAnswers,
  questionnaireQuestions,
  questionnaireRuns,
  questionnaireSections,
  questionnaireTemplates,
  selfCheckAssessments,
} from "@/src/db/schema";
import type { User } from "@supabase/supabase-js";
import { and, eq, inArray } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { ApiError } from "../api/errors";
import {
  calculateProgress,
  evaluateQuickCheck,
  type QuickCheckAnswerMap,
} from "./rules";
import type {
  CreateGuestAssessmentInput,
  SaveGuestAnswersInput,
} from "./validation";

export const guestClaimCookieName = "complyx-guest-claim";
const templateCode = "nis2_guest_quick_check";
const templateVersion = "1";
const guestLifetimeMs = 30 * 24 * 60 * 60 * 1000;

export async function createGuestAssessment(
  user: User,
  input: CreateGuestAssessmentInput,
) {
  if (!user.is_anonymous) {
    throw new ApiError(409, "A guest assessment requires an anonymous session");
  }

  const template = await getActiveTemplate();
  const claimToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + guestLifetimeMs);

  const created = await db.transaction(async (tx) => {
    const [organization] = await tx
      .insert(organizations)
      .values({
        name: input.companyName,
        legalName: input.companyName,
        countryCode: "DE",
      })
      .returning();

    await tx.insert(organizationMembers).values({
      organizationId: organization.id,
      userId: user.id,
      role: "owner",
    });

    const [assessment] = await tx
      .insert(selfCheckAssessments)
      .values({
        organizationId: organization.id,
        title: `NIS2 Schnellcheck - ${input.companyName}`,
        performedByUserId: user.id,
        status: "draft",
        category: "unknown",
      })
      .returning();

    const [run] = await tx
      .insert(questionnaireRuns)
      .values({
        organizationId: organization.id,
        templateId: template.id,
        selfCheckAssessmentId: assessment.id,
        performedByUserId: user.id,
        status: "draft",
        result: "unknown",
        progress: 0,
      })
      .returning();

    await tx.insert(guestAssessmentSessions).values({
      organizationId: organization.id,
      assessmentId: assessment.id,
      anonymousUserId: user.id,
      claimTokenHash: hashToken(claimToken),
      expiresAt,
    });

    return { organization, assessment, run };
  });

  return { ...created, claimToken, expiresAt };
}

export async function getGuestAssessment(
  user: User,
  assessmentId: string,
  claimToken?: string,
) {
  const session = await authorizeGuestAssessment(
    user,
    assessmentId,
    claimToken,
  );
  const assessment = await db.query.selfCheckAssessments.findFirst({
    where: eq(selfCheckAssessments.id, assessmentId),
    with: { organization: true },
  });
  const run = await db.query.questionnaireRuns.findFirst({
    where: eq(questionnaireRuns.selfCheckAssessmentId, assessmentId),
    with: {
      template: {
        with: {
          sections: {
            with: { questions: true },
          },
        },
      },
      answers: true,
    },
  });

  if (!assessment || !run) {
    throw new ApiError(404, "Guest assessment not found");
  }

  const sections = [...run.template.sections]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((section) => ({
      ...section,
      questions: [...section.questions].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      ),
    }));

  return {
    session: {
      status: session.status,
      expiresAt: session.expiresAt,
    },
    assessment,
    organization: assessment.organization,
    run: {
      id: run.id,
      status: run.status,
      result: run.result,
      progress: run.progress,
      score: run.score,
      summary: run.summary,
      reasoning: run.reasoning,
      answersSnapshot: run.answersSnapshot,
      completedAt: run.completedAt,
    },
    template: {
      id: run.template.id,
      title: run.template.title,
      description: run.template.description,
      sections,
    },
    answers: run.answers,
  };
}

export async function saveGuestAnswers(
  user: User,
  assessmentId: string,
  input: SaveGuestAnswersInput,
  claimToken?: string,
) {
  await authorizeGuestAssessment(user, assessmentId, claimToken);
  const run = await getRun(assessmentId);

  const requestedIds = input.answers.map((answer) => answer.questionId);
  const validQuestions = await db
    .select({ id: questionnaireQuestions.id })
    .from(questionnaireQuestions)
    .innerJoin(
      questionnaireSections,
      eq(questionnaireQuestions.sectionId, questionnaireSections.id),
    )
    .where(
      and(
        eq(questionnaireSections.templateId, run.templateId),
        inArray(questionnaireQuestions.id, requestedIds),
      ),
    );

  if (validQuestions.length !== new Set(requestedIds).size) {
    throw new ApiError(400, "One or more questions do not belong to this questionnaire");
  }

  await db.transaction(async (tx) => {
    for (const answer of input.answers) {
      await tx
        .insert(questionnaireAnswers)
        .values({
          runId: run.id,
          questionId: answer.questionId,
          value: { value: answer.value },
          answeredByUserId: user.id,
        })
        .onConflictDoUpdate({
          target: [questionnaireAnswers.runId, questionnaireAnswers.questionId],
          set: {
            value: { value: answer.value },
            answeredByUserId: user.id,
            updatedAt: new Date(),
          },
        });
    }

    const requiredQuestions = await tx
      .select({ id: questionnaireQuestions.id })
      .from(questionnaireQuestions)
      .innerJoin(
        questionnaireSections,
        eq(questionnaireQuestions.sectionId, questionnaireSections.id),
      )
      .where(
        and(
          eq(questionnaireSections.templateId, run.templateId),
          eq(questionnaireQuestions.isRequired, true),
        ),
      );
    const savedAnswers = await tx
      .select({ questionId: questionnaireAnswers.questionId })
      .from(questionnaireAnswers)
      .where(eq(questionnaireAnswers.runId, run.id));
    const progress = calculateProgress(
      requiredQuestions.map((question) => question.id),
      savedAnswers.map((answer) => answer.questionId),
    );

    await tx
      .update(questionnaireRuns)
      .set({ progress, updatedAt: new Date() })
      .where(eq(questionnaireRuns.id, run.id));
  });

  return getGuestAssessment(user, assessmentId, claimToken);
}

export async function completeGuestAssessment(
  user: User,
  assessmentId: string,
  claimToken?: string,
) {
  await authorizeGuestAssessment(user, assessmentId, claimToken);
  const existing = await getGuestAssessment(user, assessmentId, claimToken);

  const questions = existing.template.sections.flatMap(
    (section) => section.questions,
  );
  const answerByQuestionId = new Map(
    existing.answers.map((answer) => [answer.questionId, answer.value]),
  );
  const missing = questions.filter(
    (question) =>
      question.isRequired && !answerByQuestionId.has(question.id),
  );
  if (missing.length > 0) {
    throw new ApiError(400, "Please answer all required questions", {
      missingQuestionIds: missing.map((question) => question.id),
    });
  }

  const answersByCode: QuickCheckAnswerMap = {};
  for (const question of questions) {
    const stored = answerByQuestionId.get(question.id);
    if (stored && typeof stored === "object" && "value" in stored) {
      answersByCode[question.code] = stored.value;
    }
  }
  const result = evaluateQuickCheck(answersByCode);
  const completedAt = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(questionnaireRuns)
      .set({
        status: "completed",
        result: result.result,
        progress: 100,
        summary: result.summary,
        reasoning: result.reasoning,
        answersSnapshot: answersByCode,
        completedAt,
        updatedAt: completedAt,
      })
      .where(eq(questionnaireRuns.id, existing.run.id));
    await tx
      .update(selfCheckAssessments)
      .set({
        status: "completed",
        category: result.category,
        reasoning: result.reasoning,
        answers: answersByCode,
        lexSpecialisApplies: answersByCode.lex_specialis === "yes",
        completedAt,
        updatedAt: completedAt,
      })
      .where(eq(selfCheckAssessments.id, assessmentId));
  });

  return getGuestAssessment(user, assessmentId, claimToken);
}

export async function deleteGuestAssessment(
  user: User,
  assessmentId: string,
  claimToken?: string,
) {
  const session = await authorizeGuestAssessment(user, assessmentId, claimToken);
  if (session.status === "claimed") {
    throw new ApiError(409, "Claimed assessments must be managed from the account");
  }
  await db
    .delete(organizations)
    .where(eq(organizations.id, session.organizationId));
  return session.anonymousUserId;
}

export async function claimGuestAssessment(
  user: User,
  assessmentId: string,
  claimToken?: string,
) {
  if (user.is_anonymous) {
    throw new ApiError(401, "Create an account or sign in before claiming");
  }

  const session = await db.query.guestAssessmentSessions.findFirst({
    where: eq(guestAssessmentSessions.assessmentId, assessmentId),
  });
  if (!session) throw new ApiError(404, "Guest assessment not found");
  if (session.status === "claimed") {
    if (session.claimedByUserId === user.id) {
      return {
        ...session,
        previousAnonymousUserId: session.anonymousUserId,
      };
    }
    throw new ApiError(409, "This assessment has already been claimed");
  }
  assertActive(session);

  const sameUser = session.anonymousUserId === user.id;
  if (!sameUser && !matchesToken(session.claimTokenHash, claimToken)) {
    throw new ApiError(403, "Invalid guest assessment claim");
  }

  const claimedAt = new Date();
  return db.transaction(async (tx) => {
    if (!sameUser) {
      await tx
        .delete(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, session.organizationId),
            eq(organizationMembers.userId, session.anonymousUserId),
          ),
        );
      await tx
        .insert(organizationMembers)
        .values({
          organizationId: session.organizationId,
          userId: user.id,
          role: "owner",
        })
        .onConflictDoNothing({
          target: [organizationMembers.organizationId, organizationMembers.userId],
        });
      await tx
        .update(selfCheckAssessments)
        .set({ performedByUserId: user.id, updatedAt: claimedAt })
        .where(eq(selfCheckAssessments.id, assessmentId));
      await tx
        .update(questionnaireRuns)
        .set({ performedByUserId: user.id, updatedAt: claimedAt })
        .where(eq(questionnaireRuns.selfCheckAssessmentId, assessmentId));
      const run = await tx.query.questionnaireRuns.findFirst({
        where: eq(questionnaireRuns.selfCheckAssessmentId, assessmentId),
      });
      if (run) {
        await tx
          .update(questionnaireAnswers)
          .set({ answeredByUserId: user.id, updatedAt: claimedAt })
          .where(eq(questionnaireAnswers.runId, run.id));
      }
    }

    const [claimed] = await tx
      .update(guestAssessmentSessions)
      .set({
        status: "claimed",
        claimedByUserId: user.id,
        claimedAt,
        claimTokenHash: hashToken(randomBytes(32).toString("base64url")),
        updatedAt: claimedAt,
      })
      .where(eq(guestAssessmentSessions.id, session.id))
      .returning();
    return { ...claimed, previousAnonymousUserId: session.anonymousUserId };
  });
}

async function authorizeGuestAssessment(
  user: User,
  assessmentId: string,
  claimToken?: string,
) {
  const session = await db.query.guestAssessmentSessions.findFirst({
    where: eq(guestAssessmentSessions.assessmentId, assessmentId),
  });
  if (!session) throw new ApiError(404, "Guest assessment not found");
  assertActive(session);

  const ownsSession =
    session.anonymousUserId === user.id || session.claimedByUserId === user.id;
  if (!ownsSession || !matchesToken(session.claimTokenHash, claimToken)) {
    throw new ApiError(404, "Guest assessment not found");
  }
  return session;
}

async function getRun(assessmentId: string) {
  const run = await db.query.questionnaireRuns.findFirst({
    where: eq(questionnaireRuns.selfCheckAssessmentId, assessmentId),
  });
  if (!run) throw new ApiError(404, "Questionnaire run not found");
  return run;
}

async function getActiveTemplate() {
  const template = await db.query.questionnaireTemplates.findFirst({
    where: and(
      eq(questionnaireTemplates.code, templateCode),
      eq(questionnaireTemplates.version, templateVersion),
      eq(questionnaireTemplates.isActive, true),
    ),
  });
  if (!template) {
    throw new ApiError(
      503,
      "Guest questionnaire is not seeded. Run npm run db:seed:questionnaire.",
    );
  }
  return template;
}

function assertActive(session: typeof guestAssessmentSessions.$inferSelect) {
  if (session.status === "expired" || session.expiresAt <= new Date()) {
    throw new ApiError(410, "Guest assessment has expired");
  }
}

function matchesToken(expectedHash: string, token?: string) {
  return Boolean(token && hashToken(token) === expectedHash);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
