import { db } from "@/src/db";
import { artifactRevisionAssessmentSources, assessmentAnswerOptions, assessmentAnswers, assessmentRevisions, assessments, complianceCheckReleases, factOptions, generatedArtifactRevisions, generatedArtifacts, guestApplicabilityChecks, nis2ResultProjections, organizationFactValueOptions, organizationFactValues } from "@/src/db/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import { ApiError } from "../api/errors";
import type { LocalizedRuleEvaluationResult } from "./localize-evaluation";
import type { StoredRuleEvaluationResult } from "./rule-evaluation-schema";
import type { evaluateRuleSet } from "./rules";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type AssessmentRecord = Pick<
  typeof assessments.$inferSelect,
  "id" | "currentRevisionId"
>;
type AssessmentRevisionRecord = Pick<
  typeof assessmentRevisions.$inferSelect,
  "id" | "revisionNumber"
>;
type ArtifactRecord = Pick<
  typeof generatedArtifacts.$inferSelect,
  "id" | "currentRevisionId"
>;
type ArtifactRevisionRecord = Pick<
  typeof generatedArtifactRevisions.$inferSelect,
  "id" | "revisionNumber" | "createdAt"
>;

export type ApplicabilitySubmissionPersistenceCommand = {
  userId: string;
  organizationId: string;
  release: {
    checkCode: string;
    checkReleaseId: string;
    moduleId: string;
    questionnaireId: string;
    questionnaireVersionId: string;
    versionLabel: string;
    isActive: boolean;
    activeReleaseVersionLabel: string;
    evaluatorKind: string;
    supportedCountryCodes: string[];
  };
  ruleSet: {
    id: string;
    versionLabel: string;
  };
  answers: SubmissionBatchCommand["answers"];
  facts: Record<string, unknown>;
  evaluation: ReturnType<typeof evaluateRuleSet>;
  localizedResult: LocalizedRuleEvaluationResult;
  inputHash: string;
  now: Date;
  claimGuestCheckId?: string;
};

export type PersistedApplicabilityResult = {
  artifactRevisionId: string;
  artifactRevisionNumber: number;
  createdAt: string;
  ruleSetId: string;
  ruleSetVersionLabel: string;
  assessmentRevisionId: string;
  evidence: StoredRuleEvaluationResult;
  result: LocalizedRuleEvaluationResult;
  release: {
    id: string;
    versionLabel: string;
    isOutdated: boolean;
    activeVersionLabel: string;
    supportedCountryCodes: string[];
  };
};

export type SubmissionPersistenceTransaction = {
  findActiveAssessment(input: {
    organizationId: string;
    moduleId: string;
    checkReleaseId: string;
  }): Promise<AssessmentRecord | null>;
  findPreviousActiveAssessmentIds(input: {
    organizationId: string;
    checkCode: string;
  }): Promise<string[]>;
  archiveAssessments(assessmentIds: string[]): Promise<void>;
  createAssessment(input: {
    organizationId: string;
    moduleId: string;
    questionnaireId: string;
    checkReleaseId: string;
    createdBy: string;
  }): Promise<AssessmentRecord>;
  findLatestAssessmentRevision(
    assessmentId: string,
  ): Promise<AssessmentRevisionRecord | null>;
  createAssessmentRevision(input: {
    assessmentId: string;
    questionnaireVersionId: string;
    revisionNumber: number;
    parentRevisionId: string | null;
    createdBy: string;
    submittedAt: Date;
  }): Promise<AssessmentRevisionRecord>;
  supersedeAssessmentRevision(revisionId: string): Promise<void>;
  setCurrentAssessmentRevision(input: {
    assessmentId: string;
    revisionId: string;
  }): Promise<void>;
  persistBatches(command: SubmissionBatchCommand): Promise<void>;
  findArtifact(input: {
    organizationId: string;
    moduleId: string;
  }): Promise<ArtifactRecord | null>;
  createArtifact(input: {
    organizationId: string;
    moduleId: string;
  }): Promise<ArtifactRecord>;
  findLatestArtifactRevision(
    artifactId: string,
  ): Promise<ArtifactRevisionRecord | null>;
  createArtifactRevision(input: {
    artifactId: string;
    revisionNumber: number;
    parentRevisionId: string | null;
    result: StoredRuleEvaluationResult;
    ruleSetId: string;
    checkReleaseId: string;
    evaluatorKind: string;
    outcomeCode: string;
    evaluatedAt: Date;
    inputHash: string;
    createdBy: string;
    status: "approved";
  }): Promise<ArtifactRevisionRecord>;
  findProfileVersion(input: {
    checkReleaseId: string;
    countryCode: string;
  }): Promise<string | null>;
  insertResultProjection(input: {
    artifactRevisionId: string;
    countryCode: string | null;
    sizeClassification: StoredRuleEvaluationResult["sizeClassification"];
    jurisdictionProfileVersionId: string | null;
  }): Promise<void>;
  insertArtifactSource(input: {
    artifactRevisionId: string;
    assessmentRevisionId: string;
  }): Promise<void>;
  setCurrentAndAcceptedArtifactRevision(input: {
    artifactId: string;
    revisionId: string;
  }): Promise<void>;
  claimGuestCheck(input: {
    guestCheckId: string;
    userId: string;
    organizationId: string;
    claimedAt: Date;
  }): Promise<void>;
};

export type SubmissionPersistenceAdapter = {
  transaction<T>(
    work: (tx: SubmissionPersistenceTransaction) => Promise<T>,
  ): Promise<T>;
};

export type SubmissionBatchCommand = {
  organizationId: string;
  assessmentRevisionId: string;
  answers: Array<{
    questionId: string;
    questionStableKey: string;
    optionIds: string[];
  }>;
  facts: Record<string, unknown>;
};

type AnswerHeader = { id: string; questionId: string };
type FactValue = { id: string; factKey: string };
type FactOption = { id: string; factKey: string; stableValue: string };

export type SubmissionBatchWriter = {
  insertAnswerHeaders(
    rows: Array<{
      assessmentRevisionId: string;
      questionId: string;
      questionStableKey: string;
    }>,
  ): Promise<AnswerHeader[]>;
  insertAnswerOptionJoins(
    rows: Array<{
      assessmentAnswerId: string;
      questionId: string;
      questionOptionId: string;
    }>,
  ): Promise<void>;
  invalidateCurrentFacts(input: {
    organizationId: string;
    factKeys: string[];
  }): Promise<void>;
  insertFactValues(
    rows: Array<{
      organizationId: string;
      factKey: string;
      sourceType: string;
      sourceRevisionId: string;
      confidence: string;
      isCurrent: boolean;
    }>,
  ): Promise<FactValue[]>;
  loadFactOptions(
    pairs: Array<{ factKey: string; stableValue: string }>,
  ): Promise<FactOption[]>;
  insertFactOptionJoins(
    rows: Array<{
      organizationFactValueId: string;
      factKey: string;
      factOptionId: string;
    }>,
  ): Promise<void>;
};

export async function executeSubmissionBatches(
  writer: SubmissionBatchWriter,
  command: SubmissionBatchCommand,
): Promise<void> {
  const answerHeaders = await writer.insertAnswerHeaders(
    command.answers.map((answer) => ({
      assessmentRevisionId: command.assessmentRevisionId,
      questionId: answer.questionId,
      questionStableKey: answer.questionStableKey,
    })),
  );
  if (answerHeaders.length !== command.answers.length) {
    throw new ApiError(409, "Assessment answer persistence is incomplete");
  }
  const answerIdByQuestionId = uniqueMap(
    answerHeaders.map((answer) => [answer.questionId, answer.id] as const),
    "assessment answer",
  );
  await writer.insertAnswerOptionJoins(
    command.answers.flatMap((answer) => {
      const assessmentAnswerId = answerIdByQuestionId.get(answer.questionId);
      if (!assessmentAnswerId) {
        throw new ApiError(409, "Assessment answer persistence is incomplete");
      }
      return answer.optionIds.map((questionOptionId) => ({
        assessmentAnswerId,
        questionId: answer.questionId,
        questionOptionId,
      }));
    }),
  );

  const factEntries = Object.entries(command.facts);
  const factKeys = factEntries.map(([factKey]) => factKey);
  await writer.invalidateCurrentFacts({
    organizationId: command.organizationId,
    factKeys,
  });
  const factValues = await writer.insertFactValues(
    factEntries.map(([factKey]) => ({
      organizationId: command.organizationId,
      factKey,
      sourceType: "assessment_revision",
      sourceRevisionId: command.assessmentRevisionId,
      confidence: "1.0000",
      isCurrent: true,
    })),
  );
  if (factValues.length !== factEntries.length) {
    throw new ApiError(409, "Organization fact persistence is incomplete");
  }
  const factValueIdByKey = uniqueMap(
    factValues.map((fact) => [fact.factKey, fact.id] as const),
    "organization fact",
  );
  const requestedPairs = factEntries.flatMap(([factKey, value]) =>
    (Array.isArray(value) ? value : [value]).map((stableValue) => {
      if (typeof stableValue !== "string") {
        throw new ApiError(
          409,
          `Fact option mapping is incomplete for ${factKey}`,
        );
      }
      return { factKey, stableValue };
    }),
  );
  const selectedFactOptions = await writer.loadFactOptions(requestedPairs);
  const requestedPairKeys = new Set(
    requestedPairs.map(({ factKey, stableValue }) =>
      factOptionPairKey(factKey, stableValue),
    ),
  );
  const returnedPairKeys = new Set(
    selectedFactOptions.map(({ factKey, stableValue }) =>
      factOptionPairKey(factKey, stableValue),
    ),
  );
  if (
    requestedPairKeys.size !== requestedPairs.length ||
    returnedPairKeys.size !== requestedPairKeys.size ||
    [...returnedPairKeys].some((key) => !requestedPairKeys.has(key))
  ) {
    throw new ApiError(409, "Fact option mapping is incomplete");
  }
  const factOptionByPair = uniqueMap(
    selectedFactOptions.map(
      (option) => [
        factOptionPairKey(option.factKey, option.stableValue),
        option,
      ] as const,
    ),
    "fact option",
  );
  await writer.insertFactOptionJoins(
    requestedPairs.map(({ factKey, stableValue }) => {
      const organizationFactValueId = factValueIdByKey.get(factKey);
      const option = factOptionByPair.get(
        factOptionPairKey(factKey, stableValue),
      );
      if (!organizationFactValueId || !option) {
        throw new ApiError(
          409,
          `Fact option mapping is incomplete for ${factKey}`,
        );
      }
      return {
        organizationFactValueId,
        factKey,
        factOptionId: option.id,
      };
    }),
  );
}

export async function persistSubmissionBatches(
  tx: DbTransaction,
  command: SubmissionBatchCommand,
): Promise<void> {
  await executeSubmissionBatches(
    {
      async insertAnswerHeaders(rows) {
        if (rows.length === 0) return [];
        return tx
          .insert(assessmentAnswers)
          .values(rows)
          .returning({ id: assessmentAnswers.id, questionId: assessmentAnswers.questionId });
      },
      async insertAnswerOptionJoins(rows) {
        if (rows.length > 0) {
          await tx.insert(assessmentAnswerOptions).values(rows);
        }
      },
      async invalidateCurrentFacts({ organizationId, factKeys }) {
        if (factKeys.length > 0) {
          await tx
            .update(organizationFactValues)
            .set({ isCurrent: false })
            .where(
              and(
                eq(organizationFactValues.organizationId, organizationId),
                inArray(organizationFactValues.factKey, factKeys),
                eq(organizationFactValues.isCurrent, true),
              ),
            );
        }
      },
      async insertFactValues(rows) {
        if (rows.length === 0) return [];
        return tx
          .insert(organizationFactValues)
          .values(rows)
          .returning({
            id: organizationFactValues.id,
            factKey: organizationFactValues.factKey,
          });
      },
      async loadFactOptions(pairs) {
        if (pairs.length === 0) return [];
        return tx
          .select({
            id: factOptions.id,
            factKey: factOptions.factDefinitionKey,
            stableValue: factOptions.stableValue,
          })
          .from(factOptions)
          .where(
            or(
              ...pairs.map(({ factKey, stableValue }) =>
                and(
                  eq(factOptions.factDefinitionKey, factKey),
                  eq(factOptions.stableValue, stableValue),
                ),
              ),
            ),
          );
      },
      async insertFactOptionJoins(rows) {
        if (rows.length > 0) {
          await tx.insert(organizationFactValueOptions).values(rows);
        }
      },
    },
    command,
  );
}

export async function persistApplicabilitySubmission(
  command: ApplicabilitySubmissionPersistenceCommand,
  adapter: SubmissionPersistenceAdapter = postgresSubmissionPersistenceAdapter,
): Promise<PersistedApplicabilityResult> {
  return adapter.transaction(async (tx) => {
    let assessment = await tx.findActiveAssessment({
      organizationId: command.organizationId,
      moduleId: command.release.moduleId,
      checkReleaseId: command.release.checkReleaseId,
    });

    if (!assessment) {
      const previousActiveIds = await tx.findPreviousActiveAssessmentIds({
        organizationId: command.organizationId,
        checkCode: command.release.checkCode,
      });
      if (previousActiveIds.length > 0) {
        await tx.archiveAssessments(previousActiveIds);
      }
      assessment = await tx.createAssessment({
        organizationId: command.organizationId,
        moduleId: command.release.moduleId,
        questionnaireId: command.release.questionnaireId,
        checkReleaseId: command.release.checkReleaseId,
        createdBy: command.userId,
      });
    }

    const latestRevision = await tx.findLatestAssessmentRevision(assessment.id);
    const assessmentRevision = await tx.createAssessmentRevision({
      assessmentId: assessment.id,
      questionnaireVersionId: command.release.questionnaireVersionId,
      revisionNumber: (latestRevision?.revisionNumber ?? 0) + 1,
      parentRevisionId: assessment.currentRevisionId,
      createdBy: command.userId,
      submittedAt: command.now,
    });
    if (assessment.currentRevisionId) {
      await tx.supersedeAssessmentRevision(assessment.currentRevisionId);
    }
    await tx.setCurrentAssessmentRevision({
      assessmentId: assessment.id,
      revisionId: assessmentRevision.id,
    });

    await tx.persistBatches({
      organizationId: command.organizationId,
      assessmentRevisionId: assessmentRevision.id,
      answers: command.answers,
      facts: command.facts,
    });

    let artifact = await tx.findArtifact({
      organizationId: command.organizationId,
      moduleId: command.release.moduleId,
    });
    if (!artifact) {
      artifact = await tx.createArtifact({
        organizationId: command.organizationId,
        moduleId: command.release.moduleId,
      });
    }
    const latestArtifactRevision = await tx.findLatestArtifactRevision(
      artifact.id,
    );

    const result: StoredRuleEvaluationResult = {
      ...command.evaluation,
      checkReleaseId: command.release.checkReleaseId,
      ruleSetId: command.ruleSet.id,
      inputHash: command.inputHash,
      evaluatedAt: command.now.toISOString(),
      assessmentRevisionId: assessmentRevision.id,
      assessmentRevisionNumber: assessmentRevision.revisionNumber,
    };
    const artifactRevision = await tx.createArtifactRevision({
      artifactId: artifact.id,
      revisionNumber: (latestArtifactRevision?.revisionNumber ?? 0) + 1,
      parentRevisionId: artifact.currentRevisionId,
      result,
      ruleSetId: command.ruleSet.id,
      checkReleaseId: command.release.checkReleaseId,
      evaluatorKind: command.release.evaluatorKind,
      outcomeCode: command.evaluation.outcome,
      evaluatedAt: command.now,
      inputHash: command.inputHash,
      createdBy: command.userId,
      status: "approved",
    });
    const jurisdictionProfileVersionId = command.evaluation.jurisdiction
      .countryCode
      ? await tx.findProfileVersion({
          checkReleaseId: command.release.checkReleaseId,
          countryCode: command.evaluation.jurisdiction.countryCode,
        })
      : null;
    await tx.insertResultProjection({
      artifactRevisionId: artifactRevision.id,
      countryCode: command.evaluation.jurisdiction.countryCode,
      sizeClassification: command.evaluation.sizeClassification,
      jurisdictionProfileVersionId,
    });
    await tx.insertArtifactSource({
      artifactRevisionId: artifactRevision.id,
      assessmentRevisionId: assessmentRevision.id,
    });
    await tx.setCurrentAndAcceptedArtifactRevision({
      artifactId: artifact.id,
      revisionId: artifactRevision.id,
    });

    if (command.claimGuestCheckId) {
      await tx.claimGuestCheck({
        guestCheckId: command.claimGuestCheckId,
        userId: command.userId,
        organizationId: command.organizationId,
        claimedAt: command.now,
      });
    }

    return {
      artifactRevisionId: artifactRevision.id,
      artifactRevisionNumber: artifactRevision.revisionNumber,
      createdAt: artifactRevision.createdAt.toISOString(),
      ruleSetId: command.ruleSet.id,
      ruleSetVersionLabel: command.ruleSet.versionLabel,
      assessmentRevisionId: assessmentRevision.id,
      evidence: result,
      result: command.localizedResult,
      release: {
        id: command.release.checkReleaseId,
        versionLabel: command.release.versionLabel,
        isOutdated: !command.release.isActive,
        activeVersionLabel: command.release.activeReleaseVersionLabel,
        supportedCountryCodes: command.release.supportedCountryCodes,
      },
    };
  });
}

export const postgresSubmissionPersistenceAdapter: SubmissionPersistenceAdapter = {
  transaction(work) {
    return db.transaction(async (tx) =>
      work({
        async findActiveAssessment({ organizationId, moduleId, checkReleaseId }) {
          return (await tx.query.assessments.findFirst({
            where: { RAW: (table, operators) => (and(
              eq(table.organizationId, organizationId),
              eq(table.moduleId, moduleId),
              eq(table.checkReleaseId, checkReleaseId),
              eq(table.status, "active"),
            )) ?? operators.sql`true` },
            columns: { id: true, currentRevisionId: true },
          })) ?? null;
        },
        async findPreviousActiveAssessmentIds({ organizationId, checkCode }) {
          const rows = await tx
            .select({ id: assessments.id })
            .from(assessments)
            .innerJoin(
              complianceCheckReleases,
              eq(assessments.checkReleaseId, complianceCheckReleases.id),
            )
            .where(
              and(
                eq(assessments.organizationId, organizationId),
                eq(assessments.status, "active"),
                eq(complianceCheckReleases.checkCode, checkCode),
              ),
            );
          return rows.map((row) => row.id);
        },
        async archiveAssessments(assessmentIds) {
          if (assessmentIds.length > 0) {
            await tx
              .update(assessments)
              .set({ status: "archived" })
              .where(inArray(assessments.id, assessmentIds));
          }
        },
        async createAssessment(input) {
          const [created] = await tx.insert(assessments).values(input).returning({
            id: assessments.id,
            currentRevisionId: assessments.currentRevisionId,
          });
          return requireRow(created, "assessment");
        },
        async findLatestAssessmentRevision(assessmentId) {
          return (await tx.query.assessmentRevisions.findFirst({
            where: { RAW: (table, operators) => (eq(table.assessmentId, assessmentId)) ?? operators.sql`true` },
            orderBy: { revisionNumber: "desc" },
            columns: { id: true, revisionNumber: true },
          })) ?? null;
        },
        async createAssessmentRevision(input) {
          const [created] = await tx
            .insert(assessmentRevisions)
            .values({ ...input, status: "submitted" })
            .returning({
              id: assessmentRevisions.id,
              revisionNumber: assessmentRevisions.revisionNumber,
            });
          return requireRow(created, "assessment revision");
        },
        async supersedeAssessmentRevision(revisionId) {
          await tx
            .update(assessmentRevisions)
            .set({ status: "superseded" })
            .where(eq(assessmentRevisions.id, revisionId));
        },
        async setCurrentAssessmentRevision({ assessmentId, revisionId }) {
          await tx
            .update(assessments)
            .set({ currentRevisionId: revisionId })
            .where(eq(assessments.id, assessmentId));
        },
        persistBatches(command) {
          return persistSubmissionBatches(tx, command);
        },
        async findArtifact({ organizationId, moduleId }) {
          return (await tx.query.generatedArtifacts.findFirst({
            where: { RAW: (table, operators) => (and(
              eq(table.organizationId, organizationId),
              eq(table.moduleId, moduleId),
              eq(table.artifactType, "affectedness_result"),
            )) ?? operators.sql`true` },
            columns: { id: true, currentRevisionId: true },
          })) ?? null;
        },
        async createArtifact({ organizationId, moduleId }) {
          const [created] = await tx
            .insert(generatedArtifacts)
            .values({
              organizationId,
              moduleId,
              artifactType: "affectedness_result",
            })
            .returning({
              id: generatedArtifacts.id,
              currentRevisionId: generatedArtifacts.currentRevisionId,
            });
          return requireRow(created, "generated artifact");
        },
        async findLatestArtifactRevision(artifactId) {
          return (await tx.query.generatedArtifactRevisions.findFirst({
            where: { RAW: (table, operators) => (eq(table.artifactId, artifactId)) ?? operators.sql`true` },
            orderBy: { revisionNumber: "desc" },
            columns: {
              id: true,
              revisionNumber: true,
              createdAt: true,
            },
          })) ?? null;
        },
        async createArtifactRevision(input) {
          const [created] = await tx
            .insert(generatedArtifactRevisions)
            .values({
              ...input,
              generatedBy: "system",
              approvedBy: input.createdBy,
              approvedAt: input.evaluatedAt,
            })
            .returning({
              id: generatedArtifactRevisions.id,
              revisionNumber: generatedArtifactRevisions.revisionNumber,
              createdAt: generatedArtifactRevisions.createdAt,
            });
          return requireRow(created, "generated artifact revision");
        },
        async findProfileVersion({ checkReleaseId, countryCode }) {
          const profile =
            await tx.query.complianceCheckReleaseProfiles.findFirst({
              where: { RAW: (table, operators) => (and(
                eq(
                  table.checkReleaseId,
                  checkReleaseId,
                ),
                eq(table.countryCode, countryCode),
              )) ?? operators.sql`true` },
              columns: { jurisdictionProfileVersionId: true },
            });
          return profile?.jurisdictionProfileVersionId ?? null;
        },
        async insertResultProjection(input) {
          await tx.insert(nis2ResultProjections).values(input);
        },
        async insertArtifactSource({
          artifactRevisionId,
          assessmentRevisionId,
        }) {
          await tx.insert(artifactRevisionAssessmentSources).values({
            artifactRevisionId,
            assessmentRevisionId,
          });
        },
        async setCurrentAndAcceptedArtifactRevision({
          artifactId,
          revisionId,
        }) {
          await tx
            .update(generatedArtifacts)
            .set({
              currentRevisionId: revisionId,
              acceptedRevisionId: revisionId,
            })
            .where(eq(generatedArtifacts.id, artifactId));
        },
        async claimGuestCheck({
          guestCheckId,
          userId,
          organizationId,
          claimedAt,
        }) {
          await tx
            .update(guestApplicabilityChecks)
            .set({
              status: "claimed",
              claimedByUserId: userId,
              claimedOrganizationId: organizationId,
              claimedAt,
              updatedAt: claimedAt,
            })
            .where(
              and(
                eq(guestApplicabilityChecks.id, guestCheckId),
                eq(guestApplicabilityChecks.status, "submitted"),
              ),
            );
        },
      }),
    );
  },
};

function factOptionPairKey(factKey: string, stableValue: string) {
  return `${factKey}\u0000${stableValue}`;
}

function uniqueMap<Key, Value>(
  entries: Array<readonly [Key, Value]>,
  label: string,
): Map<Key, Value> {
  const result = new Map<Key, Value>();
  for (const [key, value] of entries) {
    if (result.has(key)) {
      throw new ApiError(409, `Duplicate ${label} mapping`);
    }
    result.set(key, value);
  }
  return result;
}

function requireRow<Row>(row: Row | undefined, label: string): Row {
  if (!row) {
    throw new ApiError(409, `${label} persistence failed`);
  }
  return row;
}
