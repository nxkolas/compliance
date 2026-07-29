import {
  buildGapCategoryResponseSchemaV11,
  normalizeGapCategoryResponseV11,
  type GapCategoryResponseV11,
  type GapResponsePolicyV11,
  type GapStatementSemanticContext,
} from "./generation-schema-v11";

export type GapResponsePolicyV12 = GapResponsePolicyV11;
export type GapCategoryResponseV12 = GapCategoryResponseV11;

export const buildGapCategoryResponseSchemaV12 =
  buildGapCategoryResponseSchemaV11;

export function normalizeGapCategoryResponseV12(input: {
  value: GapCategoryResponseV12;
  policy: GapResponsePolicyV12;
}) {
  const normalized = normalizeGapCategoryResponseV11(input);
  if (
    normalized.value.contradictions.length === 0 &&
    normalized.value.requiresReview
  ) {
    return {
      ...normalized,
      value: {
        ...normalized.value,
        reviewNotice: null,
        requiresReview: false,
      },
      normalizationCodes: [
        ...normalized.normalizationCodes,
        "normalized_review_without_contradiction" as const,
      ],
    };
  }
  return normalized;
}

export type { GapStatementSemanticContext };
