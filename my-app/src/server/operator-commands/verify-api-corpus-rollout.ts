import "dotenv/config";

import { closeDbConnection, db } from "@/src/db";
import { activeLegalCorpusReleases, legalCorpusFamilies, legalCorpusReleases } from "@/src/db/schema";
import { getRepositoryGapRelease } from "@/src/server/gap-analysis";
import { and, eq, inArray, lte, or } from "drizzle-orm";

const expectedFamilies = ["nis2-eu-primary", "nis2-de-primary"];
const expectedGapRelease = getRepositoryGapRelease("nis2-gap/reliability-v8");

async function main() {
  const corpusRows = await db
    .select({
      familyId: legalCorpusFamilies.id,
      familyCode: legalCorpusFamilies.code,
      releaseId: legalCorpusReleases.id,
      releaseStatus: legalCorpusReleases.status,
      evaluationState: legalCorpusReleases.evaluationState,
    })
    .from(legalCorpusFamilies)
    .innerJoin(
      activeLegalCorpusReleases,
      eq(activeLegalCorpusReleases.familyId, legalCorpusFamilies.id),
    )
    .innerJoin(
      legalCorpusReleases,
      eq(legalCorpusReleases.id, activeLegalCorpusReleases.releaseId),
    )
    .where(inArray(legalCorpusFamilies.code, expectedFamilies));
  assert(corpusRows.length === expectedFamilies.length, "Both required corpus families must be active");
  for (const code of expectedFamilies) {
    const row = corpusRows.find((candidate) => candidate.familyCode === code);
    assert(row, `${code} must be active`);
    assert(row.releaseStatus === "published", `${code} active release must be published`);
    assert(row.evaluationState === "passed", `${code} active release evaluation must have passed`);
    const evaluation = await db.query.legalCorpusEvaluations.findFirst({ columns: { id: true, releaseId: true, jobId: true, fixtureSetVersion: true, passed: true, metrics: true, failures: true, evaluatedAt: true },
      where: { RAW: (table, operators) => (and(
        eq(table.releaseId, row.releaseId),
        eq(table.passed, true),
      )) ?? operators.sql`true` },
    });
    assert(evaluation, `${code} must retain its passing evaluation record`);
  }

  const compliancePointer = await db.query.activeComplianceCheckReleases.findFirst({ columns: { checkCode: true, checkReleaseId: true, activatedBy: true, activatedAt: true },
    where: { RAW: (table, operators) => (eq(table.checkCode, "nis2_applicability")) ?? operators.sql`true` },
  });
  assert(compliancePointer, "The NIS2 compliance release must be active");
  const complianceRelease = await db.query.complianceCheckReleases.findFirst({ columns: { id: true, checkCode: true, versionLabel: true, moduleId: true, questionnaireId: true, questionnaireVersionId: true, scopeModelVersionId: true, scopeThresholdSetId: true, ruleSetId: true, evaluatorKind: true, evaluatorVersion: true, defaultLocale: true, effectiveFrom: true, effectiveTo: true, status: true, aggregateHash: true, corpusReleaseSetHash: true, publishedAt: true, createdAt: true },
    where: { RAW: (table, operators) => (eq(table.id, compliancePointer.checkReleaseId)) ?? operators.sql`true` },
  });
  assert(
    complianceRelease?.status === "published" && complianceRelease.versionLabel === "2026-v2",
    "The active NIS2 compliance release must be published 2026-v2",
  );
  const compliancePins = await db.query.complianceCheckReleaseCorpusReleases.findMany({ columns: { checkReleaseId: true, familyId: true, corpusReleaseId: true },
    where: { RAW: (table, operators) => (eq(table.checkReleaseId, complianceRelease.id)) ?? operators.sql`true` },
  });
  assertExactPins("Compliance", compliancePins, corpusRows);

  const gapPointer = await db.query.activeGapAnalysisReleases.findFirst({ columns: { releaseCode: true, gapAnalysisReleaseId: true, activatedBy: true, activatedAt: true },
    where: { RAW: (table, operators) => (eq(table.releaseCode, "nis2-gap")) ?? operators.sql`true` },
  });
  assert(gapPointer, "The NIS2 Gap release must be active");
  const gapRelease = await db.query.gapAnalysisReleases.findFirst({ columns: { id: true, releaseCode: true, versionLabel: true, moduleId: true, questionnaireId: true, questionnaireVersionId: true, requirementSetVersionId: true, compatibleCheckReleaseId: true, promptName: true, promptVersion: true, promptTemplateHash: true, responseSchemaVersion: true, actionPlanPromptName: true, actionPlanPromptVersion: true, actionPlanPromptTemplateHash: true, actionPlanResponseSchemaVersion: true, evaluatorKind: true, evaluatorVersion: true, defaultLocale: true, status: true, aggregateHash: true, corpusReleaseSetHash: true, publishedAt: true, createdAt: true },
    where: { RAW: (table, operators) => (eq(table.id, gapPointer.gapAnalysisReleaseId)) ?? operators.sql`true` },
  });
  assert(
    gapRelease?.status === "published" &&
      gapRelease.versionLabel === expectedGapRelease.versionLabel &&
      gapRelease.promptName === expectedGapRelease.prompt.name &&
      gapRelease.promptVersion === expectedGapRelease.prompt.version &&
      gapRelease.responseSchemaVersion === expectedGapRelease.prompt.responseSchemaVersion &&
      gapRelease.actionPlanPromptName === expectedGapRelease.actionPlanPrompt?.name &&
      gapRelease.actionPlanPromptVersion === expectedGapRelease.actionPlanPrompt?.version &&
      gapRelease.actionPlanResponseSchemaVersion ===
        expectedGapRelease.actionPlanPrompt?.responseSchemaVersion,
    `The active NIS2 Gap release must be published ${expectedGapRelease.versionLabel} contracts ${expectedGapRelease.prompt.version}/${expectedGapRelease.actionPlanPrompt?.version}`,
  );
  assert(
    gapRelease.compatibleCheckReleaseId === complianceRelease.id,
    "The active Gap release must pin the active compatible compliance release",
  );
  const gapPins = await db.query.gapAnalysisReleaseCorpusReleases.findMany({ columns: { gapAnalysisReleaseId: true, familyId: true, corpusReleaseId: true },
    where: { RAW: (table, operators) => (eq(table.gapAnalysisReleaseId, gapRelease.id)) ?? operators.sql`true` },
  });
  assertExactPins("Gap", gapPins, corpusRows);

  const unfinishedJobs = await db.query.backgroundJobs.findMany({ columns: { id: true, organizationId: true, requestedByUserId: true, kind: true, state: true, payload: true, progress: true, attemptCount: true, maxAttempts: true, cancellable: true, cancellationCapability: true, safeErrorCode: true, safeErrorMessage: true, runAfter: true, leaseOwner: true, leaseExpiresAt: true, heartbeatAt: true, cancellationRequestedAt: true, startedAt: true, finishedAt: true, createdAt: true, updatedAt: true },
    where: { RAW: (table, operators) => (or(
      and(eq(table.state, "queued"), lte(table.runAfter, new Date())),
      inArray(table.state, ["running", "cancellation_requested"]),
    )) ?? operators.sql`true` },
  });
  assert(unfinishedJobs.length === 0, `Rollout has ${unfinishedJobs.length} unfinished background job(s)`);
  const scheduledCleanup = await db.query.backgroundJobs.findFirst({ columns: { id: true, organizationId: true, requestedByUserId: true, kind: true, state: true, payload: true, progress: true, attemptCount: true, maxAttempts: true, cancellable: true, cancellationCapability: true, safeErrorCode: true, safeErrorMessage: true, runAfter: true, leaseOwner: true, leaseExpiresAt: true, heartbeatAt: true, cancellationRequestedAt: true, startedAt: true, finishedAt: true, createdAt: true, updatedAt: true },
    where: { RAW: (table, operators) => (and(eq(table.kind, "cleanup"), eq(table.state, "queued"))) ?? operators.sql`true` },
  });
  assert(scheduledCleanup, "A future maintenance cleanup job must be scheduled");

  for (const eventType of [
    "legal_processing_generation.reviewed",
    "legal_corpus_release.published",
    "legal_corpus_release.activated",
  ]) {
    const event = await db.query.platformAuditEvents.findFirst({ columns: { id: true, actorUserId: true, eventType: true, entityType: true, entityId: true, requestId: true, metadata: true, createdAt: true },
      where: { RAW: (table, operators) => (eq(table.eventType, eventType)) ?? operators.sql`true` },
    });
    assert(event, `Missing platform audit event ${eventType}`);
  }

  console.log(JSON.stringify({
    corpus: corpusRows.map((row) => ({ familyCode: row.familyCode, releaseId: row.releaseId })),
    complianceReleaseId: complianceRelease.id,
    gapReleaseId: gapRelease.id,
    unfinishedJobs: unfinishedJobs.length,
    nextCleanupAt: scheduledCleanup.runAfter.toISOString(),
  }, null, 2));
}

function assertExactPins(
  label: string,
  pins: Array<{ familyId: string; corpusReleaseId: string }>,
  corpusRows: Array<{ familyId: string; releaseId: string }>,
) {
  assert(pins.length === corpusRows.length, `${label} must pin both required corpus releases`);
  for (const corpus of corpusRows) {
    assert(
      pins.some(
        (pin) => pin.familyId === corpus.familyId && pin.corpusReleaseId === corpus.releaseId,
      ),
      `${label} has a missing or mismatched corpus pin`,
    );
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDbConnection());
