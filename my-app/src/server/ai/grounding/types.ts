import type * as z from "zod";

export type GroundingChannel = "legal" | "organization_document" | "questionnaire_assertion";

export type GroundingContextItem = {
  channel: GroundingChannel;
  citationId: string;
  /**
   * Short prompt-facing handle such as `D1`, present only on channels the model
   * is allowed to select from — today that is organization documents alone.
   *
   * Two reasons it is narrow. `citationId` embeds a chunk or answer UUID, and
   * the contracts forbid raw identifiers in prose, so handing the model a UUID
   * it must reference but never echo is a trap. And a handle for a source the
   * schema cannot express is worse still: the model has no legitimate place to
   * put it and writes it into prose instead. Legal and questionnaire citations
   * are assigned by the server, so they carry no handle.
   */
  label?: string;
  queryUnitId: string;
  sourceId: string;
  excerpt: string;
  excerptHash: string;
  rank: number;
  score: number;
  authorityTier?: "primary_authority" | "official_guidance" | "curated_secondary";
  translationStatus?: "official" | "reviewed_internal" | "machine_assisted";
  metadata: Record<string, unknown>;
};

export type GroundedClaim = {
  key: string;
  queryUnitId: string;
  kind: "legal" | "organization";
  citationIds: string[];
  text: string;
  binding?: boolean;
};

export type GroundedOutputContract<T> = {
  schema(context: GroundingContextItem[]): z.ZodType<T>;
  claims(output: T): GroundedClaim[];
  allowConflictingClaim?: (output: T, claim: GroundedClaim) => boolean;
} & (
  | {
      languagePolicy: "localized";
      generatedProse(output: T): string[];
    }
  | {
      languagePolicy: "language_neutral";
    }
);

export type QueryUnit = {
  id: string;
  query: string;
  retrievalQuery?: string;
  organizationRetrievalQuery?: string;
  preferredMappedLegalProvisionIds?: string[];
  preferredMappedLegalProvisionKeys?: string[];
  legalTierLimits?: Partial<
    Record<
      "primary_authority" | "official_guidance" | "curated_secondary",
      number
    >
  >;
};

export function resolveGroundingRetrievalQuery(
  unit: QueryUnit,
  channel: "legal" | "organization_document",
) {
  if (channel === "organization_document") {
    return (
      unit.organizationRetrievalQuery?.trim() ||
      unit.retrievalQuery?.trim() ||
      unit.query
    );
  }
  return unit.retrievalQuery?.trim() || unit.query;
}

export type GroundedProvider = {
  mode: string;
  provider: string;
  model: string;
  run(input: {
    system: string;
    prompt: string;
    schema: z.ZodType;
    abortSignal?: AbortSignal;
  }): Promise<{
    output: unknown;
    usage: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number };
  }>;
};
