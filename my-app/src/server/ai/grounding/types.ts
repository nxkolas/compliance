import type * as z from "zod";

export type GroundingChannel = "legal" | "organization_document" | "questionnaire_assertion";

export type GroundingContextItem = {
  channel: GroundingChannel;
  citationId: string;
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
};

export type GroundedProvider = {
  mode: string;
  provider: string;
  model: string;
  run(input: { system: string; prompt: string; schema: z.ZodType }): Promise<{
    output: unknown;
    usage: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number };
  }>;
};
