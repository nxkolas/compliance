import "dotenv/config";

import { and, eq, isNotNull } from "drizzle-orm";
import { closeDbConnection, db } from "@/src/db";
import {
  aiProcessingRuns,
  assessments,
  auditEvents,
  backgroundJobs,
  generatedArtifactRevisions,
} from "@/src/db/schema";
import {
  getApplicabilityQuestionnaireForUser,
  getApplicabilityRecalculationLockForUser,
  submitApplicabilityCheckForUser,
  type ApplicabilityAnswerValue,
} from "@/src/server/applicability-check";
import { ApiError } from "@/src/server/api/errors";
import { directRuntimeReleaseReader } from "@/src/server/compliance";
import {
  createDatabaseGapPageReader,
  createOrOpenGapAssessment,
  directGapReleaseReader,
  getGapAnalysisWorkflow,
} from "@/src/server/gap-analysis";
import {
  createOrganizationForUser,
  listOrganizationsForUser,
} from "@/src/server/organizations/service";

const userId = required("REMEDIATION_SMOKE_USER_ID");
const fixtureName = "Country support acceptance fixture";

const relevantEuAnswers: Record<string, ApplicabilityAnswerValue> = {
  "bc.eu_activity": "yes",
  "bc.jurisdiction_country": "FR",
  "bc.jurisdiction_basis": "establishment",
  "bc.entity_types": ["electricity_supplier"],
  "bc.member_state_designation": "none",
  "bc.employee_count": "50_249",
  "bc.annual_revenue": "revenue_over_10m_to_50m",
  "bc.balance_sheet_total": "balance_over_10m_to_43m",
  "bc.sme_figures_verified": "yes",
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
      legalName: "Country Support Acceptance SAS",
      country: "FR",
    }));
  if (organization.country !== "FR") {
    throw new Error("Country-support fixture organization must use FR");
  }

  const questionnaire = await getApplicabilityQuestionnaireForUser(
    userId,
    organization.id,
    "en",
    { runtimeReleaseReader: directRuntimeReleaseReader },
  );
  if (!questionnaire) {
    throw new Error("Active applicability questionnaire is unavailable");
  }
  const countryQuestion = questionnaire.questions.find(
    (question) => question.stableKey === "bc.jurisdiction_country",
  );
  if (
    !countryQuestion ||
    questionnaire.latestAnswers[countryQuestion.id] === undefined &&
      questionnaire.defaultAnswers[countryQuestion.id] !== "FR"
  ) {
    throw new Error("Organization country FR did not prefill the questionnaire");
  }

  const unsupported = await submitApplicabilityCheckForUser(
    userId,
    organization.id,
    {
      answers: questionnaire.questions.map((question) => {
        const value = relevantEuAnswers[question.stableKey];
        if (value === undefined) {
          throw new Error(`No country-support answer for ${question.stableKey}`);
        }
        return { questionId: question.id, value };
      }),
    },
    { runtimeReleaseReader: directRuntimeReleaseReader },
  );
  if (
    unsupported.result.outcome !== "clarification_required" ||
    !unsupported.evidence.unresolvedFactCodes.includes(
      "unresolved_unsupported_profile",
    )
  ) {
    throw new Error("FR with relevant EU activity was not stored as unsupported");
  }
  await assertApprovedRevision(unsupported.artifactRevisionId);
  const reader = createDatabaseGapPageReader(
    directGapReleaseReader,
    directRuntimeReleaseReader,
  );
  const unsupportedWorkflow = await getGapAnalysisWorkflow(
    {
      userId,
      organizationId: organization.id,
      locale: "en",
    },
    reader,
    directGapReleaseReader,
  );
  if (
    unsupportedWorkflow.prerequisite.satisfied ||
    unsupportedWorkflow.prerequisite.status !== "not_eligible" ||
    unsupportedWorkflow.prerequisite.reason !== "unsupported_country"
  ) {
    throw new Error("Gap workflow did not report unsupported_country");
  }

  let rejection: unknown;
  try {
    await createOrOpenGapAssessment(userId, organization.id);
  } catch (error) {
    rejection = error;
  }
  if (
    !(rejection instanceof ApiError) ||
    rejection.status !== 409 ||
    rejection.code !== "GAP_APPLICABILITY_NOT_ELIGIBLE"
  ) {
    throw new Error("Ineligible assessment creation did not return the stable 409");
  }
  await assertNoGapSideEffects(organization.id);
  const firstLock = await getApplicabilityRecalculationLockForUser(
    userId,
    organization.id,
  );
  if (firstLock.locked) {
    throw new Error("Unsupported-country result locked recalculation");
  }

  const noActivity = await submitApplicabilityCheckForUser(
    userId,
    organization.id,
    {
      answers: [
        {
          questionId: questionnaire.questions.find(
            (question) => question.stableKey === "bc.eu_activity",
          )?.id ?? "",
          value: "no",
        },
      ],
    },
    { runtimeReleaseReader: directRuntimeReleaseReader },
  );
  if (noActivity.result.outcome !== "not_directly_in_scope") {
    throw new Error("FR without relevant EU activity was not outside direct scope");
  }
  const noActivityWorkflow = await getGapAnalysisWorkflow(
    {
      userId,
      organizationId: organization.id,
      locale: "en",
    },
    reader,
    directGapReleaseReader,
  );
  if (
    noActivityWorkflow.prerequisite.satisfied ||
    noActivityWorkflow.prerequisite.reason !== "not_directly_in_scope"
  ) {
    throw new Error("Gap workflow did not remain blocked outside direct scope");
  }
  await assertNoGapSideEffects(organization.id);
  const secondLock = await getApplicabilityRecalculationLockForUser(
    userId,
    organization.id,
  );
  if (secondLock.locked) {
    throw new Error("Not-directly-in-scope result locked recalculation");
  }

  console.log(
    JSON.stringify(
      {
        organizationId: organization.id,
        organizationCountry: organization.country,
        defaultJurisdiction: "FR",
        unsupportedOutcome: unsupported.result.outcome,
        unsupportedReason: unsupportedWorkflow.prerequisite.reason,
        assessmentRejectionCode: rejection.code,
        noActivityOutcome: noActivity.result.outcome,
        noActivityReason: noActivityWorkflow.prerequisite.reason,
        gapAssessmentCount: 0,
        backgroundJobCount: 0,
        aiProcessingRunCount: 0,
        recalculationLocked: false,
        aiProviderCalled: false,
      },
      null,
      2,
    ),
  );
}

async function assertApprovedRevision(revisionId: string) {
  const revision = await db.query.generatedArtifactRevisions.findFirst({
    columns: { status: true },
    where: eq(generatedArtifactRevisions.id, revisionId),
  });
  if (revision?.status !== "approved") {
    throw new Error("Applicability artifact was not approved");
  }
}

async function assertNoGapSideEffects(organizationId: string) {
  const [gapAssessment, job, aiRun, audit] = await Promise.all([
    db.query.assessments.findFirst({
      columns: { id: true },
      where: and(
        eq(assessments.organizationId, organizationId),
        isNotNull(assessments.gapAnalysisReleaseId),
      ),
    }),
    db.query.backgroundJobs.findFirst({
      columns: { id: true },
      where: eq(backgroundJobs.organizationId, organizationId),
    }),
    db.query.aiProcessingRuns.findFirst({
      columns: { id: true },
      where: eq(aiProcessingRuns.organizationId, organizationId),
    }),
    db.query.auditEvents.findFirst({
      columns: { id: true },
      where: and(
        eq(auditEvents.organizationId, organizationId),
        eq(auditEvents.eventType, "gap_assessment.created"),
      ),
    }),
  ]);
  if (gapAssessment || job || aiRun || audit) {
    throw new Error("Ineligible Gap path persisted a forbidden side effect");
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
