import { db } from "@/src/db";
import {
  artifactRevisionSources,
  assessmentAnswers,
  assessmentRevisions,
  assessments,
  complianceFrameworkVersions,
  complianceFrameworks,
  complianceModules,
  generatedArtifactRevisions,
  generatedArtifacts,
  guestApplicabilityChecks,
  organizationFactValues,
  questionFactMappings,
  questionOptionTranslations,
  questionOptions,
  questionTranslations,
  questionnaireVersions,
  questionnaires,
  questions,
  ruleSets,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { and, asc, eq } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { ApiError } from "../api/errors";
import { assertCanAccessOrganization } from "../organizations/service";
import {
  ACTIVE_FRAMEWORK_CODE,
  ACTIVE_FRAMEWORK_VERSION_LABEL,
  ACTIVE_MODULE_CODE,
  ACTIVE_QUESTIONNAIRE_CODE,
} from "../questionnaires/service";
import {
  parseStoredRuleEvaluationResult,
  type StoredRuleEvaluationResult,
} from "./rule-evaluation-schema";
import { evaluateRuleSet } from "./rules";
import {
  submitApplicabilityCheckSchema,
  type SubmitApplicabilityCheckInput,
} from "./validation";

const ACTIVE_RULE_SET_CODE = "affectedness_check";
const GUEST_CHECK_TTL_DAYS = 14;

export type ApplicabilityQuestionnaireDto = {
  id: string;
  moduleId: string;
  questionnaireVersionId: string;
  title: string;
  code: string;
  versionLabel: string;
  questions: ApplicabilityQuestionDto[];
  latestAnswers: Record<string, string>;
};

export type ApplicabilityQuestionDto = {
  id: string;
  stableKey: string;
  position: number;
  questionText: string;
  helpText: string | null;
  answerType: string;
  required: boolean;
  config: unknown;
  options: ApplicabilityOptionDto[];
};

export type ApplicabilityOptionDto = {
  id: string;
  stableValue: string;
  label: string;
  position: number;
  metadata: unknown;
};

export type ApplicabilityOverviewDto = {
  assessmentId: string;
  assessmentRevisionId: string;
  assessmentRevisionNumber: number;
  submittedAt: string | null;
  result: ApplicabilityResultDto | null;
};

export type ApplicabilityAnswersDto = {
  assessmentId: string;
  assessmentRevisionId: string;
  assessmentRevisionNumber: number;
  submittedAt: string | null;
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
  artifactRevisionId: string;
  artifactRevisionNumber: number;
  createdAt: string;
  ruleSetId: string | null;
  ruleSetVersionLabel: string | null;
  assessmentRevisionId: string | null;
  result: StoredRuleEvaluationResult;
};

export type GuestApplicabilitySession = {
  id: string;
  token: string;
};

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

type ActiveDefinition = {
  moduleId: string;
  questionnaireId: string;
  questionnaireVersionId: string;
  questionnaireTitle: string;
  questionnaireCode: string;
  versionLabel: string;
  questions: Array<
    ApplicabilityQuestionDto & {
      factMappings: Array<{ factKey: string; transform: unknown }>;
    }
  >;
};

type ValidatedAnswer = {
  questionId: string;
  questionStableKey: string;
  answerValue: string;
  answerLabel: string;
};

type PreparedApplicabilitySubmission = {
  definition: ActiveDefinition;
  ruleSet: NonNullable<Awaited<ReturnType<typeof getActiveRuleSet>>>;
  validatedAnswers: ValidatedAnswer[];
  facts: Record<string, unknown>;
  answerContext: Record<string, string>;
  evaluation: ReturnType<typeof evaluateRuleSet>;
  now: Date;
};

export async function getApplicabilityQuestionnaireForUser(
  userId: string,
  organizationId: string,
  locale: Locale,
): Promise<ApplicabilityQuestionnaireDto | null> {
  await assertCanAccessOrganization(userId, organizationId);

  const definition = await getActiveDefinition(locale);

  if (!definition) {
    return null;
  }

  const latestAnswers = await getLatestAnswerMap(
    organizationId,
    definition.moduleId,
  );

  return {
    id: definition.questionnaireId,
    moduleId: definition.moduleId,
    questionnaireVersionId: definition.questionnaireVersionId,
    title: definition.questionnaireTitle,
    code: definition.questionnaireCode,
    versionLabel: definition.versionLabel,
    questions: definition.questions.map(({ factMappings, ...question }) => {
      void factMappings;
      return question;
    }),
    latestAnswers,
  };
}

export async function getApplicabilityQuestionnaireForGuest(
  locale: Locale,
): Promise<ApplicabilityQuestionnaireDto | null> {
  const definition = await getActiveDefinition(locale);

  if (!definition) {
    return null;
  }

  return {
    id: definition.questionnaireId,
    moduleId: definition.moduleId,
    questionnaireVersionId: definition.questionnaireVersionId,
    title: definition.questionnaireTitle,
    code: definition.questionnaireCode,
    versionLabel: definition.versionLabel,
    questions: definition.questions.map(({ factMappings, ...question }) => {
      void factMappings;
      return question;
    }),
    latestAnswers: {},
  };
}

export async function getApplicabilityOverviewForUser(
  userId: string,
  organizationId: string,
): Promise<ApplicabilityOverviewDto | null> {
  await assertCanAccessOrganization(userId, organizationId);
  const definition = await getActiveDefinition();

  if (!definition) {
    return null;
  }

  const assessment = await getCurrentAssessment(
    organizationId,
    definition.moduleId,
  );

  if (!assessment?.currentRevisionId) {
    return null;
  }

  const revision = await db.query.assessmentRevisions.findFirst({
    where: eq(assessmentRevisions.id, assessment.currentRevisionId),
  });

  if (!revision) {
    return null;
  }

  return {
    assessmentId: assessment.id,
    assessmentRevisionId: revision.id,
    assessmentRevisionNumber: revision.revisionNumber,
    submittedAt: revision.submittedAt?.toISOString() ?? null,
    result: await getCurrentResult(organizationId, definition.moduleId),
  };
}

export async function getApplicabilityAnswersForUser(
  userId: string,
  organizationId: string,
  locale: Locale,
): Promise<ApplicabilityAnswersDto | null> {
  await assertCanAccessOrganization(userId, organizationId);
  const definition = await getActiveDefinition(locale);

  if (!definition) {
    return null;
  }

  const assessment = await getCurrentAssessment(
    organizationId,
    definition.moduleId,
  );

  if (!assessment?.currentRevisionId) {
    return null;
  }

  const revision = await db.query.assessmentRevisions.findFirst({
    where: eq(assessmentRevisions.id, assessment.currentRevisionId),
  });

  if (!revision) {
    return null;
  }

  const rows = await db
    .select({
      questionId: assessmentAnswers.questionId,
      questionStableKey: assessmentAnswers.questionStableKey,
      questionText: questions.questionText,
      questionConfig: questions.config,
      questionPosition: questions.position,
      answerValue: assessmentAnswers.answerValue,
      answerLabel: assessmentAnswers.answerLabel,
    })
    .from(assessmentAnswers)
    .innerJoin(questions, eq(assessmentAnswers.questionId, questions.id))
    .where(eq(assessmentAnswers.assessmentRevisionId, revision.id))
    .orderBy(asc(questions.position));

  return {
    assessmentId: assessment.id,
    assessmentRevisionId: revision.id,
    assessmentRevisionNumber: revision.revisionNumber,
    submittedAt: revision.submittedAt?.toISOString() ?? null,
    answers: rows.map((row) => {
      const question = definition.questions.find(
        (candidate) => candidate.id === row.questionId,
      );
      const option = question?.options.find(
        (candidate) => candidate.stableValue === row.answerValue,
      );

      return {
        ...row,
        questionText: question?.questionText ?? row.questionText,
        answerLabel: option?.label ?? row.answerLabel,
        answerMetadata: option?.metadata ?? null,
      };
    }),
  };
}

export async function getApplicabilityResultForUser(
  userId: string,
  organizationId: string,
): Promise<ApplicabilityResultDto | null> {
  await assertCanAccessOrganization(userId, organizationId);
  const definition = await getActiveDefinition();

  if (!definition) {
    return null;
  }

  return getCurrentResult(organizationId, definition.moduleId);
}

export async function submitApplicabilityCheckForUser(
  userId: string,
  organizationId: string,
  input: SubmitApplicabilityCheckInput,
): Promise<ApplicabilityResultDto> {
  await assertCanAccessOrganization(userId, organizationId);
  const prepared = await prepareApplicabilitySubmission(input);
  const {
    definition,
    ruleSet,
    validatedAnswers,
    facts,
    answerContext,
    evaluation,
    now,
  } = prepared;

  return db.transaction(async (tx) => {
    let assessment = await tx.query.assessments.findFirst({
      where: and(
        eq(assessments.organizationId, organizationId),
        eq(assessments.moduleId, definition.moduleId),
        eq(assessments.status, "active"),
      ),
    });

    if (!assessment) {
      const [createdAssessment] = await tx
        .insert(assessments)
        .values({
          organizationId,
          moduleId: definition.moduleId,
          questionnaireId: definition.questionnaireId,
          createdBy: userId,
        })
        .returning();
      assessment = createdAssessment;
    }

    const latestRevision = await tx.query.assessmentRevisions.findFirst({
      where: eq(assessmentRevisions.assessmentId, assessment.id),
      orderBy: (revision, { desc: orderDesc }) => [
        orderDesc(revision.revisionNumber),
      ],
    });
    const [assessmentRevision] = await tx
      .insert(assessmentRevisions)
      .values({
        assessmentId: assessment.id,
        questionnaireVersionId: definition.questionnaireVersionId,
        revisionNumber: (latestRevision?.revisionNumber ?? 0) + 1,
        parentRevisionId: assessment.currentRevisionId,
        status: "submitted",
        createdBy: userId,
        submittedAt: now,
      })
      .returning();

    if (assessment.currentRevisionId) {
      await tx
        .update(assessmentRevisions)
        .set({ status: "superseded" })
        .where(eq(assessmentRevisions.id, assessment.currentRevisionId));
    }

    await tx
      .update(assessments)
      .set({ currentRevisionId: assessmentRevision.id })
      .where(eq(assessments.id, assessment.id));

    await tx.insert(assessmentAnswers).values(
      validatedAnswers.map((answer) => ({
        assessmentRevisionId: assessmentRevision.id,
        questionId: answer.questionId,
        questionStableKey: answer.questionStableKey,
        answerValue: answer.answerValue,
        answerLabel: answer.answerLabel,
      })),
    );

    const factEntries = Object.entries(facts);

    for (const [factKey, value] of factEntries) {
      await tx
        .update(organizationFactValues)
        .set({ isCurrent: false })
        .where(
          and(
            eq(organizationFactValues.organizationId, organizationId),
            eq(organizationFactValues.factKey, factKey),
            eq(organizationFactValues.isCurrent, true),
          ),
        );

      await tx.insert(organizationFactValues).values({
        organizationId,
        factKey,
        value,
        sourceType: "assessment_revision",
        sourceRevisionId: assessmentRevision.id,
        confidence: "1.0000",
        isCurrent: true,
      });
    }

    let artifact = await tx.query.generatedArtifacts.findFirst({
      where: and(
        eq(generatedArtifacts.organizationId, organizationId),
        eq(generatedArtifacts.moduleId, definition.moduleId),
        eq(generatedArtifacts.artifactType, "affectedness_result"),
      ),
    });

    if (!artifact) {
      const [createdArtifact] = await tx
        .insert(generatedArtifacts)
        .values({
          organizationId,
          moduleId: definition.moduleId,
          artifactType: "affectedness_result",
        })
        .returning();
      artifact = createdArtifact;
    }

    const latestArtifactRevision =
      await tx.query.generatedArtifactRevisions.findFirst({
        where: eq(generatedArtifactRevisions.artifactId, artifact.id),
        orderBy: (revision, { desc: orderDesc }) => [
          orderDesc(revision.revisionNumber),
        ],
      });

    if (artifact.currentRevisionId) {
      await tx
        .update(generatedArtifactRevisions)
        .set({ status: "superseded" })
        .where(eq(generatedArtifactRevisions.id, artifact.currentRevisionId));
    }

    const result = {
      ...evaluation,
      assessmentRevisionId: assessmentRevision.id,
      assessmentRevisionNumber: assessmentRevision.revisionNumber,
      generatedAt: now.toISOString(),
    };
    const [artifactRevision] = await tx
      .insert(generatedArtifactRevisions)
      .values({
        artifactId: artifact.id,
        revisionNumber: (latestArtifactRevision?.revisionNumber ?? 0) + 1,
        parentRevisionId: artifact.currentRevisionId,
        status: "generated",
        result,
        ruleSetId: ruleSet.id,
        inputHash: hashRuleInput({
          answers: answerContext,
          facts,
          questionnaireVersionId: definition.questionnaireVersionId,
          ruleSetId: ruleSet.id,
          ruleSetVersionLabel: ruleSet.versionLabel,
        }),
        generatedBy: "system",
        createdBy: userId,
      })
      .returning();

    await tx.insert(artifactRevisionSources).values({
      artifactRevisionId: artifactRevision.id,
      sourceType: "assessment_revision",
      sourceId: assessmentRevision.id,
    });

    await tx
      .update(generatedArtifacts)
      .set({ currentRevisionId: artifactRevision.id })
      .where(eq(generatedArtifacts.id, artifact.id));

    return {
      artifactRevisionId: artifactRevision.id,
      artifactRevisionNumber: artifactRevision.revisionNumber,
      createdAt: artifactRevision.createdAt.toISOString(),
      ruleSetId: ruleSet.id,
      ruleSetVersionLabel: ruleSet.versionLabel,
      assessmentRevisionId: assessmentRevision.id,
      result,
    };
  });
}

export async function submitApplicabilityCheckForGuest(
  input: SubmitApplicabilityCheckInput,
): Promise<GuestApplicabilitySession & { result: ApplicabilityResultDto }> {
  const prepared = await prepareApplicabilitySubmission(input);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashGuestToken(token);
  const expiresAt = createGuestExpiryDate(prepared.now);
  const storedResult = {
    ...prepared.evaluation,
    generatedAt: prepared.now.toISOString(),
  };
  const inputHash = hashRuleInput({
    answers: prepared.answerContext,
    facts: prepared.facts,
    questionnaireVersionId: prepared.definition.questionnaireVersionId,
    ruleSetId: prepared.ruleSet.id,
    ruleSetVersionLabel: prepared.ruleSet.versionLabel,
  });

  const [guestCheck] = await db
    .insert(guestApplicabilityChecks)
    .values({
      tokenHash,
      moduleId: prepared.definition.moduleId,
      questionnaireId: prepared.definition.questionnaireId,
      questionnaireVersionId: prepared.definition.questionnaireVersionId,
      ruleSetId: prepared.ruleSet.id,
      answers: input.answers,
      facts: prepared.facts,
      result: storedResult,
      inputHash,
      expiresAt,
      submittedAt: prepared.now,
    })
    .returning();

  return {
    id: guestCheck.id,
    token,
    result: toGuestApplicabilityCheckDto(guestCheck).result,
  };
}

export async function getGuestApplicabilityCheck(
  token: string | undefined,
  guestCheckId?: string,
): Promise<GuestApplicabilityCheckDto | null> {
  const guestCheck = await findGuestApplicabilityCheck(token, guestCheckId);

  if (!guestCheck) {
    return null;
  }

  return toGuestApplicabilityCheckDto(guestCheck);
}

export async function deleteGuestApplicabilityCheck(
  token: string | undefined,
  guestCheckId?: string,
): Promise<void> {
  const guestCheck = await findGuestApplicabilityCheck(token, guestCheckId);

  if (!guestCheck) {
    return;
  }

  await db
    .update(guestApplicabilityChecks)
    .set({
      status: "deleted",
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(guestApplicabilityChecks.id, guestCheck.id));
}

export async function claimGuestApplicabilityCheckForUser(
  userId: string,
  token: string | undefined,
  guestCheckId: string | undefined,
  input: ClaimGuestApplicabilityCheckInput,
): Promise<{ organizationId: string; result: ApplicabilityResultDto }> {
  const guestCheck = await findGuestApplicabilityCheck(token, guestCheckId);

  if (!guestCheck) {
    throw new ApiError(404, "Guest applicability check not found");
  }

  await assertCanAccessOrganization(userId, input.organizationId);
  const result = await submitApplicabilityCheckForUser(
    userId,
    input.organizationId,
    { answers: parseGuestAnswers(guestCheck.answers) },
  );

  await db
    .update(guestApplicabilityChecks)
    .set({
      status: "claimed",
      claimedByUserId: userId,
      claimedOrganizationId: input.organizationId,
      claimedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(guestApplicabilityChecks.id, guestCheck.id));

  return {
    organizationId: input.organizationId,
    result,
  };
}

async function getActiveDefinition(
  locale: Locale = "de",
): Promise<ActiveDefinition | null> {
  const rows = await db
    .select({
      moduleId: complianceModules.id,
      questionnaireId: questionnaires.id,
      questionnaireCode: questionnaires.code,
      questionnaireTitle: questionnaires.title,
      questionnaireVersionId: questionnaireVersions.id,
      versionLabel: questionnaireVersions.versionLabel,
      questionId: questions.id,
      questionStableKey: questions.stableKey,
      questionPosition: questions.position,
      questionText: questions.questionText,
      questionHelpText: questions.helpText,
      translatedQuestionText: questionTranslations.questionText,
      translatedQuestionHelpText: questionTranslations.helpText,
      questionAnswerType: questions.answerType,
      questionRequired: questions.required,
      questionConfig: questions.config,
      optionId: questionOptions.id,
      optionStableValue: questionOptions.stableValue,
      optionLabel: questionOptions.label,
      translatedOptionLabel: questionOptionTranslations.label,
      optionPosition: questionOptions.position,
      optionMetadata: questionOptions.metadata,
      factKey: questionFactMappings.factKey,
      factTransform: questionFactMappings.transform,
    })
    .from(questionnaires)
    .innerJoin(
      complianceModules,
      eq(questionnaires.moduleId, complianceModules.id),
    )
    .innerJoin(
      complianceFrameworkVersions,
      eq(complianceModules.frameworkVersionId, complianceFrameworkVersions.id),
    )
    .innerJoin(
      complianceFrameworks,
      eq(complianceFrameworkVersions.frameworkId, complianceFrameworks.id),
    )
    .innerJoin(
      questionnaireVersions,
      eq(questionnaireVersions.questionnaireId, questionnaires.id),
    )
    .innerJoin(
      questions,
      eq(questions.questionnaireVersionId, questionnaireVersions.id),
    )
    .leftJoin(
      questionTranslations,
      and(
        eq(questionTranslations.questionId, questions.id),
        eq(questionTranslations.locale, locale),
      ),
    )
    .leftJoin(questionOptions, eq(questionOptions.questionId, questions.id))
    .leftJoin(
      questionOptionTranslations,
      and(
        eq(questionOptionTranslations.questionOptionId, questionOptions.id),
        eq(questionOptionTranslations.locale, locale),
      ),
    )
    .leftJoin(questionFactMappings, eq(questionFactMappings.questionId, questions.id))
    .where(
      and(
        eq(complianceFrameworks.code, ACTIVE_FRAMEWORK_CODE),
        eq(
          complianceFrameworkVersions.versionLabel,
          ACTIVE_FRAMEWORK_VERSION_LABEL,
        ),
        eq(complianceFrameworkVersions.status, "published"),
        eq(complianceModules.code, ACTIVE_MODULE_CODE),
        eq(questionnaires.code, ACTIVE_QUESTIONNAIRE_CODE),
        eq(questionnaireVersions.versionLabel, ACTIVE_FRAMEWORK_VERSION_LABEL),
        eq(questionnaireVersions.status, "published"),
      ),
    )
    .orderBy(asc(questions.position), asc(questionOptions.position));

  if (rows.length === 0) {
    return null;
  }

  const firstRow = rows[0];
  const questionMap = new Map<
    string,
    ActiveDefinition["questions"][number]
  >();

  for (const row of rows) {
    let question = questionMap.get(row.questionId);

    if (!question) {
      question = {
        id: row.questionId,
        stableKey: row.questionStableKey,
        position: row.questionPosition,
        questionText: row.translatedQuestionText ?? row.questionText,
        helpText: row.translatedQuestionHelpText ?? row.questionHelpText,
        answerType: row.questionAnswerType,
        required: row.questionRequired,
        config: row.questionConfig,
        options: [],
        factMappings: [],
      };
      questionMap.set(row.questionId, question);
    }

    if (
      row.optionId &&
      !question.options.some((option) => option.id === row.optionId)
    ) {
      question.options.push({
        id: row.optionId,
        stableValue: row.optionStableValue ?? "",
        label: row.translatedOptionLabel ?? row.optionLabel ?? "",
        position: row.optionPosition ?? 0,
        metadata: row.optionMetadata,
      });
    }

    if (
      row.factKey &&
      !question.factMappings.some((mapping) => mapping.factKey === row.factKey)
    ) {
      question.factMappings.push({
        factKey: row.factKey,
        transform: row.factTransform,
      });
    }
  }

  return {
    moduleId: firstRow.moduleId,
    questionnaireId: firstRow.questionnaireId,
    questionnaireVersionId: firstRow.questionnaireVersionId,
    questionnaireTitle: firstRow.questionnaireTitle,
    questionnaireCode: firstRow.questionnaireCode,
    versionLabel: firstRow.versionLabel,
    questions: Array.from(questionMap.values()),
  };
}

async function getActiveRuleSet(moduleId: string) {
  return db.query.ruleSets.findFirst({
    where: and(
      eq(ruleSets.moduleId, moduleId),
      eq(ruleSets.code, ACTIVE_RULE_SET_CODE),
      eq(ruleSets.versionLabel, ACTIVE_FRAMEWORK_VERSION_LABEL),
      eq(ruleSets.status, "published"),
    ),
  });
}

async function prepareApplicabilitySubmission(
  input: SubmitApplicabilityCheckInput,
): Promise<PreparedApplicabilitySubmission> {
  const definition = await getActiveDefinition();

  if (!definition) {
    throw new ApiError(404, "Betroffenheitscheck questionnaire is not seeded");
  }

  const ruleSet = await getActiveRuleSet(definition.moduleId);

  if (!ruleSet) {
    throw new ApiError(404, "Betroffenheitscheck rule set is not seeded");
  }

  const validatedAnswers = validateAnswers(definition, input);
  const facts = deriveFacts(definition, validatedAnswers);
  const answerContext = Object.fromEntries(
    validatedAnswers.map((answer) => [
      answer.questionStableKey,
      answer.answerValue,
    ]),
  );
  const evaluation = evaluateRuleSet(ruleSet.rules, {
    facts,
    answers: answerContext,
  });

  return {
    definition,
    ruleSet,
    validatedAnswers,
    facts,
    answerContext,
    evaluation,
    now: new Date(),
  };
}

async function findGuestApplicabilityCheck(
  token: string | undefined,
  guestCheckId?: string,
) {
  if (!token) {
    return null;
  }

  const guestCheck = await db.query.guestApplicabilityChecks.findFirst({
    where: guestCheckId
      ? and(
          eq(guestApplicabilityChecks.id, guestCheckId),
          eq(guestApplicabilityChecks.tokenHash, hashGuestToken(token)),
        )
      : eq(guestApplicabilityChecks.tokenHash, hashGuestToken(token)),
  });

  if (!guestCheck) {
    return null;
  }

  if (guestCheck.status !== "submitted" || guestCheck.expiresAt <= new Date()) {
    if (guestCheck.status === "submitted") {
      await db
        .update(guestApplicabilityChecks)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(guestApplicabilityChecks.id, guestCheck.id));
    }

    return null;
  }

  return guestCheck;
}

function toGuestApplicabilityCheckDto(
  guestCheck: typeof guestApplicabilityChecks.$inferSelect,
): GuestApplicabilityCheckDto {
  const result = parseStoredRuleEvaluationResult(guestCheck.result);

  return {
    id: guestCheck.id,
    submittedAt: guestCheck.submittedAt.toISOString(),
    expiresAt: guestCheck.expiresAt.toISOString(),
    result: {
      artifactRevisionId: guestCheck.id,
      artifactRevisionNumber: 1,
      createdAt: guestCheck.submittedAt.toISOString(),
      ruleSetId: guestCheck.ruleSetId,
      ruleSetVersionLabel: null,
      assessmentRevisionId: null,
      result,
    },
  };
}

function parseGuestAnswers(value: unknown): SubmitApplicabilityCheckInput["answers"] {
  const parsed = submitApplicabilityCheckSchema.shape.answers.safeParse(value);

  if (!parsed.success) {
    throw new ApiError(409, "Stored guest answers are no longer valid");
  }

  return parsed.data;
}

function createGuestExpiryDate(from: Date): Date {
  const expiresAt = new Date(from);
  expiresAt.setDate(expiresAt.getDate() + GUEST_CHECK_TTL_DAYS);
  return expiresAt;
}

export function hashGuestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function getCurrentAssessment(organizationId: string, moduleId: string) {
  return db.query.assessments.findFirst({
    where: and(
      eq(assessments.organizationId, organizationId),
      eq(assessments.moduleId, moduleId),
      eq(assessments.status, "active"),
    ),
  });
}

async function getLatestAnswerMap(organizationId: string, moduleId: string) {
  const assessment = await getCurrentAssessment(organizationId, moduleId);

  if (!assessment?.currentRevisionId) {
    return {};
  }

  const rows = await db.query.assessmentAnswers.findMany({
    where: eq(assessmentAnswers.assessmentRevisionId, assessment.currentRevisionId),
  });

  return Object.fromEntries(
    rows.map((answer) => [answer.questionId, String(answer.answerValue)]),
  );
}

async function getCurrentResult(
  organizationId: string,
  moduleId: string,
): Promise<ApplicabilityResultDto | null> {
  const row = await db
    .select({
      artifactRevisionId: generatedArtifactRevisions.id,
      artifactRevisionNumber: generatedArtifactRevisions.revisionNumber,
      createdAt: generatedArtifactRevisions.createdAt,
      ruleSetId: generatedArtifactRevisions.ruleSetId,
      ruleSetVersionLabel: ruleSets.versionLabel,
      result: generatedArtifactRevisions.result,
    })
    .from(generatedArtifacts)
    .innerJoin(
      generatedArtifactRevisions,
      eq(generatedArtifacts.currentRevisionId, generatedArtifactRevisions.id),
    )
    .leftJoin(ruleSets, eq(generatedArtifactRevisions.ruleSetId, ruleSets.id))
    .where(
      and(
        eq(generatedArtifacts.organizationId, organizationId),
        eq(generatedArtifacts.moduleId, moduleId),
        eq(generatedArtifacts.artifactType, "affectedness_result"),
      ),
    )
    .limit(1);

  const resultRow = row[0];

  if (!resultRow) {
    return null;
  }

  const result = parseStoredRuleEvaluationResult(resultRow.result);

  return {
    artifactRevisionId: resultRow.artifactRevisionId,
    artifactRevisionNumber: resultRow.artifactRevisionNumber,
    createdAt: resultRow.createdAt.toISOString(),
    ruleSetId: resultRow.ruleSetId,
    ruleSetVersionLabel: resultRow.ruleSetVersionLabel,
    assessmentRevisionId: result.assessmentRevisionId ?? null,
    result,
  };
}

function validateAnswers(
  definition: ActiveDefinition,
  input: SubmitApplicabilityCheckInput,
): ValidatedAnswer[] {
  const questionById = new Map(
    definition.questions.map((question) => [question.id, question]),
  );
  const answerByQuestionId = new Map<string, string>();

  for (const answer of input.answers) {
    if (answerByQuestionId.has(answer.questionId)) {
      throw new ApiError(400, "Each question can only be answered once");
    }

    answerByQuestionId.set(answer.questionId, answer.value);
  }

  for (const question of definition.questions) {
    const answerValue = answerByQuestionId.get(question.id);

    if (question.required && !answerValue) {
      throw new ApiError(400, "All required questions must be answered");
    }
  }

  return Array.from(answerByQuestionId.entries()).map(
    ([questionId, answerValue]) => {
      const question = questionById.get(questionId);

      if (!question) {
        throw new ApiError(400, "Unknown questionId");
      }

      const option = question.options.find(
        (candidate) => candidate.stableValue === answerValue,
      );

      if (!option) {
        throw new ApiError(400, "Invalid answer value");
      }

      return {
        questionId,
        questionStableKey: question.stableKey,
        answerValue,
        answerLabel: option.label,
      };
    },
  );
}

function deriveFacts(
  definition: ActiveDefinition,
  validatedAnswers: ValidatedAnswer[],
) {
  const answerByQuestionId = new Map(
    validatedAnswers.map((answer) => [answer.questionId, answer]),
  );
  const facts: Record<string, unknown> = {};

  for (const question of definition.questions) {
    const answer = answerByQuestionId.get(question.id);

    if (!answer) {
      continue;
    }

    for (const mapping of question.factMappings) {
      facts[mapping.factKey] = answer.answerValue;
    }
  }

  return facts;
}

function hashRuleInput(input: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(sortJson(input)))
    .digest("hex");
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortJson(child)]),
    );
  }

  return value;
}
