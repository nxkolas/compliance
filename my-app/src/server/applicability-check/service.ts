import { db } from "@/src/db";
import {
  artifactRevisionSources,
  assessmentAnswerOptions,
  assessmentAnswers,
  assessmentRevisions,
  assessments,
  complianceCheckReleaseProfiles,
  complianceCheckReleaseContentRevisions,
  complianceCheckReleases,
  contentItems,
  contentRevisions,
  contentTranslations,
  factOptions,
  generatedArtifactRevisions,
  generatedArtifacts,
  guestApplicabilityChecks,
  nis2ResultProjections,
  organizationFactValueOptions,
  organizationFactValues,
  questionOptions,
  questions,
  ruleSets,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { ApiError } from "../api/errors";
import { assertCanAccessOrganization } from "../organizations/service";
import {
  loadActiveComplianceRelease,
  loadComplianceRelease,
  NIS2_CHECK_CODE,
  type LoadedComplianceRelease,
} from "../compliance/release-service";
import {
  parseStoredRuleEvaluationResult,
  type StoredRuleEvaluationResult,
} from "./rule-evaluation-schema";
import {
  getVisibleQuestions,
  isAnswered,
  type ApplicabilityAnswerValue,
} from "./question-visibility";
import { evaluateRuleSet } from "./rules";
import { parseRuleSetDocument } from "./rule-set-schema";
import { catalogOptionsForCountry } from "./entity-catalog";
import { guestStartedExpiry, guestSubmittedExpiry } from "./guest-lifecycle";
import {
  submitApplicabilityCheckSchema,
  type SubmitApplicabilityCheckInput,
} from "./validation";


export type ApplicabilityQuestionnaireDto = {
  id: string;
  moduleId: string;
  questionnaireVersionId: string;
  title: string;
  code: string;
  versionLabel: string;
  questions: ApplicabilityQuestionDto[];
  entityCatalogs: Record<string, ApplicabilityOptionDto[]>;
  latestAnswers: Record<string, ApplicabilityAnswerValue>;
  release: {
    id: string;
    versionLabel: string;
    aggregateHash: string;
    isActive: boolean;
    activeVersionLabel: string;
  };
  guestSession?: GuestApplicabilitySession;
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
  catalogCode: string;
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
  evidence: StoredRuleEvaluationResult;
  result: LocalizedRuleEvaluationResult;
  release: {
    id: string;
    versionLabel: string;
    isOutdated: boolean;
    activeVersionLabel: string;
  };
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
  checkReleaseId: string;
  aggregateHash: string;
  isActive: boolean;
  activeReleaseVersionLabel: string;
  moduleId: string;
  questionnaireId: string;
  questionnaireVersionId: string;
  questionnaireTitle: string;
  questionnaireCode: string;
  versionLabel: string;
  ruleSet: typeof ruleSets.$inferSelect;
  questions: Array<
    ApplicabilityQuestionDto & {
      factMappings: Array<{ factKey: string; transform: unknown }>;
    }
  >;
};

type ValidatedAnswer = {
  questionId: string;
  questionStableKey: string;
  answerValue: ApplicabilityAnswerValue;
  answerLabel: string;
  optionIds: string[];
};

export type LocalizedRuleEvaluationResult = {
  outcome: StoredRuleEvaluationResult["outcome"];
  label: string;
  labelEn: string;
  reasons: string[];
  reasonsEn: string[];
  sizeClassification: StoredRuleEvaluationResult["sizeClassification"];
  jurisdiction: {
    countryCode: string | null;
    countryProfileVersion: string | null;
  };
  matchedEntityTypes: Array<{
    code: string;
    label: string;
    labelEn: string;
    legalReference: string;
  }>;
  scopeBases: Array<{ code: string; description: string; descriptionEn: string; legalReference: string | null }>;
  unresolvedFacts: string[];
  unresolvedFactsEn: string[];
  obligationOverlays: Array<{ code: string; description: string; descriptionEn: string; legalReference: string | null }>;
  indirectExposure: { status: StoredRuleEvaluationResult["indirectExposure"]["status"]; reasons: string[]; reasonsEn: string[] };
  disclaimer: string;
  disclaimerEn: string;
};

type PreparedApplicabilitySubmission = {
  definition: ActiveDefinition;
  ruleSet: typeof ruleSets.$inferSelect;
  validatedAnswers: ValidatedAnswer[];
  facts: Record<string, unknown>;
  answerContext: Record<string, ApplicabilityAnswerValue>;
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
    entityCatalogs: getEntityCatalogs(definition.questions),
    latestAnswers,
    release: toQuestionnaireRelease(definition),
  };
}

export async function getApplicabilityQuestionnaireForGuest(
  locale: Locale,
): Promise<ApplicabilityQuestionnaireDto | null> {
  const definition = await getActiveDefinition(locale);

  if (!definition) {
    return null;
  }

  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const [guestCheck] = await db.insert(guestApplicabilityChecks).values({
    tokenHash: hashGuestToken(token),
    checkReleaseId: definition.checkReleaseId,
    status: "started",
    expiresAt: createGuestStartedExpiryDate(now),
    startedAt: now,
  }).returning();

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
    entityCatalogs: getEntityCatalogs(definition.questions),
    latestAnswers: {},
    release: toQuestionnaireRelease(definition),
    guestSession: { id: guestCheck.id, token },
  };
}

export async function getApplicabilityOverviewForUser(
  userId: string,
  organizationId: string,
): Promise<ApplicabilityOverviewDto | null> {
  await assertCanAccessOrganization(userId, organizationId);
  const assessment = await getLatestAssessment(organizationId);

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
    result: await getCurrentResult(organizationId),
  };
}

export async function getApplicabilityAnswersForUser(
  userId: string,
  organizationId: string,
  locale: Locale,
): Promise<ApplicabilityAnswersDto | null> {
  await assertCanAccessOrganization(userId, organizationId);
  const assessment = await getLatestAssessment(organizationId);

  if (!assessment?.currentRevisionId) {
    return null;
  }
  const pinnedRelease = await loadComplianceRelease(assessment.checkReleaseId, locale);
  const definition = pinnedRelease ? toActiveDefinition(pinnedRelease) : null;
  if (!definition) return null;

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
      questionConfig: questions.config,
      questionPosition: questions.position,
      answerId: assessmentAnswers.id,
    })
    .from(assessmentAnswers)
    .innerJoin(questions, eq(assessmentAnswers.questionId, questions.id))
    .where(eq(assessmentAnswers.assessmentRevisionId, revision.id))
    .orderBy(asc(questions.position));
  const answerOptionRows = rows.length > 0
    ? await db.select({ answerId: assessmentAnswerOptions.assessmentAnswerId, stableValue: questionOptions.stableValue })
        .from(assessmentAnswerOptions)
        .innerJoin(questionOptions, eq(assessmentAnswerOptions.questionOptionId, questionOptions.id))
        .where(inArray(assessmentAnswerOptions.assessmentAnswerId, rows.map((row) => row.answerId)))
    : [];

  return {
    assessmentId: assessment.id,
    assessmentRevisionId: revision.id,
    assessmentRevisionNumber: revision.revisionNumber,
    submittedAt: revision.submittedAt?.toISOString() ?? null,
    answers: rows.map((row) => {
      const question = definition.questions.find(
        (candidate) => candidate.id === row.questionId,
      );
      const selectedValues = answerOptionRows.filter((option) => option.answerId === row.answerId).map((option) => option.stableValue);
      const answerValue: ApplicabilityAnswerValue = question?.answerType === "multi_choice" ? selectedValues : selectedValues[0] ?? "";
      const translatedAnswerLabel = getTranslatedAnswerLabel(
        question?.options ?? [],
        answerValue,
      );

      return {
        ...row,
        questionText: question?.questionText ?? row.questionStableKey,
        answerValue,
        answerLabel: translatedAnswerLabel,
        answerMetadata: getAnswerMetadata(
          question?.options ?? [],
          answerValue,
        ),
      };
    }),
  };
}

export async function getApplicabilityResultForUser(
  userId: string,
  organizationId: string,
): Promise<ApplicabilityResultDto | null> {
  await assertCanAccessOrganization(userId, organizationId);
  return getCurrentResult(organizationId);
}

export async function submitApplicabilityCheckForUser(
  userId: string,
  organizationId: string,
  input: SubmitApplicabilityCheckInput,
  options?: { checkReleaseId?: string; claimGuestCheckId?: string },
): Promise<ApplicabilityResultDto> {
  await assertCanAccessOrganization(userId, organizationId);
  const prepared = await prepareApplicabilitySubmission(input, options?.checkReleaseId);
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
        eq(assessments.checkReleaseId, definition.checkReleaseId),
        eq(assessments.status, "active"),
      ),
    });

    if (!assessment) {
      const previousActive = await tx.select({ id: assessments.id })
        .from(assessments)
        .innerJoin(complianceCheckReleases, eq(assessments.checkReleaseId, complianceCheckReleases.id))
        .where(and(
          eq(assessments.organizationId, organizationId),
          eq(assessments.status, "active"),
          eq(complianceCheckReleases.checkCode, NIS2_CHECK_CODE),
        ));
      if (previousActive.length > 0) {
        await tx.update(assessments).set({ status: "archived" }).where(inArray(assessments.id, previousActive.map((item) => item.id)));
      }
      const [createdAssessment] = await tx
        .insert(assessments)
        .values({
          organizationId,
          moduleId: definition.moduleId,
          questionnaireId: definition.questionnaireId,
          checkReleaseId: definition.checkReleaseId,
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

    for (const answer of validatedAnswers) {
      const [answerHeader] = await tx.insert(assessmentAnswers).values({
        assessmentRevisionId: assessmentRevision.id,
        questionId: answer.questionId,
        questionStableKey: answer.questionStableKey,
      }).returning();
      await tx.insert(assessmentAnswerOptions).values(
        answer.optionIds.map((questionOptionId) => ({ assessmentAnswerId: answerHeader.id, questionOptionId })),
      );
    }

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

      const [factValue] = await tx.insert(organizationFactValues).values({
        organizationId,
        factKey,
        sourceType: "assessment_revision",
        sourceRevisionId: assessmentRevision.id,
        confidence: "1.0000",
        isCurrent: true,
      }).returning();
      const stableValues = Array.isArray(value) ? value : [value];
      const selectedFactOptions = await tx.query.factOptions.findMany({
        where: and(
          eq(factOptions.factDefinitionKey, factKey),
          inArray(factOptions.stableValue, stableValues.filter((item): item is string => typeof item === "string")),
        ),
      });
      if (selectedFactOptions.length !== stableValues.length) throw new ApiError(409, `Fact option mapping is incomplete for ${factKey}`);
      await tx.insert(organizationFactValueOptions).values(
        selectedFactOptions.map((option) => ({ organizationFactValueId: factValue.id, factOptionId: option.id })),
      );
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

    const inputHash = hashRuleInput({
      answers: answerContext,
      facts,
      checkReleaseId: definition.checkReleaseId,
      ruleSetId: ruleSet.id,
    });
    const result: StoredRuleEvaluationResult = {
      ...evaluation,
      checkReleaseId: definition.checkReleaseId,
      ruleSetId: ruleSet.id,
      inputHash,
      evaluatedAt: now.toISOString(),
      assessmentRevisionId: assessmentRevision.id,
      assessmentRevisionNumber: assessmentRevision.revisionNumber,
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
        checkReleaseId: definition.checkReleaseId,
        evaluatorKind: definition.ruleSet.evaluatorKind,
        outcomeCode: evaluation.outcome,
        evaluatedAt: now,
        inputHash,
        generatedBy: "system",
        createdBy: userId,
      })
      .returning();

    const profileVersion = evaluation.jurisdiction.countryCode
      ? await tx.query.complianceCheckReleaseProfiles.findFirst({
          where: and(
            eq(complianceCheckReleaseProfiles.checkReleaseId, definition.checkReleaseId),
            eq(complianceCheckReleaseProfiles.countryCode, evaluation.jurisdiction.countryCode),
          ),
        })
      : null;
    await tx.insert(nis2ResultProjections).values({
      artifactRevisionId: artifactRevision.id,
      countryCode: evaluation.jurisdiction.countryCode,
      sizeClassification: evaluation.sizeClassification,
      jurisdictionProfileVersionId: profileVersion?.jurisdictionProfileVersionId,
    });

    await tx.insert(artifactRevisionSources).values({
      artifactRevisionId: artifactRevision.id,
      sourceType: "assessment_revision",
      sourceId: assessmentRevision.id,
    });

    await tx
      .update(generatedArtifacts)
      .set({ currentRevisionId: artifactRevision.id })
      .where(eq(generatedArtifacts.id, artifact.id));

    const localizedResult = await localizeEvaluation(result);

    if (options?.claimGuestCheckId) {
      await tx.update(guestApplicabilityChecks).set({
        status: "claimed",
        claimedByUserId: userId,
        claimedOrganizationId: organizationId,
        claimedAt: now,
        updatedAt: now,
      }).where(and(
        eq(guestApplicabilityChecks.id, options.claimGuestCheckId),
        eq(guestApplicabilityChecks.status, "submitted"),
      ));
    }

    return {
      artifactRevisionId: artifactRevision.id,
      artifactRevisionNumber: artifactRevision.revisionNumber,
      createdAt: artifactRevision.createdAt.toISOString(),
      ruleSetId: ruleSet.id,
      ruleSetVersionLabel: ruleSet.versionLabel,
      assessmentRevisionId: assessmentRevision.id,
      evidence: result,
      result: localizedResult,
      release: {
        id: definition.checkReleaseId,
        versionLabel: definition.versionLabel,
        isOutdated: !definition.isActive,
        activeVersionLabel: definition.activeReleaseVersionLabel,
      },
    };
  });
}

export async function submitApplicabilityCheckForGuest(
  input: SubmitApplicabilityCheckInput,
): Promise<GuestApplicabilitySession & { result: ApplicabilityResultDto }> {
  if (!input.guestSession) throw new ApiError(400, "Guest session is required");
  const guestCheck = await db.query.guestApplicabilityChecks.findFirst({
    where: and(
      eq(guestApplicabilityChecks.id, input.guestSession.id),
      eq(guestApplicabilityChecks.tokenHash, hashGuestToken(input.guestSession.token)),
    ),
  });
  if (!guestCheck || guestCheck.status !== "started" || guestCheck.expiresAt <= new Date()) {
    throw new ApiError(409, "Guest session is invalid or expired");
  }
  const prepared = await prepareApplicabilitySubmission(input, guestCheck.checkReleaseId);
  const expiresAt = createGuestExpiryDate(prepared.now);
  const inputHash = hashRuleInput({
    answers: prepared.answerContext,
    facts: prepared.facts,
    questionnaireVersionId: prepared.definition.questionnaireVersionId,
    ruleSetId: prepared.ruleSet.id,
    ruleSetVersionLabel: prepared.ruleSet.versionLabel,
  });
  const storedResult: StoredRuleEvaluationResult = {
    ...prepared.evaluation,
    checkReleaseId: prepared.definition.checkReleaseId,
    ruleSetId: prepared.ruleSet.id,
    inputHash,
    evaluatedAt: prepared.now.toISOString(),
  };

  const [submittedCheck] = await db
    .update(guestApplicabilityChecks)
    .set({
      status: "submitted",
      answers: input.answers,
      facts: prepared.facts,
      result: storedResult,
      inputHash,
      expiresAt,
      claimExpiresAt: expiresAt,
      submittedAt: prepared.now,
      updatedAt: prepared.now,
    })
    .where(eq(guestApplicabilityChecks.id, guestCheck.id))
    .returning();

  return {
    id: submittedCheck.id,
    token: input.guestSession.token,
    result: (await toGuestApplicabilityCheckDto(submittedCheck)).result,
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
    { checkReleaseId: guestCheck.checkReleaseId, claimGuestCheckId: guestCheck.id },
  );

  return {
    organizationId: input.organizationId,
    result,
  };
}

async function getActiveDefinition(
  locale: Locale = "de",
): Promise<ActiveDefinition | null> {
  const release = await loadActiveComplianceRelease(locale);
  return release ? toActiveDefinition(release) : null;
}

async function prepareApplicabilitySubmission(
  input: SubmitApplicabilityCheckInput,
  checkReleaseId?: string,
): Promise<PreparedApplicabilitySubmission> {
  const loadedRelease = checkReleaseId
    ? await loadComplianceRelease(checkReleaseId)
    : await loadActiveComplianceRelease();
  const definition = loadedRelease ? toActiveDefinition(loadedRelease) : null;

  if (!definition) {
    throw new ApiError(404, "Betroffenheitscheck questionnaire is not seeded");
  }

  const ruleSet = definition.ruleSet;

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

async function toGuestApplicabilityCheckDto(
  guestCheck: typeof guestApplicabilityChecks.$inferSelect,
): Promise<GuestApplicabilityCheckDto> {
  if (!guestCheck.result || !guestCheck.submittedAt) {
    throw new ApiError(409, "Guest applicability check has not been submitted");
  }
  const result = parseStoredRuleEvaluationResult(guestCheck.result);
  const release = await loadComplianceRelease(guestCheck.checkReleaseId);
  if (!release) throw new ApiError(409, "Pinned compliance release is unavailable");

  return {
    id: guestCheck.id,
    submittedAt: guestCheck.submittedAt.toISOString(),
    expiresAt: guestCheck.expiresAt.toISOString(),
    result: {
      artifactRevisionId: guestCheck.id,
      artifactRevisionNumber: 1,
      createdAt: guestCheck.submittedAt.toISOString(),
      ruleSetId: release.ruleSet.id,
      ruleSetVersionLabel: release.releaseVersionLabel,
      assessmentRevisionId: null,
      evidence: result,
      result: await localizeEvaluation(result),
      release: {
        id: release.checkReleaseId,
        versionLabel: release.releaseVersionLabel,
        isOutdated: !release.isActive,
        activeVersionLabel: release.activeReleaseVersionLabel,
      },
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
  return guestSubmittedExpiry(from);
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

  const rows = await db.select({
    answerId: assessmentAnswers.id,
    questionId: assessmentAnswers.questionId,
    answerType: questions.answerType,
  }).from(assessmentAnswers)
    .innerJoin(questions, eq(assessmentAnswers.questionId, questions.id))
    .where(eq(assessmentAnswers.assessmentRevisionId, assessment.currentRevisionId));
  if (rows.length === 0) return {};
  const optionRows = await db.select({
    answerId: assessmentAnswerOptions.assessmentAnswerId,
    stableValue: questionOptions.stableValue,
  }).from(assessmentAnswerOptions)
    .innerJoin(questionOptions, eq(assessmentAnswerOptions.questionOptionId, questionOptions.id))
    .where(inArray(assessmentAnswerOptions.assessmentAnswerId, rows.map((row) => row.answerId)));
  return Object.fromEntries(rows.flatMap((answer) => {
    const values = optionRows.filter((option) => option.answerId === answer.answerId).map((option) => option.stableValue);
    const value: ApplicabilityAnswerValue | undefined = answer.answerType === "multi_choice" ? values : values[0];
    return isApplicabilityAnswerValue(value) ? [[answer.questionId, value] as const] : [];
  }));
}

async function getLatestAssessment(organizationId: string) {
  const rows = await db.select({ assessment: assessments })
    .from(assessments)
    .innerJoin(complianceCheckReleases, eq(assessments.checkReleaseId, complianceCheckReleases.id))
    .where(and(
      eq(assessments.organizationId, organizationId),
      eq(complianceCheckReleases.checkCode, NIS2_CHECK_CODE),
    ))
    .orderBy(desc(assessments.createdAt))
    .limit(1);
  return rows[0]?.assessment ?? null;
}

function createGuestStartedExpiryDate(from: Date): Date {
  return guestStartedExpiry(from);
}

async function getCurrentResult(
  organizationId: string,
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
    .innerJoin(complianceCheckReleases, eq(generatedArtifactRevisions.checkReleaseId, complianceCheckReleases.id))
    .where(
      and(
        eq(generatedArtifacts.organizationId, organizationId),
        eq(generatedArtifacts.artifactType, "affectedness_result"),
        eq(complianceCheckReleases.checkCode, NIS2_CHECK_CODE),
      ),
    )
    .orderBy(desc(generatedArtifactRevisions.evaluatedAt))
    .limit(1);

  const resultRow = row[0];

  if (!resultRow) {
    return null;
  }

  const result = parseStoredRuleEvaluationResult(resultRow.result);
  const release = await loadComplianceRelease(result.checkReleaseId);
  if (!release) throw new ApiError(409, "Pinned compliance release is unavailable");

  return {
    artifactRevisionId: resultRow.artifactRevisionId,
    artifactRevisionNumber: resultRow.artifactRevisionNumber,
    createdAt: resultRow.createdAt.toISOString(),
    ruleSetId: resultRow.ruleSetId,
    ruleSetVersionLabel: resultRow.ruleSetVersionLabel,
    assessmentRevisionId: result.assessmentRevisionId ?? null,
    evidence: result,
    result: await localizeEvaluation(result),
    release: {
      id: release.checkReleaseId,
      versionLabel: release.releaseVersionLabel,
      isOutdated: !release.isActive,
      activeVersionLabel: release.activeReleaseVersionLabel,
    },
  };
}

function validateAnswers(
  definition: ActiveDefinition,
  input: SubmitApplicabilityCheckInput,
): ValidatedAnswer[] {
  const questionById = new Map(
    definition.questions.map((question) => [question.id, question]),
  );
  const answerByQuestionId = new Map<string, ApplicabilityAnswerValue>();

  for (const answer of input.answers) {
    if (!questionById.has(answer.questionId)) {
      throw new ApiError(400, "Unknown questionId");
    }

    if (answerByQuestionId.has(answer.questionId)) {
      throw new ApiError(400, "Each question can only be answered once");
    }

    answerByQuestionId.set(answer.questionId, answer.value);
  }

  const answersRecord = Object.fromEntries(answerByQuestionId);
  const countryQuestion = definition.questions.find((question) =>
    question.factMappings.some(
      (mapping) => mapping.factKey === "jurisdiction_country",
    ),
  );
  const countryAnswer = countryQuestion
    ? answerByQuestionId.get(countryQuestion.id)
    : undefined;
  const countryCode = typeof countryAnswer === "string" ? countryAnswer : null;
  const visibleQuestions = getVisibleQuestions(
    definition.questions,
    answersRecord,
  );

  for (const question of visibleQuestions) {
    const answerValue = answerByQuestionId.get(question.id);

    if (question.required && !isAnswered(answerValue)) {
      throw new ApiError(400, "All required questions must be answered");
    }
  }

  return visibleQuestions.flatMap<ValidatedAnswer>((question) => {
    const answerValue = answerByQuestionId.get(question.id);
    if (!isAnswered(answerValue)) {
      return [];
    }

    if (question.answerType === "multi_choice") {
      if (!Array.isArray(answerValue)) {
        throw new ApiError(400, "Multi-choice answers must be arrays");
      }

      const uniqueValues = [...new Set(answerValue)];
      if (uniqueValues.length !== answerValue.length) {
        throw new ApiError(400, "Multi-choice answers cannot contain duplicates");
      }

      const exclusiveValues = uniqueValues.filter((value) =>
        ["none_of_these", "unsure"].includes(value),
      );
      if (exclusiveValues.length > 0 && uniqueValues.length > 1) {
        throw new ApiError(400, "Exclusive answers cannot be combined");
      }

      const allowedOptions = catalogOptionsForCountry(
        question.options,
        countryCode,
      );
      const selectedOptions = uniqueValues.map((value) => {
        const option = allowedOptions.find(
          (candidate) => candidate.stableValue === value,
        );
        if (!option) {
          throw new ApiError(400, "Invalid answer value");
        }
        return option;
      });

      return [
        {
          questionId: question.id,
          questionStableKey: question.stableKey,
          answerValue: uniqueValues,
          answerLabel: selectedOptions.map((option) => option.label).join(", "),
          optionIds: selectedOptions.map((option) => option.id),
        },
      ];
    }

    if (Array.isArray(answerValue)) {
      throw new ApiError(400, "Single-choice answers must be strings");
    }

    const option = catalogOptionsForCountry(
      question.options,
      countryCode,
    ).find(
      (candidate) => candidate.stableValue === answerValue,
    );
    if (!option) {
      throw new ApiError(400, "Invalid answer value");
    }

    return [
      {
        questionId: question.id,
        questionStableKey: question.stableKey,
        answerValue,
        answerLabel: option.label,
        optionIds: [option.id],
      },
    ];
  });
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

function getTranslatedAnswerLabel(
  options: ApplicabilityOptionDto[],
  value: unknown,
): string | null {
  const values = Array.isArray(value) ? value : [value];
  const labels = values.flatMap((item) => {
    const option = options.find(
      (candidate) => candidate.stableValue === item,
    );
    return option ? [option.label] : [];
  });

  return labels.length > 0 ? labels.join(", ") : null;
}

function getAnswerMetadata(
  options: ApplicabilityOptionDto[],
  value: unknown,
): unknown {
  const values = Array.isArray(value) ? value : [value];
  const metadata = values.flatMap((item) => {
    const option = options.find(
      (candidate) => candidate.stableValue === item,
    );
    return option ? [option.metadata] : [];
  });

  return Array.isArray(value) ? metadata : metadata[0] ?? null;
}

function isApplicabilityAnswerValue(
  value: unknown,
): value is ApplicabilityAnswerValue {
  return (
    (typeof value === "string" && value.length > 0) ||
    (Array.isArray(value) &&
      value.length > 0 &&
      value.every((item) => typeof item === "string" && item.length > 0))
  );
}

function getEntityCatalogs(
  questions: ActiveDefinition["questions"],
): Record<string, ApplicabilityOptionDto[]> {
  const entityQuestion = questions.find((question) =>
    question.factMappings.some(
      (mapping) => mapping.factKey === "nis2_entity_types",
    ),
  );
  if (!entityQuestion) return {};

  const catalogCodes = new Set(
    entityQuestion.options
      .map((option) => option.catalogCode)
      .filter((catalogCode) => catalogCode !== "all"),
  );
  return Object.fromEntries(
    [...catalogCodes].map((catalogCode) => [
      catalogCode,
      entityQuestion.options.filter(
        (option) =>
          option.catalogCode === "all" || option.catalogCode === catalogCode,
      ),
    ]),
  );
}

function toActiveDefinition(release: LoadedComplianceRelease): ActiveDefinition {
  return {
    checkReleaseId: release.checkReleaseId,
    aggregateHash: release.aggregateHash,
    isActive: release.isActive,
    activeReleaseVersionLabel: release.activeReleaseVersionLabel,
    moduleId: release.moduleId,
    questionnaireId: release.questionnaireId,
    questionnaireVersionId: release.questionnaireVersionId,
    questionnaireTitle: release.questionnaireTitle,
    questionnaireCode: release.questionnaireCode,
    versionLabel: release.releaseVersionLabel,
    ruleSet: release.ruleSet,
    questions: release.questions,
  };
}

function toQuestionnaireRelease(definition: ActiveDefinition) {
  return {
    id: definition.checkReleaseId,
    versionLabel: definition.versionLabel,
    aggregateHash: definition.aggregateHash,
    isActive: definition.isActive,
    activeVersionLabel: definition.activeReleaseVersionLabel,
  };
}

async function localizeEvaluation(
  evidence: StoredRuleEvaluationResult,
): Promise<LocalizedRuleEvaluationResult> {
  const release = await loadComplianceRelease(evidence.checkReleaseId, "de");
  const releaseEn = await loadComplianceRelease(evidence.checkReleaseId, "en");
  if (!release || !releaseEn) throw new ApiError(409, "Pinned compliance release is unavailable");
  const artifact = parseRuleSetDocument(release.ruleSet.rules);
  const rows = await db.select({
    stableKey: contentItems.stableKey,
    locale: contentTranslations.locale,
    value: contentTranslations.value,
  }).from(complianceCheckReleaseContentRevisions)
    .innerJoin(contentRevisions, eq(complianceCheckReleaseContentRevisions.contentRevisionId, contentRevisions.id))
    .innerJoin(contentItems, eq(contentRevisions.contentItemId, contentItems.id))
    .innerJoin(contentTranslations, eq(contentTranslations.contentRevisionId, contentRevisions.id))
    .where(eq(complianceCheckReleaseContentRevisions.checkReleaseId, evidence.checkReleaseId));
  const localized = new Map(rows.map((row) => [`${row.stableKey}:${row.locale}`, row.value]));
  const text = (key: string | undefined, locale: "de" | "en") => key ? localized.get(`${key}:${locale}`) ?? localized.get(`${key}:de`) ?? key : "";
  const reason = (code: string, locale: "de" | "en") => text(artifact.reasonContentKeys[code], locale) || code;
  const legalCitation = (key: string, locale: "de" | "en") => {
    const separator = key.indexOf(".");
    if (separator < 1) return key;
    const instrumentCode = key.slice(0, separator);
    const provisionCode = key.slice(separator + 1);
    return text(
      `nis2.legal.${instrumentCode}.${provisionCode}.citation`,
      locale,
    ) || key;
  };
  const entityQuestion = release.questions.find((question) => question.factMappings.some((mapping) => mapping.factKey === "nis2_entity_types"));
  const entityQuestionEn = releaseEn.questions.find((question) => question.factMappings.some((mapping) => mapping.factKey === "nis2_entity_types"));
  const displayEntities =
    evidence.evaluatorKind === "nis2_scope_v3" &&
    evidence.matchedNationalEntityTypes.length > 0
      ? evidence.matchedNationalEntityTypes
      : evidence.matchedEntityTypes;
  const localizeBasis = (item: StoredRuleEvaluationResult["scopeBases"][number]) => ({
    code: item.code,
    description: reason(item.code, "de"),
    descriptionEn: reason(item.code, "en"),
    legalReference:
      item.legalProvisionKeys
        .map((key) => legalCitation(key, "de"))
        .join(", ") || null,
  });

  return {
    outcome: evidence.outcome,
    label: text(artifact.outcomeContentKeys[evidence.outcome], "de"),
    labelEn: text(artifact.outcomeContentKeys[evidence.outcome], "en"),
    reasons: evidence.reasonCodes.map((code) => reason(code, "de")),
    reasonsEn: evidence.reasonCodes.map((code) => reason(code, "en")),
    sizeClassification: evidence.sizeClassification,
    jurisdiction: { countryCode: evidence.jurisdiction.countryCode, countryProfileVersion: evidence.profileVersionKey },
    matchedEntityTypes: displayEntities.map((entity) => ({
      code: entity.code,
      label: entityQuestion?.options.find((option) => option.stableValue === entity.code)?.label ?? entity.code,
      labelEn: entityQuestionEn?.options.find((option) => option.stableValue === entity.code)?.label ?? entity.code,
      legalReference: entity.legalProvisionKeys.map((key) => legalCitation(key, "de")).join(", "),
    })),
    scopeBases: evidence.scopeBases.map(localizeBasis),
    unresolvedFacts: evidence.unresolvedFactCodes.map((code) => reason(code, "de")),
    unresolvedFactsEn: evidence.unresolvedFactCodes.map((code) => reason(code, "en")),
    obligationOverlays: evidence.obligationOverlays.map(localizeBasis),
    indirectExposure: {
      status: evidence.indirectExposure.status,
      reasons: evidence.indirectExposure.reasonCodes.map((code) => reason(code, "de")),
      reasonsEn: evidence.indirectExposure.reasonCodes.map((code) => reason(code, "en")),
    },
    disclaimer: text(artifact.disclaimerContentKey, "de"),
    disclaimerEn: text(artifact.disclaimerContentKey, "en"),
  };
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
