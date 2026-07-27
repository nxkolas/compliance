import { runGroundedOperation } from "../ai/grounding/gateway";
import type { GroundingContextItem } from "../ai/grounding/types";
import type { Locale } from "@/lib/i18n-config";
import {
  buildGapModelResponseSchemaV7,
  deriveAtomicGapKind,
  normalizeGroundedGapModelResponseV7,
  type GapResponsePolicyV7,
  type GroundedGapModelResponseV7,
  type ValidatedCategoryGapResult,
} from "./generation-schema-v7";
import type { AtomicGapTriggerPolicy } from "./trigger-policy";
import { atomicGapGroundedClaims } from "./grounded-claims";
import {
  buildAtomicGapQuery,
  buildAtomicGapOrganizationRetrievalQuery,
  buildAtomicGapRetrievalQuery,
  GAP_PROMPT_V7_NAME,
  GAP_PROMPT_V7_TEMPLATE,
  GAP_PROMPT_V7_TEMPLATE_HASH,
  GAP_PROMPT_V7_VERSION,
  GAP_RESPONSE_SCHEMA_V7_VERSION,
} from "./prompt-contract-v7";
import type { LoadedGapRelease } from "./release-loader";

export type AtomicGapRequirementInput = {
  requirement: LoadedGapRelease["requirements"][number];
  determinedStatus:
    | "fulfilled"
    | "partially_fulfilled"
    | "not_fulfilled"
    | "insufficient_evidence";
  policy: AtomicGapTriggerPolicy;
  sourceAssessmentAnswerIdByQuestion: Record<string, string>;
  forcedEvidenceSufficiency?: "sufficient" | "partial" | "none";
  forcedRequiresReview?: boolean;
  reviewCorrection?: {
    reason: string;
    resolutionReason?: string;
  };
};

export async function generateAtomicGapBatch(input: {
  actor: { userId: string };
  organizationId: string;
  assessmentRevisionId: string;
  release: LoadedGapRelease;
  requirements: AtomicGapRequirementInput[];
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
}): Promise<{
  runId: string;
  outputLocale: Locale;
  context: GroundingContextItem[];
  findings: ValidatedCategoryGapResult[];
}> {
  if (
    input.release.prompt.version !== GAP_PROMPT_V7_VERSION ||
    input.release.prompt.responseSchemaVersion !==
      GAP_RESPONSE_SCHEMA_V7_VERSION ||
    input.release.prompt.templateHash !== GAP_PROMPT_V7_TEMPLATE_HASH
  ) {
    throw new Error("Atomic Gap generation requires the immutable v7 contract");
  }
  const queryUnits = input.requirements.map((item) => ({
    id: item.requirement.code,
    query: buildAtomicGapQuery({
      requirement: item.requirement,
      policy: provisionalResponsePolicy(item, input.outputLocale),
      questions: input.release.questions.map((question) => ({
        stableKey: question.stableKey,
        text: question.questionText,
      })),
      reviewCorrection: item.reviewCorrection,
    }),
    retrievalQuery: buildAtomicGapRetrievalQuery({
      requirement: item.requirement,
      triggerQuestionTexts: item.policy.triggeringQuestions.map(
        (question) => question.text,
      ),
      preferredMappedLegalProvisionKeys:
        item.policy.preferredLegalProvisionKeys,
    }),
    organizationRetrievalQuery: buildAtomicGapOrganizationRetrievalQuery({
      requirement: item.requirement,
      categoryQuestionTexts: input.release.questions
        .filter((question) =>
          item.requirement.questionStableKeys.includes(question.stableKey),
        )
        .map((question) => question.questionText),
    }),
    preferredMappedLegalProvisionIds: item.policy.preferredLegalProvisionIds,
    preferredMappedLegalProvisionKeys: item.policy.preferredLegalProvisionKeys,
    legalTierLimits: {
      primary_authority: 0,
      official_guidance: 0,
      curated_secondary: 0,
    },
  }));
  let responsePolicies: GapResponsePolicyV7[] = [];
  const grounded = await runGroundedOperation<GroundedGapModelResponseV7>({
    operation: "gap_analysis",
    runOperationKind: input.runOperationKind,
    actor: input.actor,
    organizationId: input.organizationId,
    outputLocale: input.outputLocale,
    workflowReleaseId: input.release.id,
    asOfDate: input.asOfDate ?? new Date().toISOString().slice(0, 10),
    organizationEvidenceVersionIds: input.selectedDocumentVersionIds,
    questionnaireAssertions: input.questionnaireAssertions,
    queryUnits,
    systemInstruction: GAP_PROMPT_V7_TEMPLATE,
    outputContract: {
      schema(context) {
        responsePolicies = buildResponsePolicies(
          input.requirements,
          context,
          input.outputLocale,
        );
        return buildGapModelResponseSchemaV7(responsePolicies);
      },
      languagePolicy: "localized",
      generatedProse: extractAtomicGapGeneratedProse,
      claims(output) {
        return atomicGapGroundedClaims(
          normalizeGroundedGapModelResponseV7({
            value: output,
            policies: responsePolicies,
          }),
        );
      },
      allowConflictingClaim(output, claim) {
        return (
          output.findings[claim.queryUnitId]?.requiresReview === true ||
          Boolean(
            input.requirements
              .find((item) => item.requirement.code === claim.queryUnitId)
              ?.reviewCorrection?.resolutionReason?.trim(),
          )
        );
      },
    },
    idempotencyKey: input.idempotencyKey,
    assessmentRevisionId: input.assessmentRevisionId,
    jobId: input.jobId,
    promptMetadata: {
      name: GAP_PROMPT_V7_NAME,
      version: GAP_PROMPT_V7_VERSION,
      templateHash: GAP_PROMPT_V7_TEMPLATE_HASH,
      responseSchemaVersion: GAP_RESPONSE_SCHEMA_V7_VERSION,
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
    outputLocale: input.outputLocale,
    context: grounded.context,
    findings: normalizeGroundedGapModelResponseV7({
      value: grounded.output,
      policies: responsePolicies,
    }),
  };
}

export function extractAtomicGapGeneratedProse(
  value: GroundedGapModelResponseV7,
) {
  return Object.values(value.findings).flatMap((finding) => [
    ...Object.values(finding.gaps ?? {}).flatMap((gaps) =>
      gaps.map((gap) => gap.statement),
    ),
    ...(finding.reviewNotice ? [finding.reviewNotice] : []),
    ...finding.assumptions,
    ...finding.contradictions,
  ]);
}

function buildResponsePolicies(
  requirements: AtomicGapRequirementInput[],
  context: GroundingContextItem[],
  outputLocale: Locale,
) {
  return requirements.map((item) => {
    const supplied = context.filter(
      (contextItem) => contextItem.queryUnitId === item.requirement.code,
    );
    const base = provisionalResponsePolicy(item, outputLocale);
    return {
      ...base,
      permittedCitationIds: supplied.map(
        (contextItem) => contextItem.citationId,
      ),
      questionnaireCitationIdsByQuestion: Object.fromEntries(
        item.policy.triggeringQuestions.map((trigger) => {
          const answerId =
            item.sourceAssessmentAnswerIdByQuestion[trigger.stableKey];
          const assertion = supplied.find(
            (contextItem) =>
              contextItem.channel === "questionnaire_assertion" &&
              contextItem.sourceId === answerId,
          );
          if (!assertion) {
            throw new Error(
              `Questionnaire citation is missing for ${trigger.stableKey}`,
            );
          }
          return [trigger.stableKey, assertion.citationId];
        }),
      ),
      admittedOrganizationCitationIds: supplied
        .filter(
          (contextItem) => contextItem.channel === "organization_document",
        )
        .map((contextItem) => contextItem.citationId),
      preferredPrimaryLegalCitationIds: supplied
        .filter(
          (contextItem) =>
            contextItem.channel === "legal" &&
            contextItem.metadata.selectionRole === "mapped_primary",
        )
        .map((contextItem) => contextItem.citationId),
    };
  });
}

function provisionalResponsePolicy(
  item: AtomicGapRequirementInput,
  outputLocale: Locale,
): GapResponsePolicyV7 {
  const allNotApplicable = item.policy.triggeringQuestions.every(
    (question) => question.stableValue === "not_applicable",
  );
  return {
    requirementCode: item.requirement.code,
    outputLocale,
    status: item.determinedStatus,
    statementBasis: {
      version: "1",
      triggeringQuestions: item.policy.triggeringQuestions.map((trigger) => ({
        stableKey: trigger.stableKey,
        sourceAssessmentAnswerId:
          item.sourceAssessmentAnswerIdByQuestion[trigger.stableKey] ??
          missingAnswer(trigger.stableKey),
        kind: deriveAtomicGapKind(trigger.stableValue, allNotApplicable),
      })),
      satisfiedQuestionStableKeys: item.policy.satisfiedQuestionStableKeys,
    },
    permittedCitationIds: [],
    questionnaireCitationIdsByQuestion: {},
    admittedOrganizationCitationIds: [],
    preferredPrimaryLegalCitationIds: [],
    forcedEvidenceSufficiency: item.forcedEvidenceSufficiency,
    forcedRequiresReview: item.forcedRequiresReview,
  };
}

function missingAnswer(stableKey: string): never {
  throw new Error(`Source assessment answer is missing for ${stableKey}`);
}
