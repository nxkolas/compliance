import * as z from "zod";
import { GenerationContentValidationError } from "../ai/generation";
import {
  buildGapCategoryResponseSchemaV11,
  normalizeGapCategoryResponseV11,
  type GapCategoryResponseV11,
  type GapResponsePolicyV11,
  type GapStatementSemanticContext,
} from "./generation-schema-v11";

export type GapResponsePolicyV12 = GapResponsePolicyV11;
export type GapCategoryResponseV12 = GapCategoryResponseV11 & {
  conflictingOrganizationCitationIds: string[];
};

export function buildGapCategoryResponseSchemaV12(
  policy: GapResponsePolicyV12,
): z.ZodType<GapCategoryResponseV12> {
  const baseSchema = buildGapCategoryResponseSchemaV11(policy);
  if (!(baseSchema instanceof z.ZodObject)) {
    throw new Error("Gap response base schema must be an object schema");
  }
  const organizationCitation = policy.admittedOrganizationCitationIds.length
    ? z.enum(
        policy.admittedOrganizationCitationIds as [string, ...string[]],
      )
    : z.string().max(0);
  const schema = baseSchema
    .extend({
      conflictingOrganizationCitationIds: z.array(organizationCitation),
    })
    .superRefine((untypedValue, context) => {
      const value = untypedValue as GapCategoryResponseV12;
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
  return schema as unknown as z.ZodType<GapCategoryResponseV12>;
}

export function normalizeGapCategoryResponseV12(input: {
  value: GapCategoryResponseV12;
  policy: GapResponsePolicyV12;
}) {
  const { conflictingOrganizationCitationIds, ...legacyValue } = input.value;
  const normalized = normalizeGapCategoryResponseV11({
    policy: input.policy,
    value: legacyValue,
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
  const parsed = buildGapCategoryResponseSchemaV12(input.policy).parse(
    input.value,
  );
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

export type { GapStatementSemanticContext };
