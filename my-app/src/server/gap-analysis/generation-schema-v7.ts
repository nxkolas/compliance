import * as z from "zod";
import { contentHash } from "@/src/server/compliance/domain";
import { validateAtomicGapStatement } from "./gap-style";

export type AtomicGapKind = "missing" | "partial" | "uncertain";

export type GapStatementBasis = {
  version: "1";
  triggeringQuestions: Array<{
    stableKey: string;
    sourceAssessmentAnswerId: string;
    kind: AtomicGapKind;
  }>;
  satisfiedQuestionStableKeys: string[];
};

export type GapResponsePolicyV7 = {
  requirementCode: string;
  outputLocale: "de" | "en";
  status:
    | "fulfilled"
    | "partially_fulfilled"
    | "not_fulfilled"
    | "insufficient_evidence";
  statementBasis: GapStatementBasis;
  permittedCitationIds: string[];
  questionnaireCitationIdsByQuestion: Record<string, string>;
  admittedOrganizationCitationIds: string[];
  preferredPrimaryLegalCitationIds: string[];
  forcedEvidenceSufficiency?: "sufficient" | "partial" | "none";
  forcedRequiresReview?: boolean;
};

export type GroundedGapModelResponseV7 = {
  findings: Record<
    string,
    {
      gaps: Record<string, Array<{ statement: string; citations: string[] }>>;
      evidenceSufficiency: "sufficient" | "partial" | "none";
      reviewNotice: string | null;
      assumptions: string[];
      citations: string[];
      contradictions: string[];
      requiresReview: boolean;
      legalCitation: string;
    }
  >;
};

export type ValidatedCategoryGapResult = {
  requirementCode: string;
  statementBasis: GapStatementBasis;
  statementBasisHash: string;
  evidenceSufficiency: "sufficient" | "partial" | "none";
  gaps: Array<{
    questionStableKey: string;
    sourceAssessmentAnswerId: string;
    kind: AtomicGapKind;
    statement: string;
    citationIds: string[];
  }>;
  reviewNotice: string | null;
  assumptions: string[];
  citationIds: string[];
  contradictions: string[];
  requiresReview: boolean;
  legalCitationId: string;
};

const nonblank = z.string().trim().min(1);

export function deriveAtomicGapKind(
  stableValue:
    | "fully_implemented"
    | "partially_implemented"
    | "not_implemented"
    | "unsure"
    | "not_applicable",
  allNotApplicable: boolean,
): AtomicGapKind {
  if (stableValue === "not_implemented") return "missing";
  if (stableValue === "partially_implemented") return "partial";
  if (stableValue === "unsure") return "uncertain";
  if (stableValue === "not_applicable" && allNotApplicable) {
    return "uncertain";
  }
  throw new Error(`${stableValue} is not a triggering Gap answer`);
}

export function buildGapModelResponseSchemaV7(
  policies: GapResponsePolicyV7[],
): z.ZodType<GroundedGapModelResponseV7> {
  if (policies.length === 0) {
    throw new Error("At least one Gap response policy is required");
  }
  const findings = Object.fromEntries(
    policies.map((policy) => [
      policy.requirementCode,
      buildFindingSchema(policy),
    ]),
  );
  return z
    .object({ findings: z.object(findings).strict() })
    .strict() as z.ZodType<GroundedGapModelResponseV7>;
}

export function normalizeGroundedGapModelResponseV7(input: {
  value: GroundedGapModelResponseV7;
  policies: GapResponsePolicyV7[];
}): ValidatedCategoryGapResult[] {
  const value = buildGapModelResponseSchemaV7(input.policies).parse(
    input.value,
  );
  const policyByCode = new Map(
    input.policies.map((policy) => [policy.requirementCode, policy]),
  );
  return Object.entries(value.findings).map(([requirementCode, finding]) => {
    const policy = policyByCode.get(requirementCode);
    if (!policy) throw new Error(`Unexpected requirement ${requirementCode}`);
    return {
      requirementCode,
      statementBasis: policy.statementBasis,
      statementBasisHash: contentHash(policy.statementBasis),
      evidenceSufficiency: finding.evidenceSufficiency,
      gaps: policy.statementBasis.triggeringQuestions.flatMap((trigger) =>
        (finding.gaps?.[trigger.stableKey] ?? []).map((gap) => ({
          questionStableKey: trigger.stableKey,
          sourceAssessmentAnswerId: trigger.sourceAssessmentAnswerId,
          kind: trigger.kind,
          statement: gap.statement,
          citationIds: gap.citations,
        })),
      ),
      reviewNotice: finding.reviewNotice ?? null,
      assumptions: finding.assumptions,
      citationIds: [...new Set([finding.legalCitation, ...finding.citations])],
      contradictions: finding.contradictions,
      requiresReview: finding.requiresReview,
      legalCitationId: finding.legalCitation,
    };
  });
}

function buildFindingSchema(policy: GapResponsePolicyV7) {
  const permittedCitationIds = [...new Set(policy.permittedCitationIds)];
  const legalCitationIds = [
    ...new Set(policy.preferredPrimaryLegalCitationIds),
  ];
  if (permittedCitationIds.length === 0 || legalCitationIds.length === 0) {
    throw new Error(
      `Requirement ${policy.requirementCode} has an invalid citation policy`,
    );
  }
  const permitted = new Set(permittedCitationIds);
  if (legalCitationIds.some((id) => !permitted.has(id))) {
    throw new Error(
      `Requirement ${policy.requirementCode} has an invalid legal citation policy`,
    );
  }
  const citation = z.enum(permittedCitationIds as [string, ...string[]]);
  const common = {
    evidenceSufficiency: policy.forcedEvidenceSufficiency
      ? z.literal(policy.forcedEvidenceSufficiency)
      : policy.admittedOrganizationCitationIds.length === 0
        ? z.literal("none")
        : z.enum(["sufficient", "partial", "none"]),
    assumptions: z.array(nonblank),
    citations: z.array(citation),
    contradictions: z.array(nonblank),
    reviewNotice: nonblank
      .nullable()
      .describe(
        "Return null when requiresReview is false. When requiresReview is true, return one concise notice describing the material evidence conflict without remediation advice.",
      ),
    requiresReview:
      policy.forcedRequiresReview === undefined
        ? z.boolean()
        : z.literal(policy.forcedRequiresReview),
    legalCitation: z.enum(legalCitationIds as [string, ...string[]]),
  };
  const triggers = policy.statementBasis.triggeringQuestions;
  const schema = z
    .object({
      ...common,
      gaps: z
        .object(
          Object.fromEntries(
            triggers.map((trigger) => {
              const answerCitation =
                policy.questionnaireCitationIdsByQuestion[trigger.stableKey];
              if (!answerCitation || !permitted.has(answerCitation)) {
                throw new Error(
                  `Requirement ${policy.requirementCode} has an invalid questionnaire citation policy for ${trigger.stableKey}`,
                );
              }
              return [
                trigger.stableKey,
                z
                  .array(
                    z
                      .object({
                        statement: nonblank.describe(
                          gapStatementDescription({
                            kind: trigger.kind,
                            locale: policy.outputLocale,
                          }),
                        ),
                        citations: z
                          .array(citation)
                          .min(1)
                          .describe(
                            `Every gap for trigger "${trigger.stableKey}" must include the exact questionnaire citation "${answerCitation}". Additional supplied citations are allowed only when they support this same statement.`,
                          ),
                      })
                      .strict()
                      .superRefine((gap, context) => {
                        if (!gap.citations.includes(answerCitation)) {
                          context.addIssue({
                            code: "custom",
                            path: ["citations"],
                            message:
                              "Every gap must cite its questionnaire answer",
                          });
                        }
                        try {
                          validateAtomicGapStatement({
                            statement: gap.statement,
                            kind: trigger.kind,
                            locale: policy.outputLocale,
                          });
                        } catch (error) {
                          context.addIssue({
                            code: "custom",
                            path: ["statement"],
                            message:
                              error instanceof Error
                                ? error.message
                                : "Gap statement is invalid",
                          });
                        }
                      }),
                  )
                  .min(1)
                  .max(5),
              ];
            }),
          ),
        )
        .strict(),
    })
    .strict();
  return schema.superRefine((finding, context) => {
    if (finding.requiresReview && !finding.reviewNotice) {
      context.addIssue({
        code: "custom",
        path: ["reviewNotice"],
        message: "Review required findings must include a review notice",
      });
    }
    if (!finding.requiresReview && finding.reviewNotice) {
      context.addIssue({
        code: "custom",
        path: ["reviewNotice"],
        message: "A review notice is allowed only when review is required",
      });
    }
    if (
      finding.contradictions.length > 0 &&
      !finding.requiresReview &&
      policy.forcedRequiresReview !== false
    ) {
      context.addIssue({
        code: "custom",
        path: ["requiresReview"],
        message: "Contradictory evidence must require review",
      });
    }
  });
}

function gapStatementDescription(input: {
  kind: AtomicGapKind;
  locale: "de" | "en";
}) {
  const prefix = `This trigger has server-owned kind "${input.kind}".`;
  if (input.locale === "de") {
    if (input.kind === "missing") {
      return `${prefix} Formuliere eine bestÃ¤tigte Abwesenheit, zum Beispiel mit "fehlt" oder "nicht vorhanden". Verwende keine Unsicherheitsformulierung wie "unklar", "ungeklÃ¤rt", "nicht verifiziert" oder "nicht nachgewiesen".`;
    }
    if (input.kind === "partial") {
      return `${prefix} Formuliere nur die unvollstÃ¤ndige Umsetzung. Behaupte keine vollstÃ¤ndige Abwesenheit und erfinde keine fehlenden Teilkontrollen.`;
    }
    return `${prefix} Sage ausdrÃ¼cklich, dass der Kontrollzustand unklar, ungeklÃ¤rt, nicht nachgewiesen oder nicht ersichtlich ist. Behaupte keine Abwesenheit.`;
  }
  if (input.kind === "missing") {
    return `${prefix} Use confirmed-absence wording such as "No ..." or "... is missing". Do not use uncertainty wording such as "unclear", "unknown", "unverified", "not verified", or "remains to be verified".`;
  }
  if (input.kind === "partial") {
    return `${prefix} State only that implementation is incomplete. Do not claim complete absence or invent which sub-control is missing.`;
  }
  return `${prefix} Explicitly say the control state is unclear, unknown, unverified, or not evidenced. Never claim the control is absent or missing.`;
}
