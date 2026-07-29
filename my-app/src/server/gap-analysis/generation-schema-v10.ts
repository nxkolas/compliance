import {
  GenerationContentValidationError,
  type GenerationIssueCode,
} from "../ai/generation";
import {
  buildGapCategoryResponseSchemaV9,
  normalizeGapCategoryResponseV9,
  type GapCategoryResponseV9,
  type GapResponsePolicyV9,
  type GapStatementSemanticContext,
} from "./generation-schema-v9";

export type GapResponsePolicyV10 = GapResponsePolicyV9;
export type GapCategoryResponseV10 = GapCategoryResponseV9;

export function buildGapCategoryResponseSchemaV10(
  policy: GapResponsePolicyV10,
) {
  return buildGapCategoryResponseSchemaV9(policy);
}

export function normalizeGapCategoryResponseV10(input: {
  value: GapCategoryResponseV10;
  policy: GapResponsePolicyV10;
}) {
  for (const [stableKey, gaps] of Object.entries(input.value.gaps)) {
    gaps.forEach((gap, index) =>
      assertObjectiveSafeProse(gap.statement, [
        "gaps",
        stableKey,
        index,
        "statement",
      ]),
    );
  }
  if (input.value.reviewNotice) {
    assertObjectiveSafeProse(input.value.reviewNotice, ["reviewNotice"]);
  }
  input.value.assumptions.forEach((value, index) =>
    assertObjectiveSafeProse(value, ["assumptions", index]),
  );
  input.value.contradictions.forEach((value, index) =>
    assertObjectiveSafeProse(value, ["contradictions", index]),
  );
  return normalizeGapCategoryResponseV9(input);
}

function assertObjectiveSafeProse(value: string, path: Array<string | number>) {
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

export type { GapStatementSemanticContext };
