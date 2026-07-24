import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { generatedArtifactRevisions } from "@/src/db/schema";
import {
  buildCorrectedGapRevisionMetadata,
  buildGeneratedGapRevisionMetadata,
  gapRevisionMetadataSchema,
} from "@/src/server/gap-analysis/gap-revision-metadata";

const r1 = "5ef8ade8-95b4-4249-8108-bf4a69b6dd3d";
const r2 = "2ba249c1-0be6-444f-9e98-7bbf586dedc2";
const revisionId = "9a8d0a20-e6f3-4b65-aea9-5730d98d61cb";

describe("Gap revision metadata envelope", () => {
  it("persists only versioned diagnostic metadata with exact coverage", () => {
    const metadata = buildGeneratedGapRevisionMetadata({
      outputLocale: "de",
      expectedRequirementVersionIds: [r1, r2],
      findingDiagnostics: [
        { requirementVersionId: r1, contradictions: ["conflict"], questionnaireDisagreements: [] },
        { requirementVersionId: r2, contradictions: [], questionnaireDisagreements: ["difference"] },
      ],
    });

    expect(metadata).toEqual({
      schemaKind: "gap_revision_metadata_v1",
      outputLocale: "de",
      findingDiagnostics: expect.any(Array),
      correctedFromRevisionId: null,
      correctedRequirementVersionIds: [],
    });
    expect(metadata).not.toHaveProperty("findings");
    expect(() => buildGeneratedGapRevisionMetadata({
      outputLocale: "de",
      expectedRequirementVersionIds: [r1, r2],
      findingDiagnostics: [
        { requirementVersionId: r1, contradictions: [], questionnaireDisagreements: [] },
      ],
    })).toThrow(/coverage/i);
  });

  it("clears diagnostics for human-corrected requirements without copying Finding state", () => {
    const source = buildGeneratedGapRevisionMetadata({
      outputLocale: "en",
      expectedRequirementVersionIds: [r1, r2],
      findingDiagnostics: [
        { requirementVersionId: r1, contradictions: ["old"], questionnaireDisagreements: ["old"] },
        { requirementVersionId: r2, contradictions: [], questionnaireDisagreements: ["keep"] },
      ],
    });
    const corrected = buildCorrectedGapRevisionMetadata({
      source,
      sourceRevisionId: revisionId,
      expectedRequirementVersionIds: [r1, r2],
      correctedRequirementVersionIds: [r1],
    });

    expect(corrected.correctedFromRevisionId).toBe(revisionId);
    expect(corrected.correctedRequirementVersionIds).toEqual([r1]);
    expect(corrected.findingDiagnostics).toEqual([
      { requirementVersionId: r1, contradictions: [], questionnaireDisagreements: [] },
      { requirementVersionId: r2, contradictions: [], questionnaireDisagreements: ["keep"] },
    ]);
  });

  it("rejects legacy or business Finding fields at runtime and in the database schema", () => {
    expect(() => gapRevisionMetadataSchema.parse({
      schemaKind: "gap_revision_metadata_v1",
      outputLocale: "en",
      findingDiagnostics: [],
      correctedFromRevisionId: null,
      correctedRequirementVersionIds: [],
      findings: [],
    })).toThrow();
    const checks = getTableConfig(generatedArtifactRevisions).checks.map((item) => item.name);
    expect(checks).toContain("generated_artifact_revisions_gap_metadata_check");
  });
});
