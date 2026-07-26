import * as z from "zod";
import type {
  GapGuidancePolicy,
  GapWorkKind,
} from "./guidance-policy";

const nonblank = z.string().trim().min(1);
const evidenceSufficiency = z.enum(["sufficient", "partial", "none"]);

export type GapGuidanceResponsePolicy = {
  requirementCode: string;
  outputLocale: "de" | "en";
  policy: GapGuidancePolicy;
  permittedCitationIds: string[];
  preferredPrimaryLegalCitationIds: string[];
  admittedOrganizationCitationIds: string[];
  forcedEvidenceSufficiency?: "sufficient" | "partial" | "none";
  forcedRequiresReview?: boolean;
};

export type GroundedGapModelResponseV6 = {
  findings: Record<
    string,
    {
      evidenceSufficiency: "sufficient" | "partial" | "none";
      rationale: string;
      recommendation: string;
      objective?: string;
      workPackages?: Record<
        string,
        {
          deliverables: string[];
          acceptanceCriteria:
            | { remediated: string[] }
            | {
                confirmedImplemented: string[];
                confirmedDeficient: string[];
              };
          suggestedEvidence: string[];
        }
      >;
      assumptions: string[];
      citations: string[];
      contradictions: string[];
      questionnaireDisagreements: string[];
      requiresReview: boolean;
      legalCitation: string;
    }
  >;
};

export type GapDeliverable = {
  questionStableKey: string;
  workKind: GapWorkKind;
  text: string;
};

export type GapAcceptanceCriterion = {
  questionStableKey: string;
  workKind: GapWorkKind;
  text: string;
  completionPath?: "confirmed_implemented" | "confirmed_deficient";
};

export type GapSuggestedEvidence = {
  questionStableKey: string;
  text: string;
};

export type ValidatedGapGuidance = {
  requirementCode: string;
  guidanceMode: GapGuidancePolicy["guidanceMode"];
  guidanceBasis: GapGuidancePolicy["basis"];
  guidanceBasisHash: string;
  evidenceSufficiency: "sufficient" | "partial" | "none";
  rationale: string;
  recommendation: string;
  objective: string | null;
  deliverables: GapDeliverable[];
  acceptanceCriteria: GapAcceptanceCriterion[];
  suggestedEvidence: GapSuggestedEvidence[];
  assumptions: string[];
  citations: string[];
  contradictions: string[];
  questionnaireDisagreements: string[];
  requiresReview: boolean;
  legalCitation: string;
};

export function buildGapModelResponseSchemaV6(
  policies: GapGuidanceResponsePolicy[],
): z.ZodType<GroundedGapModelResponseV6> {
  assertResponsePolicies(policies);
  const findings = Object.fromEntries(
    policies.map((responsePolicy) => [
      responsePolicy.requirementCode,
      buildFindingSchema(responsePolicy),
    ]),
  );
  return z
    .object({
      findings: z.object(findings).strict(),
    })
    .strict() as z.ZodType<GroundedGapModelResponseV6>;
}

export function normalizeGroundedGapModelResponseV6(input: {
  value: GroundedGapModelResponseV6;
  policies: GapGuidanceResponsePolicy[];
}): ValidatedGapGuidance[] {
  const parsed = buildGapModelResponseSchemaV6(input.policies).parse(
    input.value,
  );
  const policyByCode = new Map(
    input.policies.map((policy) => [policy.requirementCode, policy]),
  );
  return Object.entries(parsed.findings).map(
    ([requirementCode, finding]): ValidatedGapGuidance => {
      const responsePolicy = policyByCode.get(requirementCode);
      if (!responsePolicy) {
        throw new Error(`Unexpected requirement ${requirementCode}`);
      }
      const deliverables: GapDeliverable[] = [];
      const acceptanceCriteria: GapAcceptanceCriterion[] = [];
      const suggestedEvidence: GapSuggestedEvidence[] = [];
      for (const trigger of responsePolicy.policy.triggeringQuestions) {
        const workPackage = finding.workPackages?.[trigger.stableKey];
        if (!workPackage) continue;
        if (trigger.workKind === "verify") {
          deliverables.push({
            questionStableKey: trigger.stableKey,
            workKind: trigger.workKind,
            text: verificationKickoff(
              responsePolicy.outputLocale,
              trigger.text,
            ),
          });
        }
        deliverables.push(
          ...workPackage.deliverables.map((text) => ({
            questionStableKey: trigger.stableKey,
            workKind: trigger.workKind,
            text,
          })),
        );
        if (trigger.workKind === "remediate") {
          const criteria = workPackage.acceptanceCriteria as {
            remediated: string[];
          };
          acceptanceCriteria.push(
            ...criteria.remediated.map((text) => ({
              questionStableKey: trigger.stableKey,
              workKind: trigger.workKind,
              text,
            })),
          );
        } else {
          const criteria = workPackage.acceptanceCriteria as {
            confirmedImplemented: string[];
            confirmedDeficient: string[];
          };
          acceptanceCriteria.push(
            ...criteria.confirmedImplemented.map((text) => ({
              questionStableKey: trigger.stableKey,
              workKind: trigger.workKind,
              text,
              completionPath: "confirmed_implemented" as const,
            })),
            ...criteria.confirmedDeficient.map((text) => ({
              questionStableKey: trigger.stableKey,
              workKind: trigger.workKind,
              text,
              completionPath: "confirmed_deficient" as const,
            })),
          );
        }
        suggestedEvidence.push(
          ...workPackage.suggestedEvidence.map((text) => ({
            questionStableKey: trigger.stableKey,
            text,
          })),
        );
      }
      return {
        requirementCode,
        guidanceMode: responsePolicy.policy.guidanceMode,
        guidanceBasis: responsePolicy.policy.basis,
        guidanceBasisHash: responsePolicy.policy.hash,
        evidenceSufficiency: finding.evidenceSufficiency,
        rationale: finding.rationale,
        recommendation:
          responsePolicy.policy.guidanceMode ===
          "maintain_and_document"
            ? frameFulfilledRecommendation(
                responsePolicy.outputLocale,
                finding.recommendation,
              )
            : finding.recommendation,
        objective: finding.objective ?? null,
        deliverables,
        acceptanceCriteria,
        suggestedEvidence,
        assumptions: finding.assumptions,
        citations: [...new Set([finding.legalCitation, ...finding.citations])],
        contradictions: finding.contradictions,
        questionnaireDisagreements: finding.questionnaireDisagreements,
        requiresReview: finding.requiresReview,
        legalCitation: finding.legalCitation,
      };
    },
  );
}

export function extractGapGeneratedProseV6(
  value: GroundedGapModelResponseV6,
): string[] {
  return Object.values(value.findings).flatMap((finding) => [
    finding.rationale,
    finding.recommendation,
    ...(finding.objective ? [finding.objective] : []),
    ...Object.values(finding.workPackages ?? {}).flatMap((workPackage) => [
      ...workPackage.deliverables,
      ...Object.values(workPackage.acceptanceCriteria).flat(),
      ...workPackage.suggestedEvidence,
    ]),
    ...finding.assumptions,
    ...finding.contradictions,
    ...finding.questionnaireDisagreements,
  ]);
}

function buildFindingSchema(responsePolicy: GapGuidanceResponsePolicy) {
  const permittedCitationIds = unique(responsePolicy.permittedCitationIds);
  const preferredLegalIds = unique(
    responsePolicy.preferredPrimaryLegalCitationIds,
  );
  const admittedOrganizationIds = new Set(
    responsePolicy.admittedOrganizationCitationIds,
  );
  const permitted = new Set(permittedCitationIds);
  if (
    permittedCitationIds.length === 0 ||
    preferredLegalIds.length === 0 ||
    preferredLegalIds.some((id) => !permitted.has(id)) ||
    [...admittedOrganizationIds].some((id) => !permitted.has(id))
  ) {
    throw new Error(
      `Requirement ${responsePolicy.requirementCode} has an invalid citation policy`,
    );
  }
  if (
    responsePolicy.forcedEvidenceSufficiency &&
    responsePolicy.forcedEvidenceSufficiency !== "none" &&
    admittedOrganizationIds.size === 0
  ) {
    throw new Error(
      `Requirement ${responsePolicy.requirementCode} cannot raise evidence sufficiency without admitted organization evidence`,
    );
  }
  const citationEnum = z.enum(
    permittedCitationIds as [string, ...string[]],
  );
  const common = {
    evidenceSufficiency: responsePolicy.forcedEvidenceSufficiency
      ? z.literal(responsePolicy.forcedEvidenceSufficiency)
      : admittedOrganizationIds.size === 0
        ? z.literal("none")
        : evidenceSufficiency,
    rationale: nonblank,
    recommendation: nonblank,
    assumptions: z.array(nonblank),
    citations: z.array(citationEnum),
    contradictions: z.array(nonblank),
    questionnaireDisagreements: z.array(nonblank),
    requiresReview:
      responsePolicy.forcedRequiresReview === undefined
        ? z.boolean()
        : z.literal(responsePolicy.forcedRequiresReview),
    legalCitation: z.enum(
      preferredLegalIds as [string, ...string[]],
    ),
  };
  const schema =
    responsePolicy.policy.guidanceMode === "maintain_and_document"
      ? z.object(common).strict()
      : z
          .object({
            ...common,
            objective: nonblank,
            workPackages: z
              .object(
                Object.fromEntries(
                  responsePolicy.policy.triggeringQuestions.map((trigger) => [
                    trigger.stableKey,
                    buildWorkPackageSchema(trigger.workKind),
                  ]),
                ),
              )
              .strict(),
          })
          .strict();
  return schema.superRefine((finding, context) => {
    if (
      finding.evidenceSufficiency !== "none" &&
      !finding.citations.some((id) => admittedOrganizationIds.has(id))
    ) {
      context.addIssue({
        code: "custom",
        path: ["citations"],
        message:
          "Partial or sufficient evidence must cite admitted organization evidence",
      });
    }
    if (
      finding.contradictions.length > 0 &&
      !finding.requiresReview &&
      responsePolicy.forcedRequiresReview !== false
    ) {
      context.addIssue({
        code: "custom",
        path: ["requiresReview"],
        message: "Contradictory evidence must require review",
      });
    }
  });
}

function buildWorkPackageSchema(workKind: GapWorkKind) {
  return z
    .object({
      deliverables: z.array(nonblank).min(1),
      acceptanceCriteria:
        workKind === "remediate"
          ? z.object({ remediated: z.array(nonblank).min(1) }).strict()
          : z
              .object({
                confirmedImplemented: z.array(nonblank).min(1),
                confirmedDeficient: z.array(nonblank).min(1),
              })
              .strict(),
      suggestedEvidence: z.array(nonblank).min(1),
    })
    .strict();
}

function assertResponsePolicies(policies: GapGuidanceResponsePolicy[]) {
  if (policies.length === 0) {
    throw new Error("At least one guidance response policy is required");
  }
  const codes = policies.map((policy) => policy.requirementCode);
  if (
    codes.some((code) => !code.trim()) ||
    new Set(codes).size !== codes.length
  ) {
    throw new Error("Guidance response requirement codes must be unique");
  }
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function verificationKickoff(
  locale: "de" | "en",
  questionText: string,
) {
  return locale === "de"
    ? `Eine verantwortliche Person benennen, den aktuellen Umsetzungsstand prüfen und Nachweise sammeln für: ${questionText}`
    : `Assign an accountable owner, verify the current implementation state, and collect evidence for: ${questionText}`;
}

function frameFulfilledRecommendation(
  locale: "de" | "en",
  modelRecommendation: string,
) {
  return locale === "de"
    ? `Die Fragebogenantworten weisen diese Anforderung als umgesetzt aus. Die folgende Empfehlung dient der Aufrechterhaltung und Nachweisbereitschaft f\u00fcr eine unabh\u00e4ngige Pr\u00fcfung; sie stellt nicht fest, dass die Kontrolle fehlt: ${modelRecommendation}`
    : `The questionnaire responses report this requirement as implemented. The following recommendation supports maintenance and evidence readiness for independent verification; it does not find that the control is missing: ${modelRecommendation}`;
}
