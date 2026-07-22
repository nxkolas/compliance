import * as z from "zod";

export const gapFindingStatusSchema = z.enum([
  "fulfilled",
  "partially_fulfilled",
  "not_fulfilled",
  "insufficient_evidence",
]);

export const evidenceSufficiencySchema = z.enum([
  "sufficient",
  "partial",
  "none",
]);

const localizedTextSchema = z.object({
  de: z.string().trim().min(1),
  en: z.string().trim().min(1),
});

export const gapModelFindingSchema = z.object({
  requirementCode: z.string().trim().min(1),
  status: gapFindingStatusSchema,
  evidenceSufficiency: evidenceSufficiencySchema,
  rationale: localizedTextSchema,
  recommendation: localizedTextSchema,
  assumptions: z.array(z.string().trim().min(1)),
  citations: z.array(z.string().trim().min(1)),
  contradictions: z.array(z.string().trim().min(1)),
  requiresReview: z.boolean(),
});

export const gapModelResponseSchema = z.object({
  findings: z.array(gapModelFindingSchema),
});

const groundedGapModelFindingSchema = gapModelFindingSchema.omit({
  requirementCode: true,
});

export type GroundedGapModelResponse = {
  findings: Record<string, z.infer<typeof groundedGapModelFindingSchema>>;
};

export function buildGapModelResponseSchema(requirementCodes: string[]) {
  if (requirementCodes.length === 0) throw new Error("At least one requirement code is required");
  const findings = Object.fromEntries(
    requirementCodes.map((requirementCode) => [requirementCode, groundedGapModelFindingSchema]),
  );
  return z.object({
    findings: z.object(findings).strict(),
  }) as z.ZodType<GroundedGapModelResponse>;
}

export function normalizeGroundedGapModelResponse(
  value: GroundedGapModelResponse,
): GapModelResponse {
  return {
    findings: Object.entries(value.findings).map(([requirementCode, finding]) => ({
      requirementCode,
      ...finding,
    })),
  };
}

export type GapModelResponse = z.infer<typeof gapModelResponseSchema>;
export type GapModelFinding = GapModelResponse["findings"][number];

export type SuppliedCitation = {
  id: string;
  sourceType: "assessment_answer" | "document_chunk" | "legal_source_chunk";
  sourceId: string;
  excerpt: string;
  pageNumber: number | null;
  sectionLabel: string | null;
};

export function validateGapModelResponse(input: {
  value: unknown;
  requestedRequirementCodes: string[];
  citations: SuppliedCitation[];
  citationIdsByRequirement?: Record<string, string[]>;
}) {
  const parsed = gapModelResponseSchema.parse(input.value);
  const requested = new Set(input.requestedRequirementCodes);
  const seen = new Set<string>();
  const citationById = new Map(input.citations.map((citation) => [citation.id, citation]));
  for (const finding of parsed.findings) {
    if (!requested.has(finding.requirementCode)) {
      throw new Error(`Unexpected requirement ${finding.requirementCode}`);
    }
    if (seen.has(finding.requirementCode)) {
      throw new Error(`Duplicate requirement ${finding.requirementCode}`);
    }
    seen.add(finding.requirementCode);
    for (const citationId of finding.citations) {
      if (!citationById.has(citationId)) {
        throw new Error(`Unknown citation ${citationId}`);
      }
      const permitted = input.citationIdsByRequirement?.[finding.requirementCode];
      if (permitted && !permitted.includes(citationId)) {
        throw new Error(
          `Citation ${citationId} was not supplied for ${finding.requirementCode}`,
        );
      }
    }
    if (
      finding.status === "fulfilled" &&
      !finding.citations.some(
        (citationId) => citationById.get(citationId)?.sourceType === "document_chunk",
      )
    ) {
      throw new Error(
        `Fulfilled requirement ${finding.requirementCode} lacks documentary evidence`,
      );
    }
    if (finding.contradictions.length > 0 && !finding.requiresReview) {
      throw new Error(
        `Contradictory requirement ${finding.requirementCode} must require review`,
      );
    }
  }
  if (seen.size !== requested.size || [...requested].some((code) => !seen.has(code))) {
    throw new Error("Model output does not cover every requested requirement exactly once");
  }
  return parsed;
}

export function deriveFindingSeverity(
  criticality: "low" | "medium" | "high" | "critical",
  status: z.infer<typeof gapFindingStatusSchema>,
) {
  if (status === "fulfilled") return "low" as const;
  if (status === "insufficient_evidence") {
    return criticality === "critical" ? "high" : criticality;
  }
  if (status === "partially_fulfilled") {
    if (criticality === "critical") return "high" as const;
    if (criticality === "high") return "medium" as const;
    return criticality;
  }
  return criticality;
}
