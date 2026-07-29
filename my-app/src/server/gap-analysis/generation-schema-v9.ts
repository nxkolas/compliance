import * as z from "zod";
import { contentHash } from "@/src/server/compliance/domain";
import {
  GenerationContentValidationError,
  normalizeOneLine,
  normalizeUniqueStrings,
  type NormalizationCode,
} from "../ai/generation";
import type {
  AtomicGapKind,
  GapStatementBasis,
  ValidatedCategoryGapResult,
} from "./generation-schema-v7";

export type GapStatementSemanticContext = {
  locale: "de" | "en";
  questionStableKey: string;
  questionText: string;
  selectedAnswer:
    "partially_implemented" | "not_implemented" | "unsure" | "not_applicable";
  expectedKind: "missing" | "partial" | "uncertain";
};

export type GapResponsePolicyV9 = {
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

export type GapCategoryResponseV9 = {
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
};

const nonblank = z.string().trim().min(1);

export function buildGapCategoryResponseSchemaV9(
  policy: GapResponsePolicyV9,
): z.ZodType<GapCategoryResponseV9> {
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
    .strict() as z.ZodType<GapCategoryResponseV9>;
}

export function normalizeGapCategoryResponseV9(input: {
  value: GapCategoryResponseV9;
  policy: GapResponsePolicyV9;
}): {
  value: ValidatedCategoryGapResult;
  normalizationCodes: NormalizationCode[];
} {
  const codes = new Set<NormalizationCode>();
  const normalized: GapCategoryResponseV9 = {
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
  const parsed = buildGapCategoryResponseSchemaV9(input.policy).parse(
    normalized,
  );
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

function assertSemanticContext(policy: GapResponsePolicyV9) {
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

export type { AtomicGapKind };
