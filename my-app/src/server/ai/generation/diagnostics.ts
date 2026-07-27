import type * as z from "zod";

export const generationStages = [
  "provider",
  "schema",
  "normalization",
  "language",
  "grounding",
  "content",
  "persistence",
] as const;

export type GenerationStage = (typeof generationStages)[number];
export type GenerationPhase = "initial" | "repair";
export type GenerationDisposition =
  | "accepted"
  | "normalized"
  | "repair_requested"
  | "rejected"
  | "cancelled";

export const generationIssueCodes = [
  "unexpected_key",
  "missing_key",
  "invalid_type",
  "invalid_value",
  "too_small",
  "too_big",
  "not_multiple_of",
  "unrecognized_keys",
  "custom",
  "language_mismatch",
  "grounding_unsupported",
  "coverage_incomplete",
  "uncertain_action_invalid",
  "citation_unsupported",
  "content_invalid",
  "gap_kind_mismatch",
  "gap_statement_style",
  "review_notice_state",
  "contradiction_review_required",
  "action_content_invalid",
  "action_blank",
  "action_multiline",
  "action_title_length",
  "action_result_length",
  "action_result_sentences",
  "action_evidence_count",
  "action_evidence_length",
  "action_forbidden_label",
  "action_example_leakage",
  "action_verification_result_state",
  "action_legal_analysis",
  "action_raw_identifier",
  "provider_transient",
  "provider_terminal",
  "cancelled",
  "normalized_whitespace",
  "normalized_line_wrap",
  "normalized_duplicate",
  "normalized_period",
] as const;

export type GenerationIssueCode = (typeof generationIssueCodes)[number];
const issueCodeSet = new Set<string>(generationIssueCodes);

export type GenerationDiagnostic = {
  stage: GenerationStage;
  categoryCode: string;
  phase: GenerationPhase;
  disposition: GenerationDisposition;
  issues: Array<{
    code: GenerationIssueCode;
    path: Array<string | number>;
  }>;
  durationMs: number;
};

export function safeGenerationIssues(
  issues: ReadonlyArray<
    Pick<z.core.$ZodIssue, "code" | "path"> & Record<string, unknown>
  >,
): GenerationDiagnostic["issues"] {
  return issues.slice(0, 50).map((issue) => ({
    code: issueCodeSet.has(issue.code)
      ? (issue.code as GenerationIssueCode)
      : "content_invalid",
    path: sanitizePath(issue.path),
  }));
}

export function createGenerationDiagnostic(
  input: Omit<GenerationDiagnostic, "durationMs" | "issues"> & {
    durationMs: number;
    issues?: GenerationDiagnostic["issues"];
  },
): GenerationDiagnostic {
  return {
    ...input,
    durationMs: Math.max(0, Math.trunc(input.durationMs)),
    issues: (input.issues ?? []).slice(0, 50).map((issue) => ({
      code: issueCodeSet.has(issue.code) ? issue.code : "content_invalid",
      path: sanitizePath(issue.path),
    })),
  };
}

function sanitizePath(path: PropertyKey[]): Array<string | number> {
  return path
    .slice(0, 20)
    .filter(
      (part): part is string | number =>
        typeof part === "string" || typeof part === "number",
    )
    .map((part) =>
      typeof part === "string"
        ? /^[A-Za-z0-9_.:-]{1,120}$/u.test(part)
          ? part
          : "unknown"
        : part,
    );
}
