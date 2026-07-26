import "dotenv/config";

import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { asc, eq, inArray } from "drizzle-orm";
import { closeDbConnection, db } from "@/src/db";
import {
  aiProcessingRunLegalInputs,
  aiProcessingRuns,
  gapAnalysisReleaseCorpusReleases,
  gapFindings,
  generatedArtifactRevisions,
  legalCorpusFamilies,
  legalCorpusReleases,
} from "@/src/db/schema";

type AutomaticCheck = {
  name: string;
  passed: boolean;
  actual?: unknown;
  expected?: unknown;
};

type CaseResult = {
  case: {
    number: number;
    slug: string;
    title: string;
    locale: string;
  };
  workflow: {
    aiProcessingRunId: string;
    generatedRevisionId: string;
    finalRevisionId: string;
  };
  finalRevision: {
    revision: {
      artifactId: string;
      gapAnalysisReleaseId: string;
    };
    findings: Array<{ status: string }>;
  };
  actionPlan: {
    plan: { id: string };
    items: Array<{ id: string }>;
  };
  automaticChecks: AutomaticCheck[];
};

async function main() {
  const evidenceDirectory = resolve(
    process.argv[2] ??
      "docs/qa/gap-action-plan-manual-evaluation-2026-07-26T14-45-00Z",
  );
  const fileNames = (await readdir(evidenceDirectory))
    .filter((name) => /^case-\d.*\.json$/.test(name))
    .sort();
  const cases = await Promise.all(
    fileNames.map(async (fileName) => ({
      fileName,
      result: JSON.parse(
        await readFile(join(evidenceDirectory, fileName), "utf8"),
      ) as CaseResult,
    })),
  );
  if (cases.length !== 5) {
    throw new Error(`Expected five case artifacts, found ${cases.length}`);
  }

  const lifecycle = JSON.parse(
    await readFile(
      join(evidenceDirectory, "post-finalization-lifecycle.json"),
      "utf8",
    ),
  ) as {
    checks: AutomaticCheck[];
    passed: boolean;
  };
  const automaticComparison = {
    evaluatedAt: new Date().toISOString(),
    sourceDirectory: evidenceDirectory,
    cases: cases.map(({ fileName, result }) => {
      const failedChecks = result.automaticChecks.filter(
        (check) => !check.passed,
      );
      return {
        number: result.case.number,
        slug: result.case.slug,
        title: result.case.title,
        locale: result.case.locale,
        artifact: fileName,
        generatedRevisionId: result.workflow.generatedRevisionId,
        finalRevisionId: result.workflow.finalRevisionId,
        actionPlanId: result.actionPlan.plan.id,
        findingStatusCounts: countBy(
          result.finalRevision.findings.map((finding) => finding.status),
        ),
        actionItemCount: result.actionPlan.items.length,
        automaticCheckCount: result.automaticChecks.length,
        failedCheckNames: failedChecks.map((check) => check.name),
        passed: failedChecks.length === 0,
        checks: result.automaticChecks,
      };
    }),
    postFinalizationLifecycle: lifecycle,
    totals: {
      caseCount: cases.length,
      caseCheckCount: cases.reduce(
        (total, entry) =>
          total + entry.result.automaticChecks.length,
        0,
      ),
      lifecycleCheckCount: lifecycle.checks.length,
      failedCheckCount:
        cases.reduce(
          (total, entry) =>
            total +
            entry.result.automaticChecks.filter(
              (check) => !check.passed,
            ).length,
          0,
        ),
      lifecycleFailedCheckCount: lifecycle.checks.filter(
          (check) => !check.passed,
        ).length,
      passed:
        cases.every((entry) =>
          entry.result.automaticChecks.every((check) => check.passed),
        ) && lifecycle.passed,
    },
  };

  const gapReleaseIds = [
    ...new Set(
      cases.map(
        ({ result }) =>
          result.finalRevision.revision.gapAnalysisReleaseId,
      ),
    ),
  ];
  if (gapReleaseIds.length !== 1) {
    throw new Error(
      `Expected one pinned Gap release, found ${gapReleaseIds.length}`,
    );
  }
  const gapReleaseId = gapReleaseIds[0];
  const gapRelease = await db.query.gapAnalysisReleases.findFirst({
    where: {
      RAW: (table, operators) =>
        eq(table.id, gapReleaseId) ?? operators.sql`true`,
    },
  });
  if (!gapRelease) {
    throw new Error(`Gap release ${gapReleaseId} was not found`);
  }
  const checkRelease =
    await db.query.complianceCheckReleases.findFirst({
      where: {
        RAW: (table, operators) =>
          eq(table.id, gapRelease.compatibleCheckReleaseId) ??
          operators.sql`true`,
      },
    });
  const activeGapPointer =
    await db.query.activeGapAnalysisReleases.findFirst({
      where: {
        RAW: (table, operators) =>
          eq(table.releaseCode, gapRelease.releaseCode) ??
          operators.sql`true`,
      },
    });
  const activeCheckPointer = checkRelease
    ? await db.query.activeComplianceCheckReleases.findFirst({
        where: {
          RAW: (table, operators) =>
            eq(table.checkCode, checkRelease.checkCode) ??
            operators.sql`true`,
        },
      })
    : null;
  const corpusPins = await db
    .select({
      familyId: legalCorpusFamilies.id,
      familyCode: legalCorpusFamilies.code,
      frameworkCode: legalCorpusFamilies.frameworkCode,
      jurisdictionCode: legalCorpusFamilies.jurisdictionCode,
      corpusReleaseId: legalCorpusReleases.id,
      versionLabel: legalCorpusReleases.versionLabel,
      contentHash: legalCorpusReleases.contentHash,
      status: legalCorpusReleases.status,
      evaluationState: legalCorpusReleases.evaluationState,
      publishedAt: legalCorpusReleases.publishedAt,
    })
    .from(gapAnalysisReleaseCorpusReleases)
    .innerJoin(
      legalCorpusFamilies,
      eq(
        gapAnalysisReleaseCorpusReleases.familyId,
        legalCorpusFamilies.id,
      ),
    )
    .innerJoin(
      legalCorpusReleases,
      eq(
        gapAnalysisReleaseCorpusReleases.corpusReleaseId,
        legalCorpusReleases.id,
      ),
    )
    .where(
      eq(
        gapAnalysisReleaseCorpusReleases.gapAnalysisReleaseId,
        gapReleaseId,
      ),
    )
    .orderBy(asc(legalCorpusFamilies.code));

  const artifactIds = cases.map(
    ({ result }) => result.finalRevision.revision.artifactId,
  );
  const revisions = await db
    .select({
      id: generatedArtifactRevisions.id,
      artifactId: generatedArtifactRevisions.artifactId,
      revisionNumber: generatedArtifactRevisions.revisionNumber,
      parentRevisionId: generatedArtifactRevisions.parentRevisionId,
      status: generatedArtifactRevisions.status,
    })
    .from(generatedArtifactRevisions)
    .where(inArray(generatedArtifactRevisions.artifactId, artifactIds))
    .orderBy(
      asc(generatedArtifactRevisions.artifactId),
      asc(generatedArtifactRevisions.revisionNumber),
    );
  const findings = await db
    .select({
      artifactRevisionId: gapFindings.artifactRevisionId,
      guidanceRunId: gapFindings.guidanceRunId,
    })
    .from(gapFindings)
    .where(
      inArray(
        gapFindings.artifactRevisionId,
        revisions.map((revision) => revision.id),
      ),
    );
  const runIds = [
    ...new Set(
      findings
        .map((finding) => finding.guidanceRunId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const runs = await db
    .select({
      id: aiProcessingRuns.id,
      operationKind: aiProcessingRuns.operationKind,
      status: aiProcessingRuns.status,
      outputLocale: aiProcessingRuns.outputLocale,
      provider: aiProcessingRuns.provider,
      model: aiProcessingRuns.model,
      promptName: aiProcessingRuns.promptName,
      promptVersion: aiProcessingRuns.promptVersion,
      promptTemplateHash: aiProcessingRuns.promptTemplateHash,
      responseSchemaVersion: aiProcessingRuns.responseSchemaVersion,
      providerPolicyVersion: aiProcessingRuns.providerPolicyVersion,
      corpusReleaseSetHash: aiProcessingRuns.corpusReleaseSetHash,
      inputHash: aiProcessingRuns.inputHash,
      renderedInputHash: aiProcessingRuns.renderedInputHash,
      inputTokens: aiProcessingRuns.inputTokens,
      outputTokens: aiProcessingRuns.outputTokens,
      cachedInputTokens: aiProcessingRuns.cachedInputTokens,
      createdAt: aiProcessingRuns.createdAt,
      completedAt: aiProcessingRuns.completedAt,
    })
    .from(aiProcessingRuns)
    .where(inArray(aiProcessingRuns.id, runIds))
    .orderBy(asc(aiProcessingRuns.createdAt));
  const legalInputs = await db
    .select({
      runId: aiProcessingRunLegalInputs.runId,
      corpusReleaseId:
        aiProcessingRunLegalInputs.corpusReleaseId,
      sourceVersionId:
        aiProcessingRunLegalInputs.sourceVersionId,
      processingGenerationId:
        aiProcessingRunLegalInputs.processingGenerationId,
      sourceHash: aiProcessingRunLegalInputs.sourceHash,
    })
    .from(aiProcessingRunLegalInputs)
    .where(inArray(aiProcessingRunLegalInputs.runId, runIds))
    .orderBy(
      asc(aiProcessingRunLegalInputs.runId),
      asc(aiProcessingRunLegalInputs.corpusReleaseId),
    );
  const revisionRunIds = new Map<string, string[]>();
  for (const finding of findings) {
    if (!finding.guidanceRunId) {
      continue;
    }
    const existing =
      revisionRunIds.get(finding.artifactRevisionId) ?? [];
    if (!existing.includes(finding.guidanceRunId)) {
      existing.push(finding.guidanceRunId);
    }
    revisionRunIds.set(finding.artifactRevisionId, existing);
  }
  const metadata = {
    capturedAt: new Date().toISOString(),
    evidenceDirectory,
    activePointers: {
      complianceCheck: activeCheckPointer,
      gapAnalysis: activeGapPointer,
    },
    complianceCheckRelease: checkRelease,
    gapAnalysisRelease: gapRelease,
    corpusPins,
    cases: cases.map(({ fileName, result }) => {
      const artifactRevisions = revisions
        .filter(
          (revision) =>
            revision.artifactId ===
            result.finalRevision.revision.artifactId,
        )
        .map((revision) => ({
          ...revision,
          guidanceRunIds:
            revisionRunIds.get(revision.id) ?? [],
        }));
      return {
        caseNumber: result.case.number,
        slug: result.case.slug,
        artifact: basename(fileName),
        primaryRunId: result.workflow.aiProcessingRunId,
        artifactId: result.finalRevision.revision.artifactId,
        generatedRevisionId: result.workflow.generatedRevisionId,
        finalRevisionId: result.workflow.finalRevisionId,
        artifactRevisions,
      };
    }),
    modelRuns: runs,
    modelRunLegalInputs: legalInputs,
    invariants: {
      oneGapReleaseAcrossCases: gapReleaseIds.length === 1,
      activeGapPointerMatches:
        activeGapPointer?.gapAnalysisReleaseId === gapRelease.id,
      activeCheckPointerMatches:
        activeCheckPointer?.checkReleaseId === checkRelease?.id,
      allRunsSucceeded: runs.every((run) => run.status === "succeeded"),
      allRunsUsePinnedPrompt:
        runs.every(
          (run) =>
            run.promptName === gapRelease.promptName &&
            run.promptVersion === gapRelease.promptVersion &&
            run.promptTemplateHash ===
              gapRelease.promptTemplateHash &&
            run.responseSchemaVersion ===
              gapRelease.responseSchemaVersion,
        ),
      allRunLegalInputsUsePinnedCorpusReleases:
        legalInputs.every((input) =>
          corpusPins.some(
            (pin) =>
              pin.corpusReleaseId === input.corpusReleaseId,
          ),
        ),
    },
  };

  await Promise.all([
    writeJson(
      join(evidenceDirectory, "automatic-comparison-results.json"),
      automaticComparison,
    ),
    writeJson(
      join(
        evidenceDirectory,
        "exact-release-prompt-schema-provider-metadata.json",
      ),
      metadata,
    ),
  ]);
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

main()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(closeDbConnection);
