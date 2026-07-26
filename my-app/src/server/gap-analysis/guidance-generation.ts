import { db } from "@/src/db";
import {
  assessmentAnswerOptions,
  questionOptions,
} from "@/src/db/schema";
import type { Locale } from "@/lib/i18n-config";
import { eq, inArray } from "drizzle-orm";
import { runGroundedOperation } from "../ai/grounding/gateway";
import type { GroundingContextItem } from "../ai/grounding/types";
import {
  buildGapModelResponseSchemaV6,
  extractGapGeneratedProseV6,
  normalizeGroundedGapModelResponseV6,
  type GapGuidanceResponsePolicy,
  type GroundedGapModelResponseV6,
  type ValidatedGapGuidance,
} from "./generation-schema-v6";
import type { GapGuidancePolicy } from "./guidance-policy";
import {
  buildGapGuidanceQueryV6,
  buildGapRetrievalQueryV6,
  GAP_PROMPT_V6_NAME,
  GAP_PROMPT_V6_TEMPLATE,
  GAP_PROMPT_V6_TEMPLATE_HASH,
  GAP_PROMPT_V6_VERSION,
  GAP_RESPONSE_SCHEMA_V6_VERSION,
} from "./prompt-contract-v6";
import type {
  LoadedGapRelease,
} from "./release-loader";

type GuidanceRequirementInput = {
  requirement: LoadedGapRelease["requirements"][number];
  policy: GapGuidancePolicy;
  forcedEvidenceSufficiency?: "sufficient" | "partial" | "none";
  forcedRequiresReview?: boolean;
  reviewCorrection?: {
    reason: string;
    resolutionReason?: string;
  };
};

export async function generateGapGuidance(input: {
  actor: { userId: string };
  organizationId: string;
  assessmentRevisionId: string;
  release: LoadedGapRelease;
  requirement: LoadedGapRelease["requirements"][number];
  policy: GapGuidancePolicy;
  selectedDocumentVersionIds: string[];
  outputLocale: Locale;
  idempotencyKey: string;
  asOfDate?: string;
  runOperationKind?: "gap_analysis" | "gap_guidance_regeneration";
  forcedEvidenceSufficiency?: "sufficient" | "partial" | "none";
  forcedRequiresReview?: boolean;
  reviewCorrection?: {
    reason: string;
    resolutionReason?: string;
  };
}): Promise<{
  runId: string;
  guidance: ValidatedGapGuidance;
  context: GroundingContextItem[];
}> {
  const questionnaireAssertions = await loadQuestionnaireAssertions({
    assessmentRevisionId: input.assessmentRevisionId,
    release: input.release,
    requirements: [
      {
        requirement: input.requirement,
        policy: input.policy,
        forcedEvidenceSufficiency:
          input.forcedEvidenceSufficiency,
        forcedRequiresReview: input.forcedRequiresReview,
        reviewCorrection: input.reviewCorrection,
      },
    ],
  });
  const result = await generateGapGuidanceBatch({
    ...input,
    requirements: [
      {
        requirement: input.requirement,
        policy: input.policy,
        forcedEvidenceSufficiency:
          input.forcedEvidenceSufficiency,
        forcedRequiresReview: input.forcedRequiresReview,
        reviewCorrection: input.reviewCorrection,
      },
    ],
    questionnaireAssertions,
  });
  const guidance = result.guidance[0];
  if (!guidance) throw new Error("Gap guidance generation returned no finding");
  return { runId: result.runId, guidance, context: result.context };
}

export async function generateGapGuidanceBatch(input: {
  actor: { userId: string };
  organizationId: string;
  assessmentRevisionId: string;
  release: LoadedGapRelease;
  requirements: GuidanceRequirementInput[];
  selectedDocumentVersionIds: string[];
  outputLocale: Locale;
  idempotencyKey: string;
  questionnaireAssertions: Array<{
    answerId: string;
    queryUnitId: string;
    excerpt: string;
  }>;
  asOfDate?: string;
  jobId?: string;
  runOperationKind?: "gap_analysis" | "gap_guidance_regeneration";
}) {
  if (
    input.release.prompt.version !== GAP_PROMPT_V6_VERSION ||
    input.release.prompt.responseSchemaVersion !==
      GAP_RESPONSE_SCHEMA_V6_VERSION ||
    input.release.prompt.templateHash !== GAP_PROMPT_V6_TEMPLATE_HASH
  ) {
    throw new Error("Gap guidance v6 requires the immutable v6 contract");
  }
  const queryUnits = input.requirements.map(
    ({ requirement, policy, reviewCorrection }) => ({
    id: requirement.code,
    query: buildGapGuidanceQueryV6({
      requirement,
      policy,
      reviewCorrection,
    }),
    retrievalQuery: buildGapRetrievalQueryV6({
      requirement,
      policy,
    }),
    preferredMappedLegalProvisionIds:
      policy.preferredLegalProvisionIds,
    preferredMappedLegalProvisionKeys:
      policy.preferredLegalProvisionKeys,
    legalTierLimits: {
      primary_authority: 0,
      official_guidance: 0,
      curated_secondary: 0,
    },
    }),
  );
  let responsePolicies: GapGuidanceResponsePolicy[] = [];
  const grounded = await runGroundedOperation<GroundedGapModelResponseV6>({
    operation: "gap_analysis",
    runOperationKind: input.runOperationKind,
    actor: input.actor,
    organizationId: input.organizationId,
    outputLocale: input.outputLocale,
    workflowReleaseId: input.release.id,
    asOfDate:
      input.asOfDate ?? new Date().toISOString().slice(0, 10),
    organizationEvidenceVersionIds:
      input.selectedDocumentVersionIds,
    questionnaireAssertions: input.questionnaireAssertions,
    queryUnits,
    systemInstruction: GAP_PROMPT_V6_TEMPLATE,
    outputContract: {
      schema(context) {
        responsePolicies = buildResponsePolicies(
          input.requirements,
          context,
          input.outputLocale,
        );
        return buildGapModelResponseSchemaV6(responsePolicies);
      },
      languagePolicy: "localized",
      generatedProse: extractGapGeneratedProseV6,
      claims(output) {
        const normalized = normalizeGroundedGapModelResponseV6({
          value: output,
          policies: responsePolicies,
        });
        return normalized.map((finding) => ({
          key: `gap-guidance:${finding.requirementCode}`,
          queryUnitId: finding.requirementCode,
          kind: "legal" as const,
          binding: true,
          citationIds: finding.citations,
          text: JSON.stringify({
            guidanceMode: finding.guidanceMode,
            evidenceSufficiency: finding.evidenceSufficiency,
            rationale: finding.rationale,
            recommendation: finding.recommendation,
            objective: finding.objective,
          }),
        }));
      },
      allowConflictingClaim(output, claim) {
        const requirementInput = input.requirements.find(
          ({ requirement }) =>
            requirement.code === claim.queryUnitId,
        );
        return (
          output.findings[claim.queryUnitId]?.requiresReview === true ||
          Boolean(
            requirementInput?.reviewCorrection?.resolutionReason?.trim(),
          )
        );
      },
    },
    idempotencyKey: input.idempotencyKey,
    assessmentRevisionId: input.assessmentRevisionId,
    jobId: input.jobId,
    promptMetadata: {
      name: GAP_PROMPT_V6_NAME,
      version: GAP_PROMPT_V6_VERSION,
      templateHash: GAP_PROMPT_V6_TEMPLATE_HASH,
      responseSchemaVersion: GAP_RESPONSE_SCHEMA_V6_VERSION,
    },
  });
  if (responsePolicies.length === 0) {
    responsePolicies = buildResponsePolicies(
      input.requirements,
      grounded.context,
      input.outputLocale,
    );
  }
  return {
    runId: grounded.runId,
    outputLocale: grounded.outputLocale,
    context: grounded.context,
    guidance: normalizeGroundedGapModelResponseV6({
      value: grounded.output,
      policies: responsePolicies,
    }),
  };
}

function buildResponsePolicies(
  requirements: GuidanceRequirementInput[],
  context: GroundingContextItem[],
  outputLocale: Locale,
): GapGuidanceResponsePolicy[] {
  return requirements.map(
    ({
      requirement,
      policy,
      forcedEvidenceSufficiency,
      forcedRequiresReview,
    }) => {
    const supplied = context.filter(
      (item) => item.queryUnitId === requirement.code,
    );
    return {
      requirementCode: requirement.code,
      outputLocale,
      policy,
      permittedCitationIds: supplied.map((item) => item.citationId),
      admittedOrganizationCitationIds: supplied
        .filter((item) => item.channel === "organization_document")
        .map((item) => item.citationId),
      preferredPrimaryLegalCitationIds: supplied
        .filter(
          (item) =>
            item.channel === "legal" &&
            item.metadata.selectionRole === "mapped_primary",
        )
        .map((item) => item.citationId),
      forcedEvidenceSufficiency,
      forcedRequiresReview,
    };
  });
}

async function loadQuestionnaireAssertions(input: {
  assessmentRevisionId: string;
  release: LoadedGapRelease;
  requirements: GuidanceRequirementInput[];
}) {
  const stableKeys = new Set(
    input.requirements.flatMap(({ requirement }) =>
      requirement.questionStableKeys,
    ),
  );
  const answers = await db.query.assessmentAnswers.findMany({
    columns: {
      id: true,
      questionId: true,
      questionStableKey: true,
    },
    where: {
      RAW: (table, operators) =>
        eq(table.assessmentRevisionId, input.assessmentRevisionId) ??
        operators.sql`true`,
    },
  });
  const relevantAnswers = answers.filter((answer) =>
    stableKeys.has(answer.questionStableKey),
  );
  const options = relevantAnswers.length
    ? await db
        .select({
          answerId: assessmentAnswerOptions.assessmentAnswerId,
          stableValue: questionOptions.stableValue,
        })
        .from(assessmentAnswerOptions)
        .innerJoin(
          questionOptions,
          eq(
            assessmentAnswerOptions.questionOptionId,
            questionOptions.id,
          ),
        )
        .where(
          inArray(
            assessmentAnswerOptions.assessmentAnswerId,
            relevantAnswers.map((answer) => answer.id),
          ),
        )
    : [];
  return input.requirements.flatMap(({ requirement }) =>
    relevantAnswers
      .filter((answer) =>
        requirement.questionStableKeys.includes(
          answer.questionStableKey,
        ),
      )
      .map((answer) => {
        const question = input.release.questions.find(
          (candidate) => candidate.id === answer.questionId,
        );
        const stableValues = options
          .filter((option) => option.answerId === answer.id)
          .map((option) => option.stableValue);
        return {
          answerId: answer.id,
          queryUnitId: requirement.code,
          excerpt: `${question?.questionText ?? answer.questionStableKey}: ${stableValues.join(", ")}`,
        };
      }),
  );
}
