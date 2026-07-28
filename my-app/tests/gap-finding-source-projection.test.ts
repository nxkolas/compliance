import { describe, expect, it } from "vitest";
import {
  projectGapFindingSources,
  type GapFindingSourceEvidence,
} from "@/src/server/gap-analysis/finding-source-projection";

const organizationId = "00000000-0000-4000-8000-000000000001";

function evidence(
  value: Partial<GapFindingSourceEvidence> &
    Pick<GapFindingSourceEvidence, "sourceType">,
): GapFindingSourceEvidence {
  return {
    pageNumber: null,
    sectionLabel: null,
    ...value,
  };
}

describe("Gap finding source projection", () => {
  it("deduplicates all three source kinds and normalizes locations", () => {
    const sources = projectGapFindingSources({
      organizationId,
      locale: "en",
      evidence: [
        evidence({ sourceType: "assessment_answer" }),
        evidence({
          sourceType: "document_chunk",
          pageNumber: 7,
          sectionLabel: "  Access control  ",
          documentSource: {
            versionId: "00000000-0000-4000-8000-000000000010",
            documentId: "00000000-0000-4000-8000-000000000010",
            title: "Security policy",
            mimeType: "application/pdf",
            chunkPageNumber: 1,
            chunkSectionLabel: "Fallback",
          },
        }),
        evidence({
          sourceType: "document_chunk",
          pageNumber: 2,
          sectionLabel: "Access control",
          documentSource: {
            versionId: "00000000-0000-4000-8000-000000000010",
            documentId: "00000000-0000-4000-8000-000000000010",
            title: "Security policy",
            mimeType: "application/pdf",
            chunkPageNumber: null,
            chunkSectionLabel: null,
          },
        }),
        evidence({
          sourceType: "legal_source_chunk",
          pageNumber: null,
          sectionLabel: null,
          legalSource: {
            versionId: "00000000-0000-4000-8000-000000000020",
            title: "NIS2 Directive",
            upstreamUrl: "https://eur-lex.europa.eu/example",
            mimeType: "application/pdf",
            chunkPageNumber: 12,
            chunkSectionLabel: "Article 21",
          },
        }),
        evidence({ sourceType: "assessment_answer" }),
      ],
    });

    expect(sources).toEqual([
      {
        kind: "assessment",
        key: "assessment",
        label: "Your information",
        href: null,
        available: true,
        pageNumbers: [],
        sectionLabels: [],
      },
      {
        kind: "document",
        key: "document:00000000-0000-4000-8000-000000000010",
        label: "Security policy",
        href:
          `/api/organizations/${organizationId}/documents/` +
          "00000000-0000-4000-8000-000000000010/source-access?page=2",
        available: true,
        pageNumbers: [2, 7],
        sectionLabels: ["Access control"],
      },
      {
        kind: "legal",
        key: "legal:00000000-0000-4000-8000-000000000020",
        label: "NIS2 Directive",
        href: "https://eur-lex.europa.eu/example#page=12",
        available: true,
        pageNumbers: [12],
        sectionLabels: ["Article 21"],
      },
    ]);
  });

  it("keeps exact document and legal versions distinct", () => {
    const sources = projectGapFindingSources({
      organizationId,
      locale: "de",
      evidence: [
        ...["version-1", "version-2"].map((versionId) =>
          evidence({
            sourceType: "document_chunk",
            documentSource: {
              versionId,
              documentId: versionId,
              title: "Richtlinie",
              mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              chunkPageNumber: null,
              chunkSectionLabel: null,
            },
          }),
        ),
        ...["law-version-1", "law-version-2"].map((versionId) =>
          evidence({
            sourceType: "legal_source_chunk",
            legalSource: {
              versionId,
              title: "Gesetz",
              upstreamUrl: "https://example.test/law",
              mimeType: "text/html",
              chunkPageNumber: null,
              chunkSectionLabel: null,
            },
          }),
        ),
      ],
    });

    expect(sources.map((source) => source.key)).toEqual([
      "document:version-1",
      "document:version-2",
      "legal:law-version-1",
      "legal:law-version-2",
    ]);
    expect(sources[0]?.href).not.toContain("page=");
  });

  it.each([
    null,
    "not a URL",
    "javascript:alert(1)",
    "data:text/plain,secret",
    "ftp://example.test/source",
  ])("disables an unavailable or unsafe official URL: %s", (upstreamUrl) => {
    const [source] = projectGapFindingSources({
      organizationId,
      locale: "en",
      evidence: [
        evidence({
          sourceType: "legal_source_chunk",
          legalSource: {
            versionId: "legal-version",
            title: "Official source",
            upstreamUrl,
            mimeType: "text/html",
            chunkPageNumber: null,
            chunkSectionLabel: null,
          },
        }),
      ],
    });

    expect(source).toMatchObject({
      kind: "legal",
      href: null,
      available: false,
    });
  });
});
