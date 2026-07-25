import { describe, expect, it } from "vitest";
import { validateCorpusReleaseMembers, type CorpusReleaseMemberValidation } from "@/src/server/corpus/release-validation";

const member = (overrides: Partial<CorpusReleaseMemberValidation> = {}): CorpusReleaseMemberValidation => ({
  position: 0,
  familyId: "family-1",
  sourceFamilyId: "family-1",
  sourceVersionStatus: "reviewed",
  renditionVersionId: "version-1",
  sourceVersionId: "version-1",
  translationStatus: "official",
  authoritativeRenditionId: null,
  processingRenditionId: "rendition-1",
  renditionId: "rendition-1",
  processingState: "reviewed",
  reliableAnchors: true,
  embeddingConfig: { model: "embedding-v1" },
  contentHash: "hash-1",
  ...overrides,
});

describe("corpus release validation", () => {
  it("hashes a reviewed internally consistent release", () => {
    expect(validateCorpusReleaseMembers("family-1", [member()])).toMatchObject({ ok: true, contentHash: expect.any(String) });
  });

  it("rejects family crossing, unreviewed processing, weak anchors, and unlinked translations", () => {
    const result = validateCorpusReleaseMembers("family-1", [member({ sourceFamilyId: "family-2", processingState: "review_required", reliableAnchors: false, translationStatus: "machine_assisted" })]);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.errors).toEqual(expect.arrayContaining(["Member crosses corpus families", "Processing generation is not approved", "Translation lacks authoritative provenance"]));
  });
});
