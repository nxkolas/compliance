import "dotenv/config";

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { and, eq, inArray } from "drizzle-orm";
import { closeDbConnection, db } from "@/src/db";
import {
  actionPlanItems,
  actionPlanItemGaps,
  aiProcessingRunClaims,
  aiProcessingRunContext,
  aiProcessingRuns,
  auditEvents,
  backgroundJobs,
  backgroundJobResults,
  gapFindingEvidence,
  gapFindings,
  gapItems,
  gapRequirements,
  gapRequirementVersions,
} from "@/src/db/schema";
import {
  getApplicabilityQuestionnaireForUser,
  submitApplicabilityCheckForUser,
  type ApplicabilityAnswerValue,
} from "@/src/server/applicability-check";
import {
  enqueueActionPlanGeneration,
  getCurrentActionPlan,
} from "@/src/server/action-plans";
import { directRuntimeReleaseReader } from "@/src/server/compliance";
import { uploadOrganizationDocument } from "@/src/server/documents";
import {
  correctGapRevision,
  createOrOpenGapAssessment,
  generateGapReassessment,
  loadGapAnalysisRelease,
  prepareGapReassessment,
  regenerateGapFindingGuidance,
  retryGapReassessment,
  saveQuestionnaireDraftAnswer,
  submitGapQuestionnaire,
} from "@/src/server/gap-analysis";
import type { GapAnswerValue } from "@/src/server/gap-analysis";
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
  scenarioNumber?: number;
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
  new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "Z");
const OUTPUT_DIR = resolve(
  readArgument("--output-dir") ||
    `docs/qa/gap-action-plan-manual-evaluation-${RUN_ID}`,
);
const QA_GAP_RELEASE = {
  releaseCode: "nis2-gap",
  versionLabel: readArgument("--gap-release-version") || "guided-v6",
} as const;

async function loadQaGapRelease(locale: Locale) {
  const row = await db.query.gapAnalysisReleases.findFirst({
    columns: { id: true, status: true },
    where: {
      RAW: (table, operators) =>
        and(
          eq(table.releaseCode, QA_GAP_RELEASE.releaseCode),
          eq(table.versionLabel, QA_GAP_RELEASE.versionLabel),
        ) ?? operators.sql`true`,
    },
  });
  if (!row || row.status !== "published") {
    throw new Error(
      `${QA_GAP_RELEASE.releaseCode}/${QA_GAP_RELEASE.versionLabel} is not published`,
    );
  }
  const release = await loadGapAnalysisRelease(row.id, locale);
  if (!release) {
    throw new Error(
      `Published ${QA_GAP_RELEASE.versionLabel} Gap release is unavailable`,
    );
  }
  return release;
}

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

const baseCases: EvaluationCase[] = [
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

const localizedScenarioTitles: Record<number, Record<Locale, string>> = {
  1: { en: "Mature baseline", de: "Ausgereifter Ausgangszustand" },
  2: { en: "Absent controls", de: "Fehlende Kontrollen" },
  3: { en: "Mixed maturity", de: "Gemischter Reifegrad" },
  4: { en: "Uncertain evidence", de: "Unsichere Nachweise" },
  5: {
    en: "Contradictory backup evidence",
    de: "Widersprüchlicher Backup-Nachweis",
  },
};

const cases: EvaluationCase[] = baseCases.flatMap((base, scenarioIndex) =>
  (["en", "de"] as const).map((locale, localeIndex) =>
    localizeEvaluationCase({
      base,
      locale,
      number: scenarioIndex * 2 + localeIndex + 1,
      scenarioNumber: scenarioIndex + 1,
    }),
  ),
);

function localizeEvaluationCase(input: {
  base: EvaluationCase;
  locale: Locale;
  number: number;
  scenarioNumber: number;
}): EvaluationCase {
  const baseSlug = input.base.slug.replace(/-(?:de|en)$/u, "");
  const isContradiction = input.scenarioNumber === 5;
  const document =
    isContradiction && input.locale === "de"
      ? {
          title: "Synthetischer Nachweis zu Backup und Wiederherstellung",
          fileName: "synthetischer-backup-wiederherstellungsnachweis.txt",
          mimeType: "text/plain" as const,
          text: [
            "SYNTHETISCHER QA-NACHWEIS — STATUS DER BACKUP- UND WIEDERHERSTELLUNGSKONTROLLE",
            "",
            "Geltungsbereich: alle Produktivsysteme und wichtigen Geschäftsdaten.",
            "Prüfdatum: 26.07.2026.",
            "",
            "Backups werden regelmäßig erstellt. Für kein Produktivsystem wurde",
            "jedoch jemals ein Wiederherstellungstest durchgeführt. Es gibt keine",
            "dokumentierten Testergebnisse, keinen Nachweis der Wiederherstellbarkeit",
            "und weder Verantwortliche noch einen Zeitplan für solche Tests.",
            "",
            "Die Fragebogenangabe, Wiederherstellungen würden regelmäßig getestet,",
            "ist falsch und darf nicht herangezogen werden. Die Wiederherstellbarkeit",
            "bleibt ungeklärt, bis ein vollständiger Test durchgeführt und dokumentiert ist.",
          ].join("\n"),
        }
      : input.base.document
        ? { ...input.base.document }
        : undefined;
  const manualCorrection = input.base.manualCorrection
    ? input.locale === "de"
      ? {
          ...input.base.manualCorrection,
          reason:
            "Der synthetische QA-Nachweis widerspricht direkt der Angabe eines vollständig umgesetzten Wiederherstellungstests.",
          resolutionReason:
            "Die manuelle Prüfung bewertet den spezifischen aktuellen Nachweis als maßgeblich und stuft die Backup-Kontinuität als nicht erfüllt ein.",
        }
      : { ...input.base.manualCorrection }
    : undefined;
  return {
    ...input.base,
    number: input.number,
    scenarioNumber: input.scenarioNumber,
    locale: input.locale,
    slug: `${baseSlug}-${input.locale}`,
    title: `${localizedScenarioTitles[input.scenarioNumber]![input.locale]} (${input.locale.toUpperCase()})`,
    document,
    manualCorrection,
  };
}

async function main() {
  requireEnvironment();
  process.env.AI_DEFAULT_PROVIDER = "openai";
  await mkdir(OUTPUT_DIR, { recursive: true });

  const runStartedAt = new Date().toISOString();
  if (process.argv.includes("--manifest-only")) {
    const allResults = await Promise.all(
      cases.map(async (testCase) =>
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
    await writeManifest(allResults, runStartedAt);
    return;
  }
  if (process.argv.includes("--partial-manifest")) {
    const availableResults = (
      await Promise.all(
        cases.map(async (testCase) => {
          const casePath = resolve(
            OUTPUT_DIR,
            `case-${testCase.number}-${testCase.slug}.json`,
          );
          return (await fileExists(casePath))
            ? JSON.parse(await readFile(casePath, "utf8"))
            : null;
        }),
      )
    ).filter((value): value is NonNullable<typeof value> => value !== null);
    if (availableResults.length === 0) {
      throw new Error("No case artifacts are available for a partial manifest");
    }
    await writeManifest(availableResults, runStartedAt);
    return;
  }
  const resumeCaseFiveOrganizationId = readArgument(
    "--resume-case-5-organization-id",
  );
  if (resumeCaseFiveOrganizationId) {
    const resumedCase = cases.find(
      (testCase) => testCase.scenarioNumber === 5 && testCase.locale === "en",
    );
    if (!resumedCase) throw new Error("English scenario 5 is unavailable");
    const previous = await Promise.all(
      cases
        .filter((testCase) => testCase.number < resumedCase.number)
        .map(async (testCase) =>
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
      resolve(
        OUTPUT_DIR,
        `case-${resumedCase.number}-${resumedCase.slug}.json`,
      ),
      result,
    );
    await writeManifest([...previous, result], runStartedAt);
    return;
  }

  const requestedCaseNumber = readArgument("--case-number");
  if (requestedCaseNumber) {
    const caseNumber = Number(requestedCaseNumber);
    const testCase = cases.find((candidate) => candidate.number === caseNumber);
    if (!testCase || !Number.isInteger(caseNumber)) {
      throw new Error(
        "--case-number must identify one of the ten locale-specific evaluation cases",
      );
    }
    const result = await executeCase(testCase);
    await writeJson(
      resolve(OUTPUT_DIR, `case-${testCase.number}-${testCase.slug}.json`),
      result,
    );
    const casePaths = cases.map((candidate) =>
      resolve(OUTPUT_DIR, `case-${candidate.number}-${candidate.slug}.json`),
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
      resolve(OUTPUT_DIR, `case-${testCase.number}-${testCase.slug}.json`),
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
    localeSummaries: await buildLocaleSummaries(results),
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
  const reviewLines = [
    "# Atomic Gap and Action Plan manual review",
    "",
    `Run: \`${RUN_ID}\``,
    "",
    "Inspect the provider-produced prose in every case JSON file. Automated schema checks are necessary but do not constitute content approval.",
    "",
    "For each English and German case, record concrete excerpts and mark every item only after inspection:",
    "",
    "- [ ] Atomic gaps are short, standalone, and non-overlapping.",
    "- [ ] Every Gap statement is one sentence and at most 20 words.",
    "- [ ] Gap prose states the fact directly without questionnaire or legal-source framing.",
    "- [ ] Missing, partial, and uncertain wording is truthful.",
    "- [ ] Partial answers contain no invented sub-control deficiency.",
    "- [ ] Gap prose contains no recommendation or remediation instruction.",
    "- [ ] Review notices describe contradictions without action advice.",
    "- [ ] Actions combine or split gaps sensibly within one category.",
    "- [ ] Uncertain work verifies first and makes remediation conditional.",
    "- [ ] Verification results contain at most one server-owned conditional lead-in.",
    "- [ ] Results are clear and recommended evidence names are concrete.",
    "- [ ] Action titles are imperative and at most 12 words.",
    "- [ ] Action results use one or two sentences and at most 40 words.",
    "- [ ] Action prose is operational only and contains no legal exposition.",
    "- [ ] Removed objective/deliverable/acceptance-criteria prose is absent.",
    "- [ ] Both locales are readable and match the pinned result language.",
    "",
    "## Cases",
    "",
    ...manifest.cases.flatMap((item) => [
      `### ${item.number}. ${item.slug}`,
      "",
      `Automated checks: ${item.automaticChecksPassed ? "PASS" : "FAIL"}`,
      "",
      "- Human judgment: PENDING",
      "- Gap excerpt:",
      "- Action excerpt:",
      "- Notes:",
      "",
    ]),
  ];
  await writeFile(
    resolve(OUTPUT_DIR, "manual-review-checklist.md"),
    `${reviewLines.join("\n")}\n`,
    "utf8",
  );
}

async function buildLocaleSummaries(results: unknown[]) {
  return Object.fromEntries(
    await Promise.all(
      (["en", "de"] as const).map(async (locale) => {
        const localeResults = results
          .map((value) => value as Awaited<ReturnType<typeof executeCase>>)
          .filter((result) => result.case.locale === locale);
        const organizationIds = localeResults.map(
          (result) => result.organization.id,
        );
        const jobs =
          organizationIds.length > 0
            ? await db
                .select({
                  id: backgroundJobs.id,
                  kind: backgroundJobs.kind,
                  state: backgroundJobs.state,
                  startedAt: backgroundJobs.startedAt,
                  finishedAt: backgroundJobs.finishedAt,
                })
                .from(backgroundJobs)
                .where(inArray(backgroundJobs.organizationId, organizationIds))
            : [];
        const generationJobs = jobs.filter(
          (job) =>
            job.kind.startsWith("gap-generation") ||
            job.kind.startsWith("action-plan-generation"),
        );
        const jobIds = generationJobs.map((job) => job.id);
        const [runs, diagnostics] =
          jobIds.length > 0
            ? await Promise.all([
                db
                  .select({
                    inputTokens: aiProcessingRuns.inputTokens,
                    outputTokens: aiProcessingRuns.outputTokens,
                    cachedInputTokens: aiProcessingRuns.cachedInputTokens,
                    startedAt: aiProcessingRuns.startedAt,
                    completedAt: aiProcessingRuns.completedAt,
                  })
                  .from(aiProcessingRuns)
                  .where(inArray(aiProcessingRuns.jobId, jobIds)),
                db
                  .select({ metadata: auditEvents.metadata })
                  .from(auditEvents)
                  .where(
                    and(
                      eq(
                        auditEvents.eventType,
                        "ai_generation.category_diagnostic",
                      ),
                      inArray(auditEvents.entityId, jobIds),
                    ),
                  ),
              ])
            : [[], []];
        const metadata = diagnostics.map(
          (row) => row.metadata as Record<string, unknown>,
        );
        const initialAccepted = metadata.filter(
          (item) =>
            item.phase === "initial" &&
            (item.stage === "content" || item.stage === "normalization") &&
            (item.disposition === "accepted" ||
              item.disposition === "normalized"),
        ).length;
        const repairRequested = metadata.filter(
          (item) =>
            item.disposition === "repair_requested" &&
            item.stage !== "provider",
        ).length;
        const repairAccepted = metadata.filter(
          (item) =>
            item.phase === "repair" &&
            (item.stage === "content" || item.stage === "normalization") &&
            (item.disposition === "accepted" ||
              item.disposition === "normalized"),
        ).length;
        const repairExhausted = metadata.filter(
          (item) => item.phase === "repair" && item.disposition === "rejected",
        ).length;
        const categoryCount = initialAccepted + repairRequested;
        const providerLatencies = runs.flatMap((run) =>
          run.completedAt && run.startedAt
            ? [run.completedAt.getTime() - run.startedAt.getTime()]
            : [],
        );
        const workflowLatencies = generationJobs.flatMap((job) =>
          job.startedAt && job.finishedAt
            ? [job.finishedAt.getTime() - job.startedAt.getTime()]
            : [],
        );
        return [
          locale,
          {
            workflows: localeResults.length,
            automaticChecksPassed: localeResults.filter((result) =>
              result.automaticChecks.every((check) => check.passed),
            ).length,
            generationJobs: generationJobs.length,
            successfulJobs: generationJobs.filter(
              (job) => job.state === "succeeded",
            ).length,
            categoryCount,
            initialAccepted,
            firstPassRate:
              categoryCount > 0 ? initialAccepted / categoryCount : 1,
            repairRequested,
            repairAccepted,
            repairExhausted,
            providerRuns: runs.length,
            providerLatencyMs: latencySummary(providerLatencies),
            workflowLatencyMs: latencySummary(workflowLatencies),
            tokens: {
              input: sumNullable(runs.map((run) => run.inputTokens)),
              output: sumNullable(runs.map((run) => run.outputTokens)),
              cachedInput: sumNullable(
                runs.map((run) => run.cachedInputTokens),
              ),
            },
            terminalJobsWithProcessingRuns: localeResults.reduce(
              (total, result) =>
                total +
                result.lifecycleInvariants.terminalJobsWithProcessingRuns,
              0,
            ),
            offlineQuality: summarizeOfflineQuality(localeResults),
          },
        ] as const;
      }),
    ),
  );
}

function summarizeOfflineQuality(
  results: Array<Awaited<ReturnType<typeof executeCase>>>,
) {
  const violations: Array<{
    caseNumber: number;
    requirementCode: string;
    dimension: string;
  }> = [];
  const add = (
    result: (typeof results)[number],
    requirementCode: string,
    dimension: string,
  ) =>
    violations.push({
      caseNumber: result.case.number,
      requirementCode,
      dimension,
    });
  for (const result of results) {
    for (const finding of result.finalRevision.findings) {
      for (const gap of finding.gaps) {
        if (wordCount(gap.statement) > 20)
          add(result, finding.requirementCode, "gap_word_count");
        if (sentenceCount(gap.statement) > 1)
          add(result, finding.requirementCode, "gap_sentence_count");
        if (containsLegalExposition(gap.statement))
          add(result, finding.requirementCode, "gap_legal_exposition");
        if (/\bquestionnaire\b|\bfragebogen\b/iu.test(gap.statement))
          add(result, finding.requirementCode, "gap_source_framing");
      }
    }
    for (const action of result.actionPlan.items) {
      if (wordCount(action.title) > 12)
        add(result, action.requirementCode, "action_title_word_count");
      if (wordCount(action.result) > 40)
        add(result, action.requirementCode, "action_result_word_count");
      const resultSentences = sentenceCount(action.result);
      if (resultSentences < 1 || resultSentences > 2)
        add(result, action.requirementCode, "action_result_sentence_count");
      if (
        (Array.isArray(action.suggestedEvidence)
          ? action.suggestedEvidence
          : []
        ).some((evidence) => wordCount(String(evidence)) > 12)
      ) {
        add(result, action.requirementCode, "action_evidence_word_count");
      }
      const actionProse = [
        action.title,
        action.result,
        ...(Array.isArray(action.suggestedEvidence)
          ? action.suggestedEvidence.map(String)
          : []),
      ].join(" ");
      if (containsLegalExposition(actionProse))
        add(result, action.requirementCode, "action_legal_exposition");
      if (
        action.sourceFindingStatus === "insufficient_evidence" &&
        countConditionalLeadIns(action.result) > 1
      ) {
        add(
          result,
          action.requirementCode,
          "action_duplicate_conditional_lead_in",
        );
      }
      if (
        action.requirementCode !== "NIS2-BC-05" &&
        /\bbackup\w*\b|\bdatensicherung\w*\b|\bsicherungskopie\w*\b/iu.test(
          actionProse,
        )
      ) {
        add(result, action.requirementCode, "action_example_copy");
      }
    }
  }
  return {
    passed: violations.length === 0,
    violationCount: violations.length,
    violations,
  };
}

function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/u).length : 0;
}

function sentenceCount(value: string) {
  return value
    .split(/[.!?]+(?:\s+|$)/u)
    .filter((sentence) => sentence.trim().length > 0).length;
}

function containsLegalExposition(value: string) {
  return /\b(?:NIS2|directive|statute|law|article|section|obligation|regulator|citation|BSI Act|gesetz|artikel|paragraph|verpflichtung|aufsichtsbehörde|fundstelle)\b/iu.test(
    value,
  );
}

function countConditionalLeadIns(value: string) {
  return [
    ...value.matchAll(
      /\bif verification identifies a deficiency\b|\bfalls die prüfung einen mangel ergibt\b/giu,
    ),
  ].length;
}

function latencySummary(values: number[]) {
  if (values.length === 0) {
    return { count: 0, average: null, p95: null, maximum: null };
  }
  const ordered = [...values].sort((left, right) => left - right);
  return {
    count: ordered.length,
    average: Math.round(
      ordered.reduce((total, value) => total + value, 0) / ordered.length,
    ),
    p95: ordered[Math.ceil(ordered.length * 0.95) - 1]!,
    maximum: ordered.at(-1)!,
  };
}

function sumNullable(values: Array<number | null>) {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
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

  const release = await loadQaGapRelease(testCase.locale);
  const assessment = await createOrOpenGapAssessment(
    USER_ID,
    organization.id,
    "nis2-gap",
    { publishedReleaseIdForQa: release.id },
  );
  const questionnaireDraft = await db.query.gapQuestionnaireDrafts.findFirst({
    columns: { id: true, version: true },
    where: {
      RAW: (table, operators) =>
        and(eq(table.assessmentId, assessment.id), eq(table.status, "open")) ??
        operators.sql`true`,
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
      testCase.answerOverrides?.[question.stableKey] ?? testCase.defaultAnswer;
    const option = question.options.find(
      (candidate) => candidate.stableValue === answer,
    );
    if (!option) {
      throw new Error(`Missing option ${answer} for ${question.stableKey}`);
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

  let uploadedDocument: Awaited<
    ReturnType<typeof uploadOrganizationDocument>
  > | null = null;
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
    selectedDocumentIds: uploadedDocument ? [uploadedDocument.documentId] : [],
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
    generated.findings.map((finding) => [finding.requirementCode, finding]),
  );

  let expectedFinalizationBlock: {
    attempted: boolean;
    blocked: boolean;
    error: unknown;
  } | null = null;
  if (testCase.contradictionRequirementCode) {
    const contradictionFinding = generatedFindingByCode.get(
      testCase.contradictionRequirementCode,
    );
    if (!contradictionFinding) {
      throw new Error(
        `Missing ${testCase.contradictionRequirementCode} finding`,
      );
    }
    expectedFinalizationBlock = {
      attempted: false,
      blocked: false,
      error: contradictionFinding.requiresReview
        ? null
        : "The AI failed to preserve the expected contradiction warning.",
    };
  }

  let finalRevisionId = completedDraft.outputGapRevisionId;
  let correction: {
    sourceRevisionId: string;
    correctedRevisionId: string;
    requirementCode: string;
    status: FindingStatus;
    evidenceSufficiency: "sufficient" | "partial" | "none";
    reason: string;
    resolutionReason: string;
    guidanceOnlyRevisionId: string;
  } | null = null;
  if (testCase.manualCorrection) {
    const manualCorrection = testCase.manualCorrection;
    const generatedRevisionId = completedDraft.outputGapRevisionId;
    const sourceFinding = generatedFindingByCode.get(
      manualCorrection.requirementCode,
    );
    if (!sourceFinding) {
      throw new Error(
        `Missing correction finding ${manualCorrection.requirementCode}`,
      );
    }
    await waitForProviderWindow();
    const correctedRevision = await retryProviderStep(() =>
      correctGapRevision({
        userId: USER_ID,
        organizationId: organization.id,
        sourceRevisionId: generatedRevisionId,
        retryNonce: randomUUID(),
        corrections: [
          {
            findingId: sourceFinding.id,
            status: manualCorrection.status,
            evidenceSufficiency: manualCorrection.evidenceSufficiency,
            requiresReview: false,
            reason: manualCorrection.reason,
            ...(sourceFinding.requiresReview
              ? {
                  resolutionReason: manualCorrection.resolutionReason,
                }
              : {}),
          },
        ],
      }),
    );
    finalRevisionId = correctedRevision.id;
    correction = {
      sourceRevisionId: generatedRevisionId,
      correctedRevisionId: correctedRevision.id,
      requirementCode: manualCorrection.requirementCode,
      status: manualCorrection.status,
      evidenceSufficiency: manualCorrection.evidenceSufficiency,
      reason: manualCorrection.reason,
      resolutionReason: manualCorrection.resolutionReason,
      guidanceOnlyRevisionId: correctedRevision.id,
    };
    const correctedSnapshot = await captureRevision(
      correctedRevision.id,
      release,
    );
    const correctedFinding = correctedSnapshot.findings.find(
      (finding) =>
        finding.requirementCode === testCase.manualCorrection?.requirementCode,
    );
    if (!correctedFinding) {
      throw new Error("Corrected finding is unavailable for regeneration");
    }
    await waitForProviderWindow();
    const guidanceOnlyRevision = await retryProviderStep(() =>
      regenerateGapFindingGuidance({
        userId: USER_ID,
        organizationId: organization.id,
        sourceRevisionId: correctedRevision.id,
        findingId: correctedFinding.id,
        reason:
          "Manual QA guidance-only regeneration after accepting the restore-test correction.",
        retryNonce: randomUUID(),
      }),
    );
    finalRevisionId = guidanceOnlyRevision.id;
    correction.guidanceOnlyRevisionId = guidanceOnlyRevision.id;
  }
  const preFinalSnapshot = await captureRevision(finalRevisionId, release);
  const blockers = preFinalSnapshot.findings.filter(
    (finding) => finding.requiresReview,
  );
  if (blockers.length) {
    finalRevisionId = await clearReviewBlockers({
      organizationId: organization.id,
      sourceRevisionId: finalRevisionId,
      release,
      requirementCodes: blockers.map((finding) => finding.requirementCode),
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
  const actionAiRun = await captureAiRun(plan.plan.generationRunId, null);
  const automaticChecks = buildAutomaticChecks({
    testCase,
    release,
    generated,
    finalRevision,
    plan,
    aiRun,
    actionAiRun,
    expectedFinalizationBlock,
  });
  const lifecycleInvariants = await readCaseLifecycleInvariants([
    completedDraft.generationJobId,
    plan.plan.generationJobId,
  ]);
  if (lifecycleInvariants.terminalJobsWithProcessingRuns !== 0) {
    throw new Error(
      `Generation lifecycle invariant failed: ${JSON.stringify(lifecycleInvariants)}`,
    );
  }

  return {
    case: {
      number: testCase.number,
      slug: testCase.slug,
      title: testCase.title,
      locale: testCase.locale,
      expectedGenerated: testCase.expectedGenerated,
      expectedGeneratedActionItemCount:
        testCase.expectedGeneratedActionItemCount,
      expectedFinalActionItemCount: testCase.expectedFinalActionItemCount,
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
    actionAiRun,
    actionPlan: plan,
    lifecycleInvariants,
    automaticChecks,
  };
}

async function readCaseLifecycleInvariants(jobIds: Array<string | null>) {
  const selected = jobIds.filter((jobId): jobId is string => Boolean(jobId));
  if (selected.length === 0) {
    return { terminalJobsWithProcessingRuns: 0 };
  }
  const rows = await db
    .select({ runId: aiProcessingRuns.id })
    .from(aiProcessingRuns)
    .innerJoin(backgroundJobs, eq(backgroundJobs.id, aiProcessingRuns.jobId))
    .where(
      and(
        inArray(backgroundJobs.id, selected),
        inArray(backgroundJobs.state, ["failed", "cancelled", "succeeded"]),
        eq(aiProcessingRuns.status, "processing"),
      ),
    );
  return { terminalJobsWithProcessingRuns: rows.length };
}

async function resumeCaseFive(organizationId: string) {
  const testCase = cases.find(
    (candidate) => candidate.scenarioNumber === 5 && candidate.locale === "en",
  );
  if (!testCase) throw new Error("English scenario 5 is unavailable");
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
        eq(table.id, artifact.currentRevisionId!) ?? operators.sql`true`,
    },
  });
  if (!current?.parentRevisionId) {
    throw new Error("Case 5 corrected revision is unavailable");
  }
  const release = await loadQaGapRelease(testCase.locale);
  const generated = await captureRevision(current.parentRevisionId, release);
  const beforeAdditionalResolution = await captureRevision(current.id, release);
  const blockers = beforeAdditionalResolution.findings.filter(
    (finding) => finding.requiresReview,
  );
  if (!blockers.length) {
    throw new Error(
      "Case 5 resume expected at least one unresolved review blocker",
    );
  }

  const expectedFinalizationBlock: {
    attempted: boolean;
    blocked: boolean;
    error: unknown;
  } = {
    attempted: false,
    blocked: false,
    error: null,
  };

  const fullyResolvedRevisionId = await clearReviewBlockers({
    organizationId,
    sourceRevisionId: current.id,
    release,
    requirementCodes: blockers.map((finding) => finding.requirementCode),
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
  const finalRevision = await captureRevision(fullyResolvedRevisionId, release);
  const plan = await captureActionPlan(finalized.plan.id);
  const draft = await db.query.gapReassessmentDrafts.findFirst({
    where: {
      RAW: (table, operators) =>
        eq(table.organizationId, organizationId) ?? operators.sql`true`,
    },
    orderBy: { createdAt: "desc" },
  });
  if (!draft) throw new Error("Case 5 reassessment draft is unavailable");
  const aiRun = await captureAiRun(
    draft.aiProcessingRunId,
    current.parentRevisionId,
  );
  const actionAiRun = await captureAiRun(plan.plan.generationRunId, null);
  const document = await db.query.documents.findFirst({
    where: {
      RAW: (table, operators) =>
        eq(table.organizationId, organizationId) ?? operators.sql`true`,
    },
  });
  const documentVersion = document?.currentVersionId
    ? await db.query.documentVersions.findFirst({
        where: {
          RAW: (table, operators) =>
            eq(table.id, document.currentVersionId!) ?? operators.sql`true`,
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
        eq(table.organizationId, organizationId) ?? operators.sql`true`,
    },
    orderBy: { createdAt: "desc" },
  });
  const automaticChecks = buildAutomaticChecks({
    testCase,
    release,
    generated,
    finalRevision,
    plan,
    aiRun,
    actionAiRun,
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
      expectedFinalActionItemCount: testCase.expectedFinalActionItemCount,
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
      gapQuestionnaireRevisionId: assessment?.currentRevisionId ?? null,
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
    actionAiRun,
    actionPlan: plan,
    automaticChecks,
  };
}

async function workGenerationJob(jobId: string, draftId: string) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    await runOneJob(`manual-gap-eval-${RUN_ID}-${randomUUID()}`);
    const current = await db.query.gapReassessmentDrafts.findFirst({
      columns: { status: true },
      where: {
        RAW: (table, operators) => eq(table.id, draftId) ?? operators.sql`true`,
      },
    });
    if (current?.status === "generated" || current?.status === "failed") {
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
      RAW: (table, operators) => eq(table.id, draftId) ?? operators.sql`true`,
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
      await runOneJob(`manual-gap-eval-retry-${RUN_ID}-${randomUUID()}`);
      const current = await db.query.gapReassessmentDrafts.findFirst({
        columns: { status: true },
        where: {
          RAW: (table, operators) =>
            eq(table.id, draftId) ?? operators.sql`true`,
        },
      });
      if (current?.status === "generated" || current?.status === "failed") {
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
        RAW: (table, operators) => eq(table.id, draftId) ?? operators.sql`true`,
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
      RAW: (table, operators) => eq(table.id, draftId) ?? operators.sql`true`,
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
  await enqueueActionPlanGeneration({
    userId: USER_ID,
    organizationId,
    sourceGapRevisionId: revisionId,
    publishedReleaseQa: true,
  });
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (
      await runOneJob(`manual-action-eval-${RUN_ID}-${suffix}-${randomUUID()}`)
    ) {
      const generated = await getCurrentActionPlan(USER_ID, organizationId);
      if (generated) return generated;
    }
    await delay(500);
  }
  throw new Error("Action Plan generation job did not complete");
}

async function clearReviewBlockers(input: {
  organizationId: string;
  sourceRevisionId: string;
  release: NonNullable<Awaited<ReturnType<typeof loadGapAnalysisRelease>>>;
  requirementCodes: string[];
  reason: (requirementCode: string) => string;
  resolutionReason: (requirementCode: string) => string;
}) {
  let currentRevisionId = input.sourceRevisionId;
  for (const requirementCode of input.requirementCodes) {
    const current = await captureRevision(currentRevisionId, input.release);
    const finding = current.findings.find(
      (candidate) => candidate.requirementCode === requirementCode,
    );
    if (!finding) {
      throw new Error(`Cannot resolve missing finding ${requirementCode}`);
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
  release: NonNullable<Awaited<ReturnType<typeof loadGapAnalysisRelease>>>,
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
      eq(gapRequirementVersions.id, gapFindings.requirementVersionId),
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
  const atomicGaps = rows.length
    ? await db
        .select()
        .from(gapItems)
        .where(
          inArray(
            gapItems.findingId,
            rows.map((row) => row.finding.id),
          ),
        )
        .orderBy(gapItems.findingId, gapItems.position)
    : [];
  const requirementByCode = new Map(
    release.requirements.map((requirement) => [requirement.code, requirement]),
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
          .filter((evidence) => evidence.findingId === row.finding.id)
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
        gaps: atomicGaps
          .filter((gap) => gap.findingId === row.finding.id)
          .map((gap) => ({
            id: gap.id,
            questionStableKey: gap.questionStableKey,
            sourceAssessmentAnswerId: gap.sourceAssessmentAnswerId,
            kind: gap.kind,
            statement: gap.statement,
            position: gap.position,
          })),
      };
    })
    .sort(
      (left, right) =>
        allCodes.indexOf(left.requirementCode as (typeof allCodes)[number]) -
        allCodes.indexOf(right.requirementCode as (typeof allCodes)[number]),
    );
  return { revision, findings };
}

async function captureAiRun(
  runId: string | null,
  generatedRevisionId: string | null,
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
    (generatedRevisionId
      ? await db.query.aiProcessingRuns.findFirst({
          where: {
            RAW: (table, operators) =>
              eq(table.outputArtifactRevisionId, generatedRevisionId) ??
              operators.sql`true`,
          },
        })
      : null);
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
      RAW: (table, operators) => eq(table.id, planId) ?? operators.sql`true`,
    },
  });
  if (!plan) throw new Error(`Action plan ${planId} not found`);
  const [job, jobResult] = await Promise.all([
    db.query.backgroundJobs.findFirst({
      where: {
        RAW: (table, operators) =>
          eq(table.id, plan.generationJobId) ?? operators.sql`true`,
      },
    }),
    db
      .select()
      .from(backgroundJobResults)
      .where(eq(backgroundJobResults.jobId, plan.generationJobId))
      .then((rows) => rows[0] ?? null),
  ]);
  const items = await db
    .select({
      item: actionPlanItems,
      sourceFinding: gapFindings,
      requirementCode: gapRequirements.code,
    })
    .from(actionPlanItems)
    .innerJoin(gapFindings, eq(gapFindings.id, actionPlanItems.sourceFindingId))
    .innerJoin(
      gapRequirementVersions,
      eq(gapRequirementVersions.id, gapFindings.requirementVersionId),
    )
    .innerJoin(
      gapRequirements,
      eq(gapRequirements.id, gapRequirementVersions.requirementId),
    )
    .where(eq(actionPlanItems.actionPlanId, planId));
  const links = items.length
    ? await db
        .select()
        .from(actionPlanItemGaps)
        .where(
          inArray(
            actionPlanItemGaps.actionPlanItemId,
            items.map((row) => row.item.id),
          ),
        )
    : [];
  return {
    plan,
    job,
    jobResult,
    items: items.map((row) => ({
      ...row.item,
      requirementCode: row.requirementCode,
      sourceFindingStatus: row.sourceFinding.status,
      sourceFindingSeverity: row.sourceFinding.severity,
      linkedGapIds: links
        .filter((link) => link.actionPlanItemId === row.item.id)
        .map((link) => link.gapItemId),
    })),
  };
}

function buildAutomaticChecks(input: {
  testCase: EvaluationCase;
  release: Awaited<ReturnType<typeof loadQaGapRelease>>;
  generated: Awaited<ReturnType<typeof captureRevision>>;
  finalRevision: Awaited<ReturnType<typeof captureRevision>>;
  plan: Awaited<ReturnType<typeof captureActionPlan>>;
  aiRun: Awaited<ReturnType<typeof captureAiRun>>;
  actionAiRun: Awaited<ReturnType<typeof captureAiRun>>;
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
      name: `${code} deterministic status`,
      passed: actual?.status === expected.status,
      expected: expected.status,
      actual: actual?.status ?? null,
    });
    checks.push({
      name: `${code} deterministic severity`,
      passed: actual?.severity === expected.severity,
      expected: expected.severity,
      actual: actual?.severity ?? null,
    });
    checks.push({
      name: `${code} mapped legal source`,
      passed:
        actual?.evidence.some(
          (evidence) => evidence.sourceType === "legal_source_chunk",
        ) ?? false,
      expected: "at least one legal_source_chunk",
      actual: actual?.evidence.map((evidence) => evidence.sourceType) ?? [],
    });
    checks.push({
      name: `${code} atomic Gap contract`,
      passed:
        expected.status === "fulfilled"
          ? actual?.gaps.length === 0
          : Boolean(actual?.gaps.length) &&
            actual!.gaps.every(
              (gap) =>
                gap.statement.trim().length > 0 &&
                !/[\r\n]/.test(gap.statement) &&
                gap.statement.trim().split(/\s+/).length <= 20,
            ),
      expected:
        expected.status === "fulfilled"
          ? "no atomic gaps"
          : "one or more one-line atomic gaps of at most 20 words",
      actual: actual?.gaps ?? [],
    });
  }

  checks.push({
    name: "Gap prompt and response contract",
    passed:
      input.aiRun?.run.promptVersion === input.release.prompt.version &&
      input.aiRun.run.responseSchemaVersion ===
        input.release.prompt.responseSchemaVersion,
    expected: {
      promptVersion: input.release.prompt.version,
      responseSchemaVersion: input.release.prompt.responseSchemaVersion,
    },
    actual: input.aiRun
      ? {
          promptVersion: input.aiRun.run.promptVersion,
          responseSchemaVersion: input.aiRun.run.responseSchemaVersion,
        }
      : null,
  });
  checks.push({
    name: "Independent Action Plan prompt and response contract",
    passed:
      input.plan.items.length === 0
        ? input.actionAiRun === null
        : input.actionAiRun?.run.operationKind === "action_plan_generation" &&
          input.actionAiRun.run.promptVersion ===
            input.release.actionPlanPrompt.version &&
          input.actionAiRun.run.responseSchemaVersion ===
            input.release.actionPlanPrompt.responseSchemaVersion,
    expected:
      input.plan.items.length === 0
        ? "deterministic empty plan without an AI run"
        : {
            operationKind: "action_plan_generation",
            promptVersion: input.release.actionPlanPrompt.version,
            responseSchemaVersion:
              input.release.actionPlanPrompt.responseSchemaVersion,
          },
    actual: input.actionAiRun?.run ?? null,
  });
  checks.push({
    name: "Generated category coverage",
    passed: input.generated.findings.length === 10,
    expected: 10,
    actual: input.generated.findings.length,
  });

  const finalGaps = input.finalRevision.findings.flatMap((finding) =>
    finding.gaps.map((gap) => ({ ...gap, findingId: finding.id })),
  );
  const linkedGapIds = new Set(
    input.plan.items.flatMap((item) => item.linkedGapIds),
  );
  checks.push({
    name: "Action coverage",
    passed:
      finalGaps.every((gap) => linkedGapIds.has(gap.id)) &&
      input.plan.items.every((item) => item.linkedGapIds.length > 0),
    expected: "every gap covered and every action linked",
    actual: {
      gapCount: finalGaps.length,
      linkedGapCount: linkedGapIds.size,
      actionCount: input.plan.items.length,
    },
  });

  for (const item of input.plan.items) {
    const source = input.finalRevision.findings.find(
      (finding) => finding.id === item.sourceFindingId,
    );
    const suggestedEvidence = Array.isArray(item.suggestedEvidence)
      ? item.suggestedEvidence
      : [];
    checks.push({
      name: `${item.requirementCode} simplified action`,
      passed:
        item.title.trim().length > 0 &&
        item.result.trim().length > 0 &&
        suggestedEvidence.length > 0 &&
        item.linkedGapIds.every((gapId) =>
          source?.gaps.some((gap) => gap.id === gapId),
        ) &&
        !("objective" in item) &&
        !("deliverables" in item) &&
        !("acceptanceCriteria" in item) &&
        !("sourceRecommendation" in item),
      expected: "title, result, evidence, and same-category gap links only",
      actual: {
        title: item.title,
        result: item.result,
        suggestedEvidence,
        linkedGapIds: item.linkedGapIds,
      },
    });
    checks.push({
      name: `${item.requirementCode} server-owned priority`,
      passed: item.priority === source?.severity,
      expected: source?.severity ?? null,
      actual: item.priority,
    });
  }

  if (input.testCase.contradictionRequirementCode) {
    const generatedTarget = input.generated.findings.find(
      (finding) =>
        finding.requirementCode === input.testCase.contradictionRequirementCode,
    );
    const finalTarget = input.finalRevision.findings.find(
      (finding) =>
        finding.requirementCode === input.testCase.contradictionRequirementCode,
    );
    checks.push({
      name: "Contradiction remains visible without blocking generation",
      passed:
        generatedTarget?.requiresReview === true &&
        Boolean(generatedTarget.reviewNotice?.trim()) &&
        input.expectedFinalizationBlock?.blocked === false,
      expected: true,
      actual: {
        requiresReview: generatedTarget?.requiresReview ?? null,
        reviewNotice: generatedTarget?.reviewNotice ?? null,
        finalization: input.expectedFinalizationBlock,
      },
    });
    checks.push({
      name: "Correction has distinct atomic generation lineage",
      passed:
        Boolean(generatedTarget?.generationRunId) &&
        Boolean(finalTarget?.generationRunId) &&
        generatedTarget?.generationRunId !== finalTarget?.generationRunId,
      expected: "different non-null generation run IDs",
      actual: {
        generated: generatedTarget?.generationRunId ?? null,
        final: finalTarget?.generationRunId ?? null,
      },
    });
  }

  return checks;
}

async function enableOpenAi(organizationId: string) {
  const policy = await getOrganizationAiProviderPolicy(USER_ID, organizationId);
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

async function writeJson(path: string, value: unknown) {
  await writeFile(path, `${JSON.stringify(value, jsonReplacer, 2)}\n`, "utf8");
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
  const delayMs = Number(process.env.MANUAL_GAP_EVAL_REGEN_DELAY_MS ?? 65_000);
  if (Number.isFinite(delayMs) && delayMs > 0) {
    await delay(delayMs);
  }
}

async function retryProviderStep<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === 3 || !isRetryableProviderError(error)) {
        throw error;
      }
      await waitForProviderWindow();
    }
  }
  throw new Error("Provider retry loop exhausted");
}

function isRetryableProviderError(error: unknown) {
  let current = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (!current || typeof current !== "object") return false;
    const value = current as {
      name?: unknown;
      statusCode?: unknown;
      cause?: unknown;
    };
    if (
      (typeof value.name === "string" && value.name.startsWith("AI_")) ||
      value.statusCode === 429 ||
      (typeof value.statusCode === "number" && value.statusCode >= 500)
    ) {
      return true;
    }
    current = value.cause;
  }
  return false;
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
  for (const name of ["DATABASE_URL", "OPENAI_API_KEY", "OPENAI_MODEL"]) {
    if (!process.env[name]?.trim()) {
      throw new Error(`${name} is required`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDbConnection());
