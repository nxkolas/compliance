import * as z from "zod";
import { contentHash } from "@/src/server/compliance/domain";
import {
  GenerationContentValidationError,
  normalizeOneLine,
  normalizeUniqueStrings,
  type GenerationIssueCode,
  type NormalizationCode,
} from "../ai/generation";

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

export type GapCategoryStatus =
  | "fulfilled"
  | "partially_fulfilled"
  | "not_fulfilled"
  | "insufficient_evidence";

export type GapStatementSemanticContext = {
  locale: "de" | "en";
  questionStableKey: string;
  questionText: string;
  selectedAnswer:
    "partially_implemented" | "not_implemented" | "unsure" | "not_applicable";
  expectedKind: "missing" | "partial" | "uncertain";
};

export type GapResponsePolicy = {
  requirementCode: string;
  outputLocale: "de" | "en";
  statementBasis: GapStatementBasis;
  semanticContextByQuestion: Record<string, GapStatementSemanticContext>;
  statementMaximumByQuestion?: Record<string, number>;
  admittedOrganizationCitationIds: string[];
  questionnaireCitationIdsByQuestion: Record<string, string>;
  preferredPrimaryLegalCitationId: string;
  forcedEvidenceSufficiency?: "sufficient" | "partial" | "none";
  forcedRequiresReview?: boolean;
};

export type GapCategoryResponse = {
  gaps: Record<
    string,
    Array<{
      statement: string;
      supportingOrganizationCitationIds: string[];
    }>
  >;
  evidenceSufficiency: "sufficient" | "partial" | "none";
  reviewNotice: string | null;
  assumptions: string[];
  contradictions: string[];
  requiresReview: boolean;
  conflictingOrganizationCitationIds: string[];
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
  conflictingOrganizationCitationIds?: string[];
  requiresReview: boolean;
  legalCitationId: string;
};

/** The response shape before the conflicting-citation field is layered on. */
type GapCategoryResponseBase = Omit<
  GapCategoryResponse,
  "conflictingOrganizationCitationIds"
>;

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

export function defaultGapStatementMaximum(
  trigger: { splittable?: boolean; maximumStatements?: number },
) {
  if (!trigger.splittable) return 1;
  const maximum = trigger.maximumStatements ?? 1;
  if (!Number.isInteger(maximum) || maximum < 2 || maximum > 5) {
    throw new Error("Splittable Gap statement maximum must be between 2 and 5");
  }
  return maximum;
}

export function buildGapCategoryResponseSchema(
  policy: GapResponsePolicy,
): z.ZodType<GapCategoryResponse> {
  const organizationCitation = policy.admittedOrganizationCitationIds.length
    ? z.enum(policy.admittedOrganizationCitationIds as [string, ...string[]])
    : z.string().max(0);
  const schema = buildGapCategoryBaseSchema(policy)
    .extend({
      conflictingOrganizationCitationIds: z.array(organizationCitation),
    })
    .superRefine((untypedValue, context) => {
      const value = untypedValue as GapCategoryResponse;
      const conflicts = value.conflictingOrganizationCitationIds;
      if (new Set(conflicts).size !== conflicts.length) {
        context.addIssue({
          code: "custom",
          path: ["conflictingOrganizationCitationIds"],
          message: "Conflicting organization citation IDs must be unique",
        });
      }
      if (value.requiresReview && conflicts.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["conflictingOrganizationCitationIds"],
          message: "Review-required findings must identify an exact conflict",
        });
      }
      if (!value.requiresReview && conflicts.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["conflictingOrganizationCitationIds"],
          message: "Non-review findings cannot identify conflicting citations",
        });
      }
    });
  return schema as unknown as z.ZodType<GapCategoryResponse>;
}

export function normalizeGapCategoryResponse(input: {
  value: GapCategoryResponse;
  policy: GapResponsePolicy;
}) {
  const { conflictingOrganizationCitationIds, ...baseValue } = input.value;

  // Objective prose safety runs against the raw model text, before whitespace
  // normalization, so a URL or UUID surfaces as its own targeted issue code
  // rather than the generic content_invalid backstop further down.
  for (const [stableKey, gaps] of Object.entries(baseValue.gaps)) {
    gaps.forEach((gap, index) =>
      assertObjectiveSafeProse(gap.statement, [
        "gaps",
        stableKey,
        index,
        "statement",
      ]),
    );
  }
  if (baseValue.reviewNotice) {
    assertObjectiveSafeProse(baseValue.reviewNotice, ["reviewNotice"]);
  }
  baseValue.assumptions.forEach((value, index) =>
    assertObjectiveSafeProse(value, ["assumptions", index]),
  );
  baseValue.contradictions.forEach((value, index) =>
    assertObjectiveSafeProse(value, ["contradictions", index]),
  );

  const normalized = normalizeBaseCategoryResponse({
    value: baseValue,
    policy: input.policy,
  });

  if (
    normalized.value.contradictions.length === 0 &&
    normalized.value.requiresReview
  ) {
    if (conflictingOrganizationCitationIds.length > 0) {
      throw new GenerationContentValidationError([
        {
          code: "content_invalid",
          path: ["conflictingOrganizationCitationIds"],
        },
      ]);
    }
    return {
      ...normalized,
      value: {
        ...normalized.value,
        reviewNotice: null,
        requiresReview: false,
        conflictingOrganizationCitationIds: [],
      },
      normalizationCodes: [
        ...normalized.normalizationCodes,
        "normalized_review_without_contradiction" as const,
      ],
    };
  }

  const parsed = buildGapCategoryResponseSchema(input.policy).parse(
    input.value,
  ) as GapCategoryResponse;
  return {
    ...normalized,
    value: {
      ...normalized.value,
      citationIds: [
        ...new Set([
          ...normalized.value.citationIds,
          ...parsed.conflictingOrganizationCitationIds,
        ]),
      ],
      conflictingOrganizationCitationIds:
        parsed.conflictingOrganizationCitationIds,
    },
  };
}

function buildGapCategoryBaseSchema(policy: GapResponsePolicy) {
  assertSemanticContext(policy);
  const organizationCitations =
    policy.admittedOrganizationCitationIds.length > 0
      ? z.array(
          z.enum(
            policy.admittedOrganizationCitationIds as [string, ...string[]],
          ),
        )
      : z.array(z.string()).max(0);
  const gaps = Object.fromEntries(
    policy.statementBasis.triggeringQuestions.map((trigger) => {
      const maximum =
        policy.statementMaximumByQuestion?.[trigger.stableKey] ?? 1;
      const semantic = policy.semanticContextByQuestion[trigger.stableKey]!;
      return [
        trigger.stableKey,
        z
          .array(
            z
              .object({
                statement: z
                  .string()
                  .trim()
                  .min(1)
                  .max(1_000)
                  .describe(
                    `Write natural ${semantic.locale} prose answering the supplied question while preserving the server-owned ${semantic.expectedKind} kind.`,
                  ),
                supportingOrganizationCitationIds: organizationCitations,
              })
              .strict(),
          )
          .min(1)
          .max(maximum),
      ];
    }),
  );
  return z
    .object({
      gaps: z.object(gaps).strict(),
      evidenceSufficiency: policy.forcedEvidenceSufficiency
        ? z.literal(policy.forcedEvidenceSufficiency)
        : policy.admittedOrganizationCitationIds.length > 0
          ? z.enum(["sufficient", "partial", "none"])
          : z.literal("none"),
      reviewNotice: nonblank.max(1_000).nullable(),
      assumptions: z.array(nonblank.max(1_000)).max(10),
      contradictions: z.array(nonblank.max(1_000)).max(10),
      requiresReview:
        policy.forcedRequiresReview === undefined
          ? z.boolean()
          : z.literal(policy.forcedRequiresReview),
    })
    .strict();
}

function normalizeBaseCategoryResponse(input: {
  value: GapCategoryResponseBase;
  policy: GapResponsePolicy;
}): {
  value: ValidatedCategoryGapResult;
  normalizationCodes: NormalizationCode[];
} {
  const codes = new Set<NormalizationCode>();
  const normalized: GapCategoryResponseBase = {
    ...input.value,
    gaps: Object.fromEntries(
      Object.entries(input.value.gaps).map(([key, gaps]) => [
        key,
        gaps.map((gap) => {
          const statement = normalizeOneLine(gap.statement, {
            finalPeriod: true,
          });
          const citations = normalizeUniqueStrings(
            gap.supportingOrganizationCitationIds,
            input.policy.outputLocale,
          );
          statement.codes.forEach((code) => codes.add(code));
          citations.codes.forEach((code) => codes.add(code));
          return {
            statement: statement.value,
            supportingOrganizationCitationIds: citations.value,
          };
        }),
      ]),
    ),
    reviewNotice: input.value.reviewNotice
      ? normalizeOneLine(input.value.reviewNotice).value
      : null,
    assumptions: normalizeUniqueStrings(
      input.value.assumptions,
      input.policy.outputLocale,
    ).value,
    contradictions: normalizeUniqueStrings(
      input.value.contradictions,
      input.policy.outputLocale,
    ).value,
  };
  const parsed = buildGapCategoryBaseSchema(input.policy).parse(normalized);
  if (parsed.requiresReview !== Boolean(parsed.reviewNotice)) {
    throw new GenerationContentValidationError([
      { code: "review_notice_state", path: ["requiresReview"] },
      { code: "review_notice_state", path: ["reviewNotice"] },
    ]);
  }
  if (
    parsed.contradictions.length > 0 &&
    !parsed.requiresReview &&
    input.policy.forcedRequiresReview !== false
  ) {
    throw new GenerationContentValidationError([
      {
        code: "contradiction_review_required",
        path: ["contradictions"],
      },
      {
        code: "contradiction_review_required",
        path: ["requiresReview"],
      },
    ]);
  }
  for (const trigger of input.policy.statementBasis.triggeringQuestions) {
    for (const [index, gap] of (
      parsed.gaps[trigger.stableKey] ?? []
    ).entries()) {
      assertSafeProse(gap.statement, [
        "gaps",
        trigger.stableKey,
        index,
        "statement",
      ]);
    }
  }
  if (parsed.reviewNotice)
    assertSafeProse(parsed.reviewNotice, ["reviewNotice"]);
  parsed.assumptions.forEach((value, index) =>
    assertSafeProse(value, ["assumptions", index]),
  );
  parsed.contradictions.forEach((value, index) =>
    assertSafeProse(value, ["contradictions", index]),
  );

  const allOptional = Object.values(parsed.gaps).flatMap((gaps) =>
    gaps.flatMap((gap) => gap.supportingOrganizationCitationIds),
  );
  const gaps = input.policy.statementBasis.triggeringQuestions.flatMap(
    (trigger) =>
      parsed.gaps[trigger.stableKey]!.map((gap) => ({
        questionStableKey: trigger.stableKey,
        sourceAssessmentAnswerId: trigger.sourceAssessmentAnswerId,
        kind: trigger.kind,
        statement: gap.statement,
        citationIds: [
          input.policy.questionnaireCitationIdsByQuestion[trigger.stableKey]!,
          ...gap.supportingOrganizationCitationIds,
        ],
      })),
  );
  return {
    value: {
      requirementCode: input.policy.requirementCode,
      statementBasis: input.policy.statementBasis,
      statementBasisHash: contentHash(input.policy.statementBasis),
      evidenceSufficiency: parsed.evidenceSufficiency,
      gaps,
      reviewNotice: parsed.reviewNotice,
      assumptions: parsed.assumptions,
      citationIds: [
        input.policy.preferredPrimaryLegalCitationId,
        ...new Set(allOptional),
      ],
      contradictions: parsed.contradictions,
      requiresReview: parsed.requiresReview,
      legalCitationId: input.policy.preferredPrimaryLegalCitationId,
    },
    normalizationCodes: [...codes],
  };
}

function assertSemanticContext(policy: GapResponsePolicy) {
  for (const trigger of policy.statementBasis.triggeringQuestions) {
    const context = policy.semanticContextByQuestion[trigger.stableKey];
    if (
      !context ||
      context.questionStableKey !== trigger.stableKey ||
      context.locale !== policy.outputLocale ||
      context.expectedKind !== trigger.kind ||
      !context.questionText.trim()
    ) {
      throw new Error(
        `Gap semantic context is invalid for ${trigger.stableKey}`,
      );
    }
  }
}

/** Targeted URL/identifier rejection, reported as its own repairable code. */
function assertObjectiveSafeProse(
  value: string,
  path: Array<string | number>,
) {
  const code: GenerationIssueCode | null = /\b(?:https?:\/\/|www\.)\S+/iu.test(
    value,
  )
    ? "url_forbidden"
    : /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/iu.test(
          value,
        )
      ? "raw_identifier"
      : null;
  if (code) {
    throw new GenerationContentValidationError([{ code, path }]);
  }
}

/** Backstop for prose that only becomes unsafe after normalization. */
function assertSafeProse(value: string, path: Array<string | number>) {
  if (
    /\b(?:https?:\/\/|www\.)\S+/iu.test(value) ||
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/iu.test(
      value,
    )
  ) {
    throw new GenerationContentValidationError([
      { code: "content_invalid", path },
    ]);
  }
}
