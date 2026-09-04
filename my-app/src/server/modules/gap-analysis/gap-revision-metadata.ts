import * as z from "zod";
import type { Locale } from "@/src/i18n/config";

const findingDiagnosticSchema = z.object({
  requirementVersionId: z.uuid(),
  contradictions: z.array(z.string()),
  questionnaireDisagreements: z.array(z.string()),
}).strict();

export const gapRevisionMetadataSchema = z.object({
  schemaKind: z.literal("gap_revision_metadata_v1"),
  outputLocale: z.enum(["de", "en"]),
  findingDiagnostics: z.array(findingDiagnosticSchema),
  correctedFromRevisionId: z.uuid().nullable(),
  correctedRequirementVersionIds: z.array(z.uuid()),
}).strict();

export type GapRevisionMetadata = z.infer<typeof gapRevisionMetadataSchema>;
type FindingDiagnostic = z.infer<typeof findingDiagnosticSchema>;

export function buildGeneratedGapRevisionMetadata(input: {
  outputLocale: Locale;
  expectedRequirementVersionIds: string[];
  findingDiagnostics: FindingDiagnostic[];
}): GapRevisionMetadata {
  assertExactDiagnosticCoverage(
    input.expectedRequirementVersionIds,
    input.findingDiagnostics,
  );
  return gapRevisionMetadataSchema.parse({
    schemaKind: "gap_revision_metadata_v1",
    outputLocale: input.outputLocale,
    findingDiagnostics: input.findingDiagnostics,
    correctedFromRevisionId: null,
    correctedRequirementVersionIds: [],
  });
}

export function buildCorrectedGapRevisionMetadata(input: {
  source: unknown;
  sourceRevisionId: string;
  expectedRequirementVersionIds: string[];
  correctedRequirementVersionIds: string[];
}): GapRevisionMetadata {
  const source = gapRevisionMetadataSchema.parse(input.source);
  assertExactDiagnosticCoverage(
    input.expectedRequirementVersionIds,
    source.findingDiagnostics,
  );
  const expected = new Set(input.expectedRequirementVersionIds);
  const corrected = new Set([
    ...source.correctedRequirementVersionIds,
    ...input.correctedRequirementVersionIds,
  ]);
  if ([...corrected].some((requirementVersionId) => !expected.has(requirementVersionId))) {
    throw new Error("Corrected Requirement coverage does not match the revision");
  }
  return gapRevisionMetadataSchema.parse({
    ...source,
    findingDiagnostics: source.findingDiagnostics.map((diagnostic) =>
      corrected.has(diagnostic.requirementVersionId)
        ? {
            ...diagnostic,
            contradictions: [],
            questionnaireDisagreements: [],
          }
        : diagnostic
    ),
    correctedFromRevisionId: input.sourceRevisionId,
    correctedRequirementVersionIds: [...corrected],
  });
}

export function readGapRevisionMetadata(value: unknown) {
  return gapRevisionMetadataSchema.parse(value);
}

function assertExactDiagnosticCoverage(
  expectedRequirementVersionIds: string[],
  diagnostics: FindingDiagnostic[],
) {
  const expected = new Set(expectedRequirementVersionIds);
  const actual = new Set(diagnostics.map((item) => item.requirementVersionId));
  if (
    expected.size !== expectedRequirementVersionIds.length ||
    actual.size !== diagnostics.length ||
    expected.size !== actual.size ||
    [...expected].some((requirementVersionId) => !actual.has(requirementVersionId))
  ) {
    throw new Error("Gap Finding diagnostic coverage must exactly match Requirements");
  }
}
