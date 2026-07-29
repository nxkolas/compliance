import "dotenv/config";

import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { and, eq, isNotNull } from "drizzle-orm";
import { closeDbConnection, db } from "@/src/db";
import { generatedArtifactRevisions, generatedArtifacts } from "@/src/db/schema";
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
import {
  correctGapRevision,
  createDatabaseGapPageReader,
  createOrOpenGapAssessment,
  directGapReleaseReader,
  generateGapReassessment,
  getActiveGapAnalysisRelease,
  getGapAnalysisWorkflow,
  prepareGapReassessment,
  retryGapReassessment,
  saveQuestionnaireDraftAnswer,
  submitGapQuestionnaire,
} from "@/src/server/gap-analysis";
import {
  getOrganizationAiProviderPolicy,
  updateOrganizationAiProviderPolicy,
} from "@/src/server/organizations/ai-provider-policy-service";
import {
  createOrganizationForUser,
  listOrganizationsForUser,
} from "@/src/server/organizations/service";
import { runOneJob } from "@/src/worker/runtime";

const userId = required("REMEDIATION_SMOKE_USER_ID");
const fixtureName = "Database remediation acceptance fixture";

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

async function main() {
  const existing = (await listOrganizationsForUser(userId)).find(
    (organization) => organization.name === fixtureName,
  );
  const organization =
    existing ??
    (await createOrganizationForUser(userId, {
      name: fixtureName,
      legalName: "Database Remediation Acceptance Fixture GmbH",
      country: "DE",
    }));
  await enableOpenAiForFixture(organization.id);
  process.env.AI_DEFAULT_PROVIDER = "openai";

  let assessment = await db.query.assessments.findFirst({
    columns: {
      id: true,
      applicabilityArtifactRevisionId: true,
      currentRevisionId: true,
    },
    where: { RAW: (table, operators) => (and(
      eq(table.organizationId, organization.id),
      eq(table.status, "active"),
      isNotNull(table.gapAnalysisReleaseId),
    )) ?? operators.sql`true` },
    orderBy: { createdAt: "desc" },
  });
  let applicabilityArtifactRevisionId = assessment?.applicabilityArtifactRevisionId;
  let questionnaireRevisionId = assessment?.currentRevisionId;
  if (!assessment?.currentRevisionId) {
    if (!assessment) {
      const questionnaire = await getApplicabilityQuestionnaireForUser(
        userId,
        organization.id,
        "de",
        { runtimeReleaseReader: directRuntimeReleaseReader },
      );
      if (!questionnaire) {
        throw new Error("Active applicability questionnaire is unavailable");
      }
      const applicability = await submitApplicabilityCheckForUser(
        userId,
        organization.id,
        {
          answers: questionnaire.questions.map((question) => {
            const value = applicabilityFacts[question.stableKey];
            if (value === undefined) {
              throw new Error(`No acceptance answer for ${question.stableKey}`);
            }
            return { questionId: question.id, value };
          }),
        },
        { runtimeReleaseReader: directRuntimeReleaseReader },
      );
      if (applicability.result.outcome !== "essential_entity") {
        throw new Error(
          `Acceptance applicability outcome was ${applicability.result.outcome}`,
        );
      }
      applicabilityArtifactRevisionId = applicability.artifactRevisionId;
    }
    const createdAssessment = await createOrOpenGapAssessment(
      userId,
      organization.id,
    );
    assessment = createdAssessment;
    const release = await getActiveGapAnalysisRelease("nis2-gap", "de");
    if (!release) throw new Error("Active Gap release is unavailable");
    const questionnaireDraft =
      await db.query.gapQuestionnaireDrafts.findFirst({
        columns: { id: true, version: true },
        where: {
          RAW: (table, operators) =>
            and(
              eq(table.assessmentId, createdAssessment.id),
              eq(table.status, "open"),
            ) ?? operators.sql`true`,
        },
      });
    if (!questionnaireDraft) {
      throw new Error("Gap questionnaire draft is unavailable");
    }
    let draftVersion = questionnaireDraft.version;
    for (const question of release.questions.filter(
      (candidate) => candidate.required,
    )) {
      const option = question.options[0];
      if (!option) {
        throw new Error(`Gap question ${question.stableKey} has no option`);
      }
      const saved = await saveQuestionnaireDraftAnswer({
        userId,
        organizationId: organization.id,
        draftId: questionnaireDraft.id,
        questionId: question.id,
        optionId: option.id,
        expectedVersion: draftVersion,
      });
      draftVersion = saved.version;
    }
    const questionnaireRevision = await submitGapQuestionnaire({
      userId,
      organizationId: organization.id,
      assessmentId: createdAssessment.id,
      draftId: questionnaireDraft.id,
      expectedVersion: draftVersion,
    });
    questionnaireRevisionId = questionnaireRevision.id;
  }

  let draft = await db.query.gapReassessmentDrafts.findFirst({
    columns: {
      id: true,
      generationJobId: true,
      status: true,
      lockVersion: true,
    },
    where: { RAW: (table, operators) => (and(
      eq(table.organizationId, organization.id),
      eq(table.assessmentId, assessment.id),
    )) ?? operators.sql`true` },
    orderBy: { createdAt: "desc" },
  });
  if (!draft) {
    const prepared = await prepareGapReassessment({
      userId,
      organizationId: organization.id,
      assessmentId: assessment.id,
      selectedDocumentIds: [],
      locale: "de",
    });
    if (!prepared) throw new Error("Gap generation draft was not prepared");
    draft = prepared.draft;
  }

  let generationJobId = draft.generationJobId;
  if (draft.status === "open") {
    const generation = await generateGapReassessment({
      userId,
      organizationId: organization.id,
      draftId: draft.id,
      expectedLockVersion: draft.lockVersion,
      locale: "de",
      idempotencyKey: `remediation-gap-generate-${randomUUID()}`,
    });
    generationJobId = generation.job.id;
  } else if (draft.status === "failed") {
    const generation = await retryGapReassessment({
      userId,
      organizationId: organization.id,
      draftId: draft.id,
      retryNonce: randomUUID(),
      idempotencyKey: `remediation-gap-retry-${randomUUID()}`,
    });
    generationJobId = generation.job.id;
  }

  if (draft.status !== "generated") {
    const worked = await runOneJobWithClockSkewTolerance();
    if (!worked) throw new Error("The queued Gap generation job was not leased");
  }
  const completedDraft = await db.query.gapReassessmentDrafts.findFirst({
    where: { RAW: (table, operators) => (eq(table.id, draft.id)) ?? operators.sql`true` },
    columns: {
      generationJobId: true,
      outputGapRevisionId: true,
      status: true,
    },
  });
  if (
    completedDraft?.generationJobId !== generationJobId ||
    completedDraft.status !== "generated" ||
    !completedDraft.outputGapRevisionId
  ) {
    throw new Error("Gap generation did not produce a revision");
  }

  const generated = await requireGapRevision(
    organization.id,
    completedDraft.outputGapRevisionId,
  );
  assertMetadataOnly(generated.result, "generated");
  const generatedFindings = await db.query.gapFindings.findMany({
    columns: {
      id: true,
      requiresReview: true,
    },
    where: { RAW: (table, operators) => (eq(table.artifactRevisionId, generated.id)) ?? operators.sql`true` },
  });
  if (!generatedFindings.length) {
    throw new Error("Generated Gap revision has no findings");
  }
  const existingPlan = await getCurrentActionPlan(userId, organization.id);
  if (existingPlan) {
    const pageReader = createDatabaseGapPageReader(
      directGapReleaseReader,
      directRuntimeReleaseReader,
    );
    const [workflow, repeatedWorkflow] = await Promise.all([
      getGapAnalysisWorkflow({
        userId,
        organizationId: organization.id,
        locale: "de",
      }, pageReader, directGapReleaseReader),
      getGapAnalysisWorkflow({
        userId,
        organizationId: organization.id,
        locale: "de",
      }, pageReader, directGapReleaseReader),
    ]);
    const acceptedRevisionId =
      existingPlan.plan.sourceGapArtifactRevisionId;
    if (
      workflow.revision?.id !== acceptedRevisionId ||
      repeatedWorkflow.revision?.id !== acceptedRevisionId ||
      workflow.findings.length !== repeatedWorkflow.findings.length
    ) {
      throw new Error(
        "Resumed finalized workflow is not stable or does not match its plan",
      );
    }
    const accepted = await requireGapRevision(
      organization.id,
      acceptedRevisionId,
    );
    assertMetadataOnly(accepted.result, "accepted");
    printResult({
      organizationId: organization.id,
      applicabilityRevisionId: applicabilityArtifactRevisionId,
      gapAssessmentId: assessment.id,
      gapQuestionnaireRevisionId: questionnaireRevisionId,
      generationJobId,
      generatedRevisionId: generated.id,
      correctedRevisionId: accepted.id,
      actionPlanId: existingPlan.plan.id,
      findingCount: workflow.findings.length,
      resumedFinalized: true,
    });
    return;
  }
  const correctionTarget =
    generatedFindings.find((finding) => finding.requiresReview) ??
    generatedFindings[0]!;
  const corrections = [{
    findingId: correctionTarget.id,
    ...(correctionTarget.requiresReview
      ? {
          requiresReview: false,
          resolutionReason:
            "Acceptance operator resolved the generated review blocker.",
        }
      : {}),
    reason: "Database remediation acceptance correction",
  }];
  const corrected = await correctGapRevision({
    userId,
    organizationId: organization.id,
    sourceRevisionId: generated.id,
    corrections,
  });
  assertMetadataOnly(corrected.result, "corrected");

  await enqueueActionPlanGeneration({
    userId,
    organizationId: organization.id,
    sourceGapRevisionId: corrected.id,
  });
  const actionWorked = await runOneJobWithClockSkewTolerance();
  if (!actionWorked) {
    throw new Error("The queued Action Plan generation job was not leased");
  }
  const pageReader = createDatabaseGapPageReader(
    directGapReleaseReader,
    directRuntimeReleaseReader,
  );
  const [workflow, repeatedWorkflow, currentPlan] = await Promise.all([
    getGapAnalysisWorkflow({
      userId,
      organizationId: organization.id,
      locale: "de",
    }, pageReader, directGapReleaseReader),
    getGapAnalysisWorkflow({
      userId,
      organizationId: organization.id,
      locale: "de",
    }, pageReader, directGapReleaseReader),
    getCurrentActionPlan(userId, organization.id),
  ]);
  if (
    workflow.revision?.id !== corrected.id ||
    repeatedWorkflow.revision?.id !== corrected.id ||
    workflow.findings.length !== generatedFindings.length ||
    !currentPlan
  ) {
    throw new Error(
      "Read-only workflow does not reflect the finalized correction",
    );
  }

  printResult({
    organizationId: organization.id,
    applicabilityRevisionId: applicabilityArtifactRevisionId,
    gapAssessmentId: assessment.id,
    gapQuestionnaireRevisionId: questionnaireRevisionId,
    generationJobId,
    generatedRevisionId: generated.id,
    correctedRevisionId: corrected.id,
    actionPlanId: currentPlan.plan.id,
    findingCount: workflow.findings.length,
    resumedFinalized: false,
  });
}

function printResult(input: {
  organizationId: string;
  applicabilityRevisionId: string | null | undefined;
  gapAssessmentId: string;
  gapQuestionnaireRevisionId: string | null | undefined;
  generationJobId: string | null;
  generatedRevisionId: string;
  correctedRevisionId: string;
  actionPlanId: string;
  findingCount: number;
  resumedFinalized: boolean;
}) {
  console.log(
    JSON.stringify(
      {
        ...input,
        userId,
        repeatedReadStable: true,
        metadataOnlyGapPayloads: true,
      },
      null,
      2,
    ),
  );
}

async function enableOpenAiForFixture(organizationId: string) {
  const policy = await getOrganizationAiProviderPolicy(userId, organizationId);
  if (
    policy.externalDisclosureAllowed &&
    Array.isArray(policy.allowedProviderModes) &&
    policy.allowedProviderModes.includes("openai")
  ) {
    return;
  }
  await updateOrganizationAiProviderPolicy({
    userId,
    organizationId,
    openAiDisclosureApproved: true,
    expectedVersion: policy.version,
    requestId: `remediation-smoke-${randomUUID()}`,
  });
}

async function runOneJobWithClockSkewTolerance() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await runOneJob(`remediation-smoke-${randomUUID()}`)) return true;
    await delay(250);
  }
  return false;
}

async function requireGapRevision(
  organizationId: string,
  revisionId: string,
) {
  const [row] = await db
    .select({ revision: generatedArtifactRevisions })
    .from(generatedArtifactRevisions)
    .innerJoin(
      generatedArtifacts,
      eq(generatedArtifacts.id, generatedArtifactRevisions.artifactId),
    )
    .where(
      and(
        eq(generatedArtifactRevisions.id, revisionId),
        eq(generatedArtifacts.organizationId, organizationId),
        eq(generatedArtifacts.artifactType, "gap_analysis_result"),
      ),
    )
    .limit(1);
  if (!row) throw new Error(`Gap revision ${revisionId} was not found`);
  return row.revision;
}

function assertMetadataOnly(value: unknown, label: string) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (value as Record<string, unknown>).schemaKind !==
      "gap_revision_metadata_v1" ||
    "findings" in value
  ) {
    throw new Error(`${label} Gap revision is not metadata-only`);
  }
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDbConnection());
