import "dotenv/config";

import {
  access,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { and, eq, inArray } from "drizzle-orm";
import { closeDbConnection, db } from "@/src/db";
import {
  actionPlanItems,
  aiProcessingRunClaims,
  aiProcessingRunContext,
  gapFindingEvidence,
  gapFindings,
  gapRequirements,
  gapRequirementVersions,
} from "@/src/db/schema";
import {
  getApplicabilityQuestionnaireForUser,
  submitApplicabilityCheckForUser,
  type ApplicabilityAnswerValue,
} from "@/src/server/applicability-check";
import {
  claimIdempotency,
  fingerprintRequest,
} from "@/src/server/api/idempotency";
import { directRuntimeReleaseReader } from "@/src/server/compliance";
import { uploadOrganizationDocument } from "@/src/server/documents";
import {
  correctGapRevision,
  createOrOpenGapAssessment,
  finalizeGapAnalysisAndGenerateActionPlan,
  generateGapReassessment,
  getActiveGapAnalysisRelease,
  prepareGapReassessment,
  regenerateGapFindingGuidance,
  retryGapReassessment,
  saveQuestionnaireDraftAnswer,
  submitGapQuestionnaire,
} from "@/src/server/gap-analysis";
import type { GapAnswerValue } from "@/src/server/gap-analysis";
import { databaseIdempotencyRepository } from "@/src/server/idempotency";
import {
  getOrganizationAiProviderPolicy,
  updateOrganizationAiProviderPolicy,
} from "@/src/server/organizations/ai-provider-policy-service";
import { createOrganizationForUser } from "@/src/server/organizations/service";
import { runOneJob } from "@/src/worker/runtime";

type Locale = "de" | "en";
type FindingStatus =
  | "fulfilled"
  | "partially_fulfilled"
  | "not_fulfilled"
  | "insufficient_evidence";
type Priority = "low" | "medium" | "high" | "critical";

type ExpectedFinding = {
  status: FindingStatus;
  severity: Priority;
};

type EvaluationCase = {
  number: number;
  slug: string;
  title: string;
  locale: Locale;
  defaultAnswer: GapAnswerValue;
  answerOverrides?: Record<string, GapAnswerValue>;
  expectedGenerated: Record<string, ExpectedFinding>;
  expectedGeneratedActionItemCount: number;
  expectedFinalActionItemCount: number;
  document?: {
    title: string;
    fileName: string;
    mimeType: "text/plain";
    text: string;
  };
  contradictionRequirementCode?: string;
  manualCorrection?: {
    requirementCode: string;
    status: FindingStatus;
    evidenceSufficiency: "sufficient" | "partial" | "none";
    reason: string;
    resolutionReason: string;
  };
};

const USER_ID =
  process.env.MANUAL_GAP_EVAL_USER_ID?.trim() ||
  "b8a2c5f7-7f69-4893-af62-de06c8438432";
const RUN_ID =
  readArgument("--run-id") ||
  new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
const OUTPUT_DIR = resolve(
  readArgument("--output-dir") ||
    `docs/qa/gap-action-plan-manual-evaluation-${RUN_ID}`,
);

const applicabilityFacts: Record<string, ApplicabilityAnswerValue> = {
  "bc.eu_activity": "yes",
  "bc.jurisdiction_country": "DE",
  "bc.jurisdiction_basis": "de_main_eu_establishment",
  "bc.entity_types": ["de_bsig_dns_service_provider"],
  "bc.member_state_designation": "none",
  "bc.employee_count": "under_50",
  "bc.annual_revenue": "revenue_at_most_10m",
  "bc.balance_sheet_total": "balance_at_most_10m",
  "bc.sme_figures_verified": "verified_de_without_it_exception",
  "bc.sector_specific_regime": "none",
  "bc.critical_customers": "no",
  "bc.security_evidence_requested": "no",
};

const highCodes = [
  "NIS2-GOV-01",
  "NIS2-RISK-02",
  "NIS2-IAM-03",
  "NIS2-IR-04",
  "NIS2-BC-05",
  "NIS2-SC-06",
  "NIS2-VM-07",
  "NIS2-ASSURE-08",
] as const;
const mediumCodes = ["NIS2-AWARE-09", "NIS2-PROTECT-10"] as const;
const allCodes = [...highCodes, ...mediumCodes];

const cases: EvaluationCase[] = [
  {
    number: 1,
    slug: "mature-baseline-en",
    title: "Mature baseline (English, no documents)",
    locale: "en",
    defaultAnswer: "fully_implemented",
    expectedGenerated: expectedAll("fulfilled"),
    expectedGeneratedActionItemCount: 0,
    expectedFinalActionItemCount: 0,
  },
  {
    number: 2,
    slug: "absent-controls-en",
    title: "Absent controls (English)",
    locale: "en",
    defaultAnswer: "not_implemented",
    expectedGenerated: expectedAll("not_fulfilled"),
    expectedGeneratedActionItemCount: 10,
    expectedFinalActionItemCount: 10,
  },
  {
    number: 3,
    slug: "mixed-maturity-en",
    title: "Mixed maturity (English)",
    locale: "en",
    defaultAnswer: "fully_implemented",
    answerOverrides: {
      "gap.governance.management_oversight": "partially_implemented",
      "gap.risk.analysis_updates": "unsure",
      "gap.iam.multi_factor_authentication": "not_implemented",
      "gap.continuity.restore_tests": "partially_implemented",
    },
    expectedGenerated: {
      ...expectedAll("fulfilled"),
      "NIS2-GOV-01": {
        status: "partially_fulfilled",
        severity: "medium",
      },
      "NIS2-RISK-02": {
        status: "insufficient_evidence",
        severity: "high",
      },
      "NIS2-IAM-03": {
        status: "not_fulfilled",
        severity: "high",
      },
      "NIS2-BC-05": {
        status: "partially_fulfilled",
        severity: "medium",
      },
    },
    expectedGeneratedActionItemCount: 4,
    expectedFinalActionItemCount: 4,
  },
  {
    number: 4,
    slug: "uncertain-evidence-de",
    title: "Evidence uncertainty (German)",
    locale: "de",
    defaultAnswer: "unsure",
    expectedGenerated: expectedAll("insufficient_evidence"),
    expectedGeneratedActionItemCount: 10,
    expectedFinalActionItemCount: 10,
  },
  {
    number: 5,
    slug: "contradictory-backup-evidence-en",
    title: "Contradictory backup evidence (English)",
    locale: "en",
    defaultAnswer: "fully_implemented",
    expectedGenerated: expectedAll("fulfilled"),
    expectedGeneratedActionItemCount: 0,
    expectedFinalActionItemCount: 1,
    contradictionRequirementCode: "NIS2-BC-05",
    document: {
      title: "Synthetic backup and restore test record",
      fileName: "synthetic-backup-restore-record.txt",
      mimeType: "text/plain",
      text: [
        "SYNTHETIC QA EVIDENCE — BACKUP AND RESTORE CONTROL STATUS",
        "",
        "Scope: all production systems and important business data.",
        "Review date: 2026-07-26.",
        "",
        "Backups are created on a regular schedule. However, no restoration",
        "test has ever been performed for any production system. There are no",
        "documented restore-test results, no evidence that backed-up systems",
        "can be recovered, and no assigned owner or schedule for restoration",
        "testing.",
        "",
        "The questionnaire assertion that backup restoration is regularly",
        "tested is incorrect and must not be relied upon. Restore capability",
        "remains unverified until an end-to-end recovery test is completed and",
        "documented.",
      ].join("\n"),
    },
    manualCorrection: {
      requirementCode: "NIS2-BC-05",
      status: "not_fulfilled",
      evidenceSufficiency: "sufficient",
      reason:
        "Synthetic QA document directly contradicts the fully implemented restore-test answer.",
      resolutionReason:
        "Manual reviewer accepted the document as the more specific current record and reclassified backup continuity as not fulfilled.",
    },
  },
];

async function main() {
  requireEnvironment();
  process.env.AI_DEFAULT_PROVIDER = "openai";
  await mkdir(OUTPUT_DIR, { recursive: true });

  const runStartedAt = new Date().toISOString();
  const resumeCaseFiveOrganizationId = readArgument(
    "--resume-case-5-organization-id",
  );
  if (resumeCaseFiveOrganizationId) {
    const previous = await Promise.all(
      cases.slice(0, 4).map(async (testCase) =>
        JSON.parse(
          await readFile(
            resolve(
              OUTPUT_DIR,
              `case-${testCase.number}-${testCase.slug}.json`,
            ),
            "utf8",
          ),
        ),
      ),
    );
    const result = await resumeCaseFive(resumeCaseFiveOrganizationId);
    await writeJson(
      resolve(OUTPUT_DIR, `case-5-${cases[4]!.slug}.json`),
      result,
    );
    await writeManifest([...previous, result], runStartedAt);
    return;
  }

  const requestedCaseNumber = readArgument("--case-number");
  if (requestedCaseNumber) {
    const caseNumber = Number(requestedCaseNumber);
    const testCase = cases.find(
      (candidate) => candidate.number === caseNumber,
    );
    if (!testCase || !Number.isInteger(caseNumber)) {
      throw new Error(
        "--case-number must identify one of the five evaluation cases",
      );
    }
    const result = await executeCase(testCase);
    await writeJson(
      resolve(
        OUTPUT_DIR,
        `case-${testCase.number}-${testCase.slug}.json`,
      ),
      result,
    );
    const casePaths = cases.map((candidate) =>
      resolve(
        OUTPUT_DIR,
        `case-${candidate.number}-${candidate.slug}.json`,
      ),
    );
    const allCaseFilesExist = (
      await Promise.all(casePaths.map(fileExists))
    ).every(Boolean);
    if (allCaseFilesExist) {
      const allResults = await Promise.all(
        casePaths.map(async (casePath) =>
          JSON.parse(await readFile(casePath, "utf8")),
        ),
      );
      await writeManifest(allResults, runStartedAt);
    }
    return;
  }

  const results: unknown[] = [];
  for (const testCase of cases) {
    if (results.length > 0) {
      const delayMs = Number(
        process.env.MANUAL_GAP_EVAL_INTER_CASE_DELAY_MS ?? 65_000,
      );
      if (Number.isFinite(delayMs) && delayMs > 0) {
        await delay(delayMs);
      }
    }
    const result = await executeCase(testCase);
    results.push(result);
    await writeJson(
      resolve(
        OUTPUT_DIR,
        `case-${testCase.number}-${testCase.slug}.json`,
      ),
      result,
    );
  }

  await writeManifest(results, runStartedAt);
}

async function writeManifest(results: unknown[], runStartedAt: string) {
  const observedStartTimes = results
    .map((value) => {
      const result = value as {
        aiRun?: { run?: { createdAt?: string | Date } } | null;
      };
      const createdAt = result.aiRun?.run?.createdAt;
      return createdAt ? new Date(createdAt).toISOString() : null;
    })
    .filter((value): value is string => value !== null);
  const manifest = {
    runId: RUN_ID,
    startedAt: [runStartedAt, ...observedStartTimes].sort()[0],
    completedAt: new Date().toISOString(),
    outputDirectory: OUTPUT_DIR,
    userId: USER_ID,
    cases: results.map((value) => {
      const result = value as Awaited<ReturnType<typeof executeCase>>;
      return {
        number: result.case.number,
        slug: result.case.slug,
        organizationId: result.organization.id,
        generatedRevisionId: result.workflow.generatedRevisionId,
        finalRevisionId: result.workflow.finalRevisionId,
        actionPlanId: result.actionPlan.plan.id,
        automaticChecksPassed: result.automaticChecks.every(
          (check) => check.passed,
        ),
      };
    }),
  };
  await writeJson(resolve(OUTPUT_DIR, "manifest.json"), manifest);
}

async function executeCase(testCase: EvaluationCase) {
  const organization = await createOrganizationForUser(USER_ID, {
    name: `QA Gap Eval ${RUN_ID} ${testCase.number} — ${testCase.title}`,
    legalName: `QA Gap Evaluation ${RUN_ID} Case ${testCase.number} GmbH`,
    country: "DE",
  });
  await enableOpenAi(organization.id);

  const questionnaire = await getApplicabilityQuestionnaireForUser(
    USER_ID,
    organization.id,
    "de",
    { runtimeReleaseReader: directRuntimeReleaseReader },
  );
  if (!questionnaire) {
    throw new Error("Active applicability questionnaire is unavailable");
  }
  const applicability = await submitApplicabilityCheckForUser(
    USER_ID,
    organization.id,
    {
      answers: questionnaire.questions.map((question) => {
        const value = applicabilityFacts[question.stableKey];
        if (value === undefined) {
          throw new Error(
            `No applicability fixture answer for ${question.stableKey}`,
          );
        }
        return { questionId: question.id, value };
      }),
    },
    { runtimeReleaseReader: directRuntimeReleaseReader },
  );
  if (applicability.result.outcome !== "essential_entity") {
    throw new Error(
      `Expected essential_entity, received ${applicability.result.outcome}`,
    );
  }

  const assessment = await createOrOpenGapAssessment(
    USER_ID,
    organization.id,
  );
  const release = await getActiveGapAnalysisRelease(
    "nis2-gap",
    testCase.locale,
  );
  if (!release) throw new Error("Active Gap release is unavailable");
  const questionnaireDraft =
    await db.query.gapQuestionnaireDrafts.findFirst({
      columns: { id: true, version: true },
      where: {
        RAW: (table, operators) =>
          and(
            eq(table.assessmentId, assessment.id),
            eq(table.status, "open"),
          ) ?? operators.sql`true`,
      },
    });
  if (!questionnaireDraft) {
    throw new Error("Gap questionnaire draft is unavailable");
  }

  let draftVersion = questionnaireDraft.version;
  const submittedAnswers: Array<{
    questionNumber: number | null;
    stableKey: string;
    answer: GapAnswerValue;
  }> = [];
  for (const [questionIndex, question] of release.questions
    .filter((candidate) => candidate.required)
    .entries()) {
    const answer =
      testCase.answerOverrides?.[question.stableKey] ??
      testCase.defaultAnswer;
    const option = question.options.find(
      (candidate) => candidate.stableValue === answer,
    );
    if (!option) {
      throw new Error(
        `Missing option ${answer} for ${question.stableKey}`,
      );
    }
    const saved = await saveQuestionnaireDraftAnswer({
      userId: USER_ID,
      organizationId: organization.id,
      draftId: questionnaireDraft.id,
      questionId: question.id,
      optionId: option.id,
      expectedVersion: draftVersion,
    });
    draftVersion = saved.version;
    submittedAnswers.push({
      questionNumber: questionIndex + 1,
      stableKey: question.stableKey,
      answer,
    });
  }
  const questionnaireRevision = await submitGapQuestionnaire({
    userId: USER_ID,
    organizationId: organization.id,
    assessmentId: assessment.id,
    draftId: questionnaireDraft.id,
    expectedVersion: draftVersion,
  });

  let uploadedDocument:
    | Awaited<ReturnType<typeof uploadOrganizationDocument>>
    | null = null;
  if (testCase.document) {
    uploadedDocument = await uploadOrganizationDocument({
      userId: USER_ID,
      organizationId: organization.id,
      title: testCase.document.title,
      fileName: testCase.document.fileName,
      mimeType: testCase.document.mimeType,
      bytes: new TextEncoder().encode(testCase.document.text),
    });
  }

  const prepared = await prepareGapReassessment({
    userId: USER_ID,
    organizationId: organization.id,
    assessmentId: assessment.id,
    selectedDocumentVersionIds: uploadedDocument
      ? [uploadedDocument.documentVersionId]
      : [],
    locale: testCase.locale,
  });
  if (!prepared) throw new Error("Gap generation draft was not prepared");
  const generation = await generateGapReassessment({
    userId: USER_ID,
    organizationId: organization.id,
    draftId: prepared.draft.id,
    expectedLockVersion: prepared.draft.lockVersion,
    locale: testCase.locale,
    idempotencyKey: `manual-gap-eval-${RUN_ID}-${testCase.number}-${randomUUID()}`,
  });

  await workGenerationJob(generation.job.id, prepared.draft.id);
  const completedDraft = await db.query.gapReassessmentDrafts.findFirst({
    columns: {
      id: true,
      status: true,
      outputGapRevisionId: true,
      aiProcessingRunId: true,
      generationJobId: true,
    },
    where: {
      RAW: (table, operators) =>
        eq(table.id, prepared.draft.id) ?? operators.sql`true`,
    },
  });
  if (
    completedDraft?.status !== "generated" ||
    !completedDraft.outputGapRevisionId
  ) {
    throw new Error(
      `Gap generation ended in ${completedDraft?.status ?? "missing"} state`,
    );
  }

  const generated = await captureRevision(
    completedDraft.outputGapRevisionId,
    release,
  );
  const generatedFindingByCode = new Map(
    generated.findings.map((finding) => [
      finding.requirementCode,
      finding,
    ]),
  );

  let expectedFinalizationBlock:
    | { attempted: boolean; blocked: boolean; error: unknown }
    | null = null;
  if (testCase.contradictionRequirementCode) {
    const contradictionFinding = generatedFindingByCode.get(
      testCase.contradictionRequirementCode,
    );
    if (!contradictionFinding) {
      throw new Error(
        `Missing ${testCase.contradictionRequirementCode} finding`,
      );
    }
    if (contradictionFinding.requiresReview) {
      try {
        await finalize(
          organization.id,
          completedDraft.outputGapRevisionId,
          `pre-correction-${testCase.number}`,
        );
        expectedFinalizationBlock = {
          attempted: true,
          blocked: false,
          error: null,
        };
      } catch (error) {
        expectedFinalizationBlock = {
          attempted: true,
          blocked: errorCode(error) === "GAP_REVIEW_UNRESOLVED",
          error: serializeError(error),
        };
      }
    } else {
      expectedFinalizationBlock = {
        attempted: false,
        blocked: false,
        error:
          "Not attempted because the AI failed to set requiresReview; finalizing would irreversibly prevent the planned manual correction.",
      };
    }
  }

  let finalRevisionId = completedDraft.outputGapRevisionId;
  let correction:
    | {
        sourceRevisionId: string;
        correctedRevisionId: string;
        requirementCode: string;
        status: FindingStatus;
        evidenceSufficiency: "sufficient" | "partial" | "none";
        reason: string;
        resolutionReason: string;
        guidanceOnlyRevisionId: string;
      }
    | null = null;
  if (testCase.manualCorrection) {
    const sourceFinding = generatedFindingByCode.get(
      testCase.manualCorrection.requirementCode,
    );
    if (!sourceFinding) {
      throw new Error(
        `Missing correction finding ${testCase.manualCorrection.requirementCode}`,
      );
    }
    await waitForProviderWindow();
    const correctedRevision = await correctGapRevision({
      userId: USER_ID,
      organizationId: organization.id,
      sourceRevisionId: completedDraft.outputGapRevisionId,
      corrections: [
        {
          findingId: sourceFinding.id,
          status: testCase.manualCorrection.status,
          evidenceSufficiency:
            testCase.manualCorrection.evidenceSufficiency,
          requiresReview: false,
          reason: testCase.manualCorrection.reason,
          ...(sourceFinding.requiresReview
            ? {
                resolutionReason:
                  testCase.manualCorrection.resolutionReason,
              }
            : {}),
        },
      ],
    });
    finalRevisionId = correctedRevision.id;
    correction = {
      sourceRevisionId: completedDraft.outputGapRevisionId,
      correctedRevisionId: correctedRevision.id,
      requirementCode: testCase.manualCorrection.requirementCode,
      status: testCase.manualCorrection.status,
      evidenceSufficiency:
        testCase.manualCorrection.evidenceSufficiency,
      reason: testCase.manualCorrection.reason,
      resolutionReason: testCase.manualCorrection.resolutionReason,
      guidanceOnlyRevisionId: correctedRevision.id,
    };
    const correctedSnapshot = await captureRevision(
      correctedRevision.id,
      release,
    );
    const correctedFinding = correctedSnapshot.findings.find(
      (finding) =>
        finding.requirementCode ===
        testCase.manualCorrection?.requirementCode,
    );
    if (!correctedFinding) {
      throw new Error("Corrected finding is unavailable for regeneration");
    }
    await waitForProviderWindow();
    const guidanceOnlyRevision =
      await regenerateGapFindingGuidance({
        userId: USER_ID,
        organizationId: organization.id,
        sourceRevisionId: correctedRevision.id,
        findingId: correctedFinding.id,
        reason:
          "Manual QA guidance-only regeneration after accepting the restore-test correction.",
        retryNonce: randomUUID(),
      });
    finalRevisionId = guidanceOnlyRevision.id;
    correction.guidanceOnlyRevisionId = guidanceOnlyRevision.id;
  }
  const preFinalSnapshot = await captureRevision(
    finalRevisionId,
    release,
  );
  const blockers = preFinalSnapshot.findings.filter(
      (finding) => finding.requiresReview,
  );
  if (blockers.length) {
    finalRevisionId = await clearReviewBlockers({
      organizationId: organization.id,
      sourceRevisionId: finalRevisionId,
      release,
      requirementCodes: blockers.map(
        (finding) => finding.requirementCode,
      ),
      reason: () =>
        "Manual QA reviewer cleared an unexpected model review blocker to test action-plan materialization.",
      resolutionReason: () =>
        "The directly relevant contradiction has already been adjudicated; any broader synthetic-fixture disagreement is accepted without changing its structured status.",
    });
  }

  const finalized = await finalize(
    organization.id,
    finalRevisionId,
    `final-${testCase.number}`,
  );
  const finalRevision = await captureRevision(finalRevisionId, release);
  const plan = await captureActionPlan(finalized.plan.id);
  const aiRun = await captureAiRun(
    completedDraft.aiProcessingRunId,
    completedDraft.outputGapRevisionId,
  );
  const automaticChecks = buildAutomaticChecks({
    testCase,
    generated,
    finalRevision,
    plan,
    aiRun,
    expectedFinalizationBlock,
  });

  return {
    case: {
      number: testCase.number,
      slug: testCase.slug,
      title: testCase.title,
      locale: testCase.locale,
      expectedGenerated: testCase.expectedGenerated,
      expectedGeneratedActionItemCount:
        testCase.expectedGeneratedActionItemCount,
      expectedFinalActionItemCount:
        testCase.expectedFinalActionItemCount,
    },
    organization: {
      id: organization.id,
      name: organization.name,
      legalName: organization.legalName,
      country: organization.country,
    },
    inputs: {
      applicabilityOutcome: applicability.result.outcome,
      applicabilityRevisionId: applicability.artifactRevisionId,
      gapAssessmentId: assessment.id,
      gapQuestionnaireRevisionId: questionnaireRevision.id,
      answers: submittedAnswers,
      document: testCase.document
        ? {
            ...testCase.document,
            ...uploadedDocument,
          }
        : null,
    },
    workflow: {
      generationJobId: completedDraft.generationJobId,
      aiProcessingRunId: completedDraft.aiProcessingRunId,
      generatedRevisionId: completedDraft.outputGapRevisionId,
      finalRevisionId,
      correction,
      expectedFinalizationBlock,
    },
    generatedRevision: generated,
    finalRevision,
    aiRun,
    actionPlan: plan,
    automaticChecks,
  };
}

async function resumeCaseFive(organizationId: string) {
  const testCase = cases[4]!;
  const organization = await db.query.organizations.findFirst({
    where: {
      RAW: (table, operators) =>
        eq(table.id, organizationId) ?? operators.sql`true`,
    },
  });
  if (!organization) {
    throw new Error(`Case 5 organization ${organizationId} was not found`);
  }
  const artifact = await db.query.generatedArtifacts.findFirst({
    columns: { id: true, currentRevisionId: true },
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.organizationId, organizationId),
          eq(table.artifactType, "gap_analysis_result"),
        ) ?? operators.sql`true`,
    },
  });
  if (!artifact?.currentRevisionId) {
    throw new Error("Case 5 current Gap revision is unavailable");
  }
  const current = await db.query.generatedArtifactRevisions.findFirst({
    where: {
      RAW: (table, operators) =>
        eq(table.id, artifact.currentRevisionId!) ??
        operators.sql`true`,
    },
  });
  if (!current?.parentRevisionId) {
    throw new Error("Case 5 corrected revision is unavailable");
  }
  const release = await getActiveGapAnalysisRelease(
    "nis2-gap",
    testCase.locale,
  );
  if (!release) throw new Error("Active Gap release is unavailable");
  const generated = await captureRevision(current.parentRevisionId, release);
  const beforeAdditionalResolution = await captureRevision(
    current.id,
    release,
  );
  const blockers = beforeAdditionalResolution.findings.filter(
    (finding) => finding.requiresReview,
  );
  if (!blockers.length) {
    throw new Error(
      "Case 5 resume expected at least one unresolved review blocker",
    );
  }

  let expectedFinalizationBlock: {
    attempted: boolean;
    blocked: boolean;
    error: unknown;
  };
  try {
    await finalize(
      organizationId,
      current.id,
      "resume-pre-resolution",
    );
    expectedFinalizationBlock = {
      attempted: true,
      blocked: false,
      error: null,
    };
  } catch (error) {
    expectedFinalizationBlock = {
      attempted: true,
      blocked: errorCode(error) === "GAP_REVIEW_UNRESOLVED",
      error: serializeError(error),
    };
  }

  const fullyResolvedRevisionId = await clearReviewBlockers({
    organizationId,
    sourceRevisionId: current.id,
    release,
    requirementCodes: blockers.map(
      (finding) => finding.requirementCode,
    ),
    reason: () =>
      "Manual QA reviewer resolved an additional document-related review blocker before finalization.",
    resolutionReason: (requirementCode) =>
        requirementCode === "NIS2-ASSURE-08"
          ? "The missing restore test is already addressed by the corrected NIS2-BC-05 action. The broader effectiveness-review assertion remains accepted for this synthetic fixture."
          : "The broader questionnaire assertion remains accepted; the specific backup contradiction is handled by NIS2-BC-05.",
  });
  const finalized = await finalize(
    organizationId,
    fullyResolvedRevisionId,
    "resume-final",
  );
  const finalRevision = await captureRevision(
    fullyResolvedRevisionId,
    release,
  );
  const plan = await captureActionPlan(finalized.plan.id);
  const draft = await db.query.gapReassessmentDrafts.findFirst({
    where: {
      RAW: (table, operators) =>
        eq(table.organizationId, organizationId) ??
        operators.sql`true`,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!draft) throw new Error("Case 5 reassessment draft is unavailable");
  const aiRun = await captureAiRun(
    draft.aiProcessingRunId,
    current.parentRevisionId,
  );
  const document = await db.query.documents.findFirst({
    where: {
      RAW: (table, operators) =>
        eq(table.organizationId, organizationId) ??
        operators.sql`true`,
    },
  });
  const documentVersion = document?.currentVersionId
    ? await db.query.documentVersions.findFirst({
        where: {
          RAW: (table, operators) =>
            eq(table.id, document.currentVersionId!) ??
            operators.sql`true`,
        },
      })
    : null;
  const assessment = await db.query.assessments.findFirst({
    columns: {
      id: true,
      currentRevisionId: true,
      applicabilityArtifactRevisionId: true,
    },
    where: {
      RAW: (table, operators) =>
        eq(table.organizationId, organizationId) ??
        operators.sql`true`,
    },
    orderBy: { createdAt: "desc" },
  });
  const automaticChecks = buildAutomaticChecks({
    testCase,
    generated,
    finalRevision,
    plan,
    aiRun,
    expectedFinalizationBlock,
  });

  return {
    case: {
      number: testCase.number,
      slug: testCase.slug,
      title: testCase.title,
      locale: testCase.locale,
      expectedGenerated: testCase.expectedGenerated,
      expectedGeneratedActionItemCount:
        testCase.expectedGeneratedActionItemCount,
      expectedFinalActionItemCount:
        testCase.expectedFinalActionItemCount,
    },
    organization: {
      id: organization.id,
      name: organization.name,
      legalName: organization.legalName,
      country: organization.country,
    },
    inputs: {
      applicabilityOutcome: "essential_entity",
      applicabilityRevisionId:
        assessment?.applicabilityArtifactRevisionId ?? null,
      gapAssessmentId: assessment?.id ?? null,
      gapQuestionnaireRevisionId:
        assessment?.currentRevisionId ?? null,
      answers: release.questions.map((question, index) => ({
        questionNumber: index + 1,
        stableKey: question.stableKey,
        answer: testCase.defaultAnswer,
      })),
      document: {
        ...testCase.document,
        documentId: document?.id ?? null,
        documentVersionId: documentVersion?.id ?? null,
        storageBucket: documentVersion?.storageBucket ?? null,
        storagePath: documentVersion?.storagePath ?? null,
        contentHash: documentVersion?.contentHash ?? null,
      },
    },
    workflow: {
      generationJobId: draft.generationJobId,
      aiProcessingRunId: draft.aiProcessingRunId,
      generatedRevisionId: current.parentRevisionId,
      initialCorrectedRevisionId: current.id,
      finalRevisionId: fullyResolvedRevisionId,
      correction: {
        requirementCode: "NIS2-BC-05",
        status: "not_fulfilled",
        evidenceSufficiency: "sufficient",
        reason: testCase.manualCorrection?.reason,
        additionalResolvedRequirements: blockers.map(
          (finding) => finding.requirementCode,
        ),
      },
      expectedFinalizationBlock,
    },
    generatedRevision: generated,
    intermediateCorrectedRevision: beforeAdditionalResolution,
    finalRevision,
    aiRun,
    actionPlan: plan,
    automaticChecks,
  };
}

async function workGenerationJob(jobId: string, draftId: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await runOneJob(`manual-gap-eval-${RUN_ID}-${randomUUID()}`)) {
      break;
    }
    await delay(500);
  }
  let draft = await db.query.gapReassessmentDrafts.findFirst({
    columns: {
      status: true,
      lockVersion: true,
      outputGapRevisionId: true,
    },
    where: {
      RAW: (table, operators) =>
        eq(table.id, draftId) ?? operators.sql`true`,
    },
  });
  if (draft?.status === "failed") {
    const retried = await retryGapReassessment({
      userId: USER_ID,
      organizationId: await organizationIdForDraft(draftId),
      draftId,
      retryNonce: randomUUID(),
      idempotencyKey: `manual-gap-eval-retry-${RUN_ID}-${randomUUID()}`,
    });
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (await runOneJob(`manual-gap-eval-retry-${RUN_ID}-${randomUUID()}`)) {
        break;
      }
      await delay(500);
    }
    draft = await db.query.gapReassessmentDrafts.findFirst({
      columns: {
        status: true,
        lockVersion: true,
        outputGapRevisionId: true,
      },
      where: {
        RAW: (table, operators) =>
          eq(table.id, draftId) ?? operators.sql`true`,
      },
    });
    if (retried.job.id === jobId) {
      throw new Error("Retry unexpectedly reused the failed job");
    }
  }
  if (draft?.status !== "generated" || !draft.outputGapRevisionId) {
    throw new Error(
      `Worker did not generate draft ${draftId}: ${JSON.stringify({
        draft,
        initialJobId: jobId,
      })}`,
    );
  }
}

async function organizationIdForDraft(draftId: string) {
  const draft = await db.query.gapReassessmentDrafts.findFirst({
    columns: { organizationId: true },
    where: {
      RAW: (table, operators) =>
        eq(table.id, draftId) ?? operators.sql`true`,
    },
  });
  if (!draft) throw new Error(`Draft ${draftId} not found`);
  return draft.organizationId;
}

async function finalize(
  organizationId: string,
  revisionId: string,
  suffix: string,
) {
  const request = { gapRevisionId: revisionId };
  const command = await claimIdempotency(databaseIdempotencyRepository, {
    actorKey: USER_ID,
    organizationId,
    scope: organizationId,
    operation: "action-plan.generate",
    key: `manual-gap-eval-${RUN_ID}-${suffix}-${randomUUID()}`,
    requestFingerprint: fingerprintRequest(request),
  });
  if (command.kind !== "started") {
    throw new Error("Action-plan finalization unexpectedly replayed");
  }
  return finalizeGapAnalysisAndGenerateActionPlan({
    userId: USER_ID,
    organizationId,
    gapRevisionId: revisionId,
    command: command.record,
  });
}

async function clearReviewBlockers(input: {
  organizationId: string;
  sourceRevisionId: string;
  release: NonNullable<
    Awaited<ReturnType<typeof getActiveGapAnalysisRelease>>
  >;
  requirementCodes: string[];
  reason: (requirementCode: string) => string;
  resolutionReason: (requirementCode: string) => string;
}) {
  let currentRevisionId = input.sourceRevisionId;
  for (const requirementCode of input.requirementCodes) {
    const current = await captureRevision(
      currentRevisionId,
      input.release,
    );
    const finding = current.findings.find(
      (candidate) =>
        candidate.requirementCode === requirementCode,
    );
    if (!finding) {
      throw new Error(
        `Cannot resolve missing finding ${requirementCode}`,
      );
    }
    const revision = await correctGapRevision({
      userId: USER_ID,
      organizationId: input.organizationId,
      sourceRevisionId: currentRevisionId,
      corrections: [
        {
          findingId: finding.id,
          requiresReview: false,
          reason: input.reason(requirementCode),
          resolutionReason: input.resolutionReason(requirementCode),
        },
      ],
    });
    currentRevisionId = revision.id;
  }
  return currentRevisionId;
}

async function captureRevision(
  revisionId: string,
  release: NonNullable<
    Awaited<ReturnType<typeof getActiveGapAnalysisRelease>>
  >,
) {
  const revision = await db.query.generatedArtifactRevisions.findFirst({
    where: {
      RAW: (table, operators) =>
        eq(table.id, revisionId) ?? operators.sql`true`,
    },
  });
  if (!revision) throw new Error(`Revision ${revisionId} not found`);
  const rows = await db
    .select({
      finding: gapFindings,
      requirementCode: gapRequirements.code,
    })
    .from(gapFindings)
    .innerJoin(
      gapRequirementVersions,
      eq(
        gapRequirementVersions.id,
        gapFindings.requirementVersionId,
      ),
    )
    .innerJoin(
      gapRequirements,
      eq(gapRequirements.id, gapRequirementVersions.requirementId),
    )
    .where(eq(gapFindings.artifactRevisionId, revisionId));
  const evidenceRows = rows.length
    ? await db
        .select()
        .from(gapFindingEvidence)
        .where(
          inArray(
            gapFindingEvidence.findingId,
            rows.map((row) => row.finding.id),
          ),
        )
    : [];
  const requirementByCode = new Map(
    release.requirements.map((requirement) => [
      requirement.code,
      requirement,
    ]),
  );
  const findings = rows
    .map((row) => {
      const requirement = requirementByCode.get(row.requirementCode);
      return {
        ...row.finding,
        requirementCode: row.requirementCode,
        requirementTitle: requirement?.title ?? null,
        requirementText: requirement?.requirementText ?? null,
        criticality: requirement?.criticality ?? null,
        evidence: evidenceRows
          .filter(
            (evidence) => evidence.findingId === row.finding.id,
          )
          .map((evidence) => ({
            id: evidence.id,
            citationId: evidence.citationId,
            sourceType: evidence.sourceType,
            assessmentAnswerId: evidence.assessmentAnswerId,
            documentChunkId: evidence.documentChunkId,
            legalSourceChunkId: evidence.legalSourceChunkId,
            excerpt: evidence.excerpt,
            pageNumber: evidence.pageNumber,
            sectionLabel: evidence.sectionLabel,
          })),
      };
    })
    .sort(
      (left, right) =>
        allCodes.indexOf(
          left.requirementCode as (typeof allCodes)[number],
        ) -
        allCodes.indexOf(
          right.requirementCode as (typeof allCodes)[number],
        ),
    );
  return { revision, findings };
}

async function captureAiRun(
  runId: string | null,
  generatedRevisionId: string,
) {
  const run =
    (runId
      ? await db.query.aiProcessingRuns.findFirst({
          where: {
            RAW: (table, operators) =>
              eq(table.id, runId) ?? operators.sql`true`,
          },
        })
      : null) ??
    (await db.query.aiProcessingRuns.findFirst({
      where: {
        RAW: (table, operators) =>
          eq(table.outputArtifactRevisionId, generatedRevisionId) ??
          operators.sql`true`,
      },
    }));
  if (!run) return null;
  const [context, claims] = await Promise.all([
    db
      .select()
      .from(aiProcessingRunContext)
      .where(eq(aiProcessingRunContext.runId, run.id))
      .orderBy(aiProcessingRunContext.promptPosition),
    db
      .select()
      .from(aiProcessingRunClaims)
      .where(eq(aiProcessingRunClaims.runId, run.id)),
  ]);
  return { run, context, claims };
}

async function captureActionPlan(planId: string) {
  const plan = await db.query.actionPlans.findFirst({
    where: {
      RAW: (table, operators) =>
        eq(table.id, planId) ?? operators.sql`true`,
    },
  });
  if (!plan) throw new Error(`Action plan ${planId} not found`);
  const items = await db
    .select({
      item: actionPlanItems,
      sourceFinding: gapFindings,
      requirementCode: gapRequirements.code,
    })
    .from(actionPlanItems)
    .innerJoin(
      gapFindings,
      eq(gapFindings.id, actionPlanItems.sourceFindingId),
    )
    .innerJoin(
      gapRequirementVersions,
      eq(
        gapRequirementVersions.id,
        gapFindings.requirementVersionId,
      ),
    )
    .innerJoin(
      gapRequirements,
      eq(gapRequirements.id, gapRequirementVersions.requirementId),
    )
    .where(eq(actionPlanItems.actionPlanId, planId));
  return {
    plan,
    items: items.map((row) => ({
      ...row.item,
      requirementCode: row.requirementCode,
      sourceFindingStatus: row.sourceFinding.status,
      sourceFindingSeverity: row.sourceFinding.severity,
      sourceFindingRecommendation: row.sourceFinding.recommendation,
    })),
  };
}

function buildAutomaticChecks(input: {
  testCase: EvaluationCase;
  generated: Awaited<ReturnType<typeof captureRevision>>;
  finalRevision: Awaited<ReturnType<typeof captureRevision>>;
  plan: Awaited<ReturnType<typeof captureActionPlan>>;
  aiRun: Awaited<ReturnType<typeof captureAiRun>>;
  expectedFinalizationBlock: {
    attempted: boolean;
    blocked: boolean;
    error: unknown;
  } | null;
}) {
  const checks: Array<{
    name: string;
    passed: boolean;
    expected: unknown;
    actual: unknown;
  }> = [];
  for (const [code, expected] of Object.entries(
    input.testCase.expectedGenerated,
  )) {
    const actual = input.generated.findings.find(
      (finding) => finding.requirementCode === code,
    );
    checks.push({
      name: `${code} generated status`,
      passed: actual?.status === expected.status,
      expected: expected.status,
      actual: actual?.status ?? null,
    });
    checks.push({
      name: `${code} generated severity`,
      passed: actual?.severity === expected.severity,
      expected: expected.severity,
      actual: actual?.severity ?? null,
    });
    checks.push({
      name: `${code} legal citation`,
      passed:
        actual?.evidence.some(
          (evidence) =>
            evidence.sourceType === "legal_source_chunk",
        ) ?? false,
      expected: "at least one legal_source_chunk",
      actual:
        actual?.evidence.map((evidence) => evidence.sourceType) ?? [],
    });
    const expectedMode =
      expected.status === "fulfilled"
        ? "maintain_and_document"
        : expected.status === "insufficient_evidence"
          ? "evidence_verification"
          : "control_remediation";
    checks.push({
      name: `${code} guidance mode`,
      passed: actual?.guidanceMode === expectedMode,
      expected: expectedMode,
      actual: actual?.guidanceMode ?? null,
    });
    if (expected.status === "fulfilled") {
      const expectedFraming =
        input.testCase.locale === "de"
          ? "Die Fragebogenantworten weisen diese Anforderung als umgesetzt aus."
          : "The questionnaire responses report this requirement as implemented.";
      checks.push({
        name: `${code} fulfilled maintenance framing`,
        passed:
          actual?.recommendation.startsWith(expectedFraming) === true &&
          actual.objective === null,
        expected:
          "explicit questionnaire self-report framing, independent-verification context, and no action objective",
        actual: {
          recommendation: actual?.recommendation ?? null,
          objective: actual?.objective ?? null,
        },
      });
    }
    const basis = actual?.guidanceBasis as
      | {
          triggeringQuestions?: Array<{
            stableKey?: string;
            workKind?: "remediate" | "verify";
          }>;
        }
      | null
      | undefined;
    const triggers = basis?.triggeringQuestions ?? [];
    const deliverables = structuredArray(actual?.deliverables);
    const criteria = structuredArray(actual?.acceptanceCriteria);
    const suggestedEvidence = structuredArray(actual?.suggestedEvidence);
    const hasExpectedShape =
      expected.status === "fulfilled"
        ? actual?.objective === null &&
          deliverables.length === 0 &&
          criteria.length === 0 &&
          suggestedEvidence.length === 0 &&
          triggers.length === 0
        : Boolean(actual?.objective?.trim()) &&
          triggers.length > 0 &&
          triggers.every(
            (trigger) =>
              deliverables.some(
                (entry) =>
                  entry.questionStableKey === trigger.stableKey &&
                  entry.workKind === trigger.workKind,
              ) &&
              suggestedEvidence.some(
                (entry) =>
                  entry.questionStableKey === trigger.stableKey,
              ) &&
              (trigger.workKind === "remediate"
                ? criteria.some(
                    (entry) =>
                      entry.questionStableKey === trigger.stableKey &&
                      entry.workKind === "remediate",
                  )
                : criteria.some(
                    (entry) =>
                      entry.questionStableKey === trigger.stableKey &&
                      entry.completionPath ===
                        "confirmed_implemented",
                  ) &&
                  criteria.some(
                    (entry) =>
                      entry.questionStableKey === trigger.stableKey &&
                      entry.completionPath ===
                        "confirmed_deficient",
                  )),
          );
    checks.push({
      name: `${code} structured guidance coverage`,
      passed: hasExpectedShape,
      expected:
        expected.status === "fulfilled"
          ? "no action guidance"
          : "complete work for every exact trigger",
      actual: {
        objective: actual?.objective ?? null,
        triggers,
        deliverableCount: deliverables.length,
        criterionCount: criteria.length,
        suggestedEvidenceCount: suggestedEvidence.length,
      },
    });
    const legalCitationIds =
      actual?.evidence
        .filter(
          (evidence) =>
            evidence.sourceType === "legal_source_chunk",
        )
        .map((evidence) => evidence.citationId) ?? [];
    checks.push({
      name: `${code} mapped primary legal authority`,
      passed: legalCitationIds.some((citationId) =>
        input.aiRun?.context.some(
          (item) =>
            item.citationId === citationId &&
            item.selectionRole === "mapped_primary" &&
            item.preferredMappedProvision === true,
        ),
      ),
      expected: "cited mapped_primary provenance",
      actual: input.aiRun?.context
        .filter((item) => legalCitationIds.includes(item.citationId))
        .map((item) => ({
          citationId: item.citationId,
          selectionRole: item.selectionRole,
          preferredMappedProvision: item.preferredMappedProvision,
        })),
    });
  }
  checks.push({
    name: "Prompt and response contract",
    passed:
      input.aiRun?.run.promptVersion === "6" &&
      input.aiRun.run.responseSchemaVersion === "6",
    expected: { promptVersion: "6", responseSchemaVersion: "6" },
    actual: input.aiRun
      ? {
          promptVersion: input.aiRun.run.promptVersion,
          responseSchemaVersion:
            input.aiRun.run.responseSchemaVersion,
        }
      : null,
  });
  checks.push({
    name: "Generated finding coverage",
    passed: input.generated.findings.length === 10,
    expected: 10,
    actual: input.generated.findings.length,
  });
  checks.push({
    name: "Final action-item count",
    passed:
      input.plan.items.length ===
      input.testCase.expectedFinalActionItemCount,
    expected: input.testCase.expectedFinalActionItemCount,
    actual: input.plan.items.length,
  });
  for (const item of input.plan.items) {
    const source = input.finalRevision.findings.find(
      (finding) => finding.id === item.sourceFindingId,
    );
    checks.push({
      name: `${item.requirementCode} action source snapshot`,
      passed:
        item.sourceRecommendation === source?.recommendation &&
        item.sourceFindingRecommendation === source?.recommendation &&
        item.objective === source?.objective &&
        sameJson(item.deliverables, source?.deliverables) &&
        sameJson(
          item.acceptanceCriteria,
          source?.acceptanceCriteria,
        ) &&
        sameJson(item.suggestedEvidence, source?.suggestedEvidence),
      expected: {
        sourceRecommendation: source?.recommendation ?? null,
        objective: source?.objective ?? null,
        deliverables: source?.deliverables ?? null,
        acceptanceCriteria: source?.acceptanceCriteria ?? null,
        suggestedEvidence: source?.suggestedEvidence ?? null,
      },
      actual: {
        sourceRecommendation: item.sourceRecommendation,
        objective: item.objective,
        deliverables: item.deliverables,
        acceptanceCriteria: item.acceptanceCriteria,
        suggestedEvidence: item.suggestedEvidence,
      },
    });
    checks.push({
      name: `${item.requirementCode} action priority`,
      passed: item.priority === source?.severity,
      expected: source?.severity ?? null,
      actual: item.priority,
    });
  }
  if (input.testCase.contradictionRequirementCode) {
    const finding = input.generated.findings.find(
      (candidate) =>
        candidate.requirementCode ===
        input.testCase.contradictionRequirementCode,
    );
    checks.push({
      name: "Contradictory document cited on backup finding",
      passed:
        finding?.evidence.some(
          (evidence) => evidence.sourceType === "document_chunk",
        ) ?? false,
      expected: true,
      actual:
        finding?.evidence.map((evidence) => evidence.sourceType) ?? [],
    });
    checks.push({
      name: "Contradiction requires human review",
      passed: finding?.requiresReview === true,
      expected: true,
      actual: finding?.requiresReview ?? null,
    });
    checks.push({
      name: "Unresolved contradiction blocks finalization",
      passed: input.expectedFinalizationBlock?.blocked === true,
      expected: true,
      actual: input.expectedFinalizationBlock,
    });
    const unrelated = input.generated.findings.filter(
      (candidate) =>
        candidate.requirementCode !==
        input.testCase.contradictionRequirementCode,
    );
    checks.push({
      name: "Backup evidence excluded from unrelated findings",
      passed: unrelated.every(
        (candidate) =>
          candidate.evidenceSufficiency === "none" &&
          candidate.evidence.every(
            (evidence) =>
              evidence.sourceType !== "document_chunk",
          ),
      ),
      expected:
        "no document citations and evidenceSufficiency=none",
      actual: unrelated.map((candidate) => ({
        requirementCode: candidate.requirementCode,
        evidenceSufficiency: candidate.evidenceSufficiency,
        documentCitationCount: candidate.evidence.filter(
          (evidence) =>
            evidence.sourceType === "document_chunk",
        ).length,
      })),
    });
    const generatedTarget = input.generated.findings.find(
      (candidate) =>
        candidate.requirementCode ===
        input.testCase.contradictionRequirementCode,
    );
    const finalTarget = input.finalRevision.findings.find(
      (candidate) =>
        candidate.requirementCode ===
        input.testCase.contradictionRequirementCode,
    );
    checks.push({
      name: "Correction has distinct guidance-run lineage",
      passed:
        Boolean(generatedTarget?.guidanceRunId) &&
        Boolean(finalTarget?.guidanceRunId) &&
        generatedTarget?.guidanceRunId !==
          finalTarget?.guidanceRunId,
      expected: "different non-null guidance run IDs",
      actual: {
        generated: generatedTarget?.guidanceRunId ?? null,
        final: finalTarget?.guidanceRunId ?? null,
      },
    });
  }
  return checks;
}

function structuredArray(value: unknown) {
  return Array.isArray(value)
    ? (value as Array<{
        questionStableKey?: string;
        workKind?: "remediate" | "verify";
        completionPath?:
          | "confirmed_implemented"
          | "confirmed_deficient";
      }>)
    : [];
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function enableOpenAi(organizationId: string) {
  const policy = await getOrganizationAiProviderPolicy(
    USER_ID,
    organizationId,
  );
  if (
    policy.externalDisclosureAllowed &&
    Array.isArray(policy.allowedProviderModes) &&
    policy.allowedProviderModes.includes("openai")
  ) {
    return;
  }
  await updateOrganizationAiProviderPolicy({
    userId: USER_ID,
    organizationId,
    openAiDisclosureApproved: true,
    reason:
      "Manual QA uses synthetic questionnaire and document data to evaluate the real gap-analysis workflow.",
    expectedVersion: policy.version,
    requestId: `manual-gap-eval-${RUN_ID}-${randomUUID()}`,
  });
}

function expectedAll(status: FindingStatus) {
  return Object.fromEntries(
    allCodes.map((code) => [
      code,
      {
        status,
        severity:
          status === "fulfilled"
            ? ("low" as const)
            : highCodes.includes(code as (typeof highCodes)[number])
              ? ("high" as const)
              : ("medium" as const),
      },
    ]),
  ) as Record<string, ExpectedFinding>;
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  return "code" in error ? (error as { code?: unknown }).code : null;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: errorCode(error),
      details:
        "details" in error
          ? (error as Error & { details?: unknown }).details
          : undefined,
    };
  }
  return error;
}

async function writeJson(path: string, value: unknown) {
  await writeFile(
    path,
    `${JSON.stringify(value, jsonReplacer, 2)}\n`,
    "utf8",
  );
}

function jsonReplacer(_key: string, value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  return value;
}

function readArgument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function waitForProviderWindow() {
  const delayMs = Number(
    process.env.MANUAL_GAP_EVAL_REGEN_DELAY_MS ?? 65_000,
  );
  if (Number.isFinite(delayMs) && delayMs > 0) {
    await delay(delayMs);
  }
}

async function fileExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function requireEnvironment() {
  for (const name of [
    "DATABASE_URL",
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
  ]) {
    if (!process.env[name]?.trim()) {
      throw new Error(`${name} is required`);
    }
  }
}

main()
  .catch(() => {
    process.exitCode = 1;
  })
  .finally(() => closeDbConnection());
