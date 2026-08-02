import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));

vi.mock("@/src/db", () => ({
  db: {
    select: vi.fn(() => {
      const builder: Record<string, unknown> = {};
      for (const method of ["from", "innerJoin", "leftJoin", "where", "orderBy", "limit"]) {
        builder[method] = vi.fn(() => builder);
      }
      builder.then = (
        resolve: (rows: Array<Record<string, unknown>>) => unknown,
        reject?: (error: unknown) => unknown,
      ) => Promise.resolve(mocks.rows).then(resolve, reject);
      return builder;
    }),
  },
}));

import { retrievePinnedLegalContext } from "@/src/server/ai/grounding/legal-retrieval";

describe("legal retrieval with shared provision chunks", () => {
  it("validates every preferred provision before deduplicating shared chunks", async () => {
    mocks.rows = [
      row({
        chunkId: "00000000-0000-4000-8000-000000000001",
        familyCode: "nis2-eu-primary",
        mappedProvisionKey: "eu_nis2.article_21_2",
      }),
      row({
        chunkId: "00000000-0000-4000-8000-000000000001",
        familyCode: "nis2-eu-primary",
        mappedProvisionKey: "eu_nis2.article_21_2_a",
      }),
      row({
        chunkId: "00000000-0000-4000-8000-000000000002",
        familyCode: "nis2-de-primary",
        mappedProvisionKey: "de_bsig.section_30_2_1",
      }),
    ];

    const context = await retrievePinnedLegalContext(
      {
        queryUnitId: "NIS2-RISK-02",
        query: "risk management",
        asOfDate: "2026-08-02",
        language: "de",
        preferredMappedLegalProvisionKeys: [
          "eu_nis2.article_21_2",
          "eu_nis2.article_21_2_a",
          "de_bsig.section_30_2_1",
        ],
        tierLimits: {
          primary_authority: 0,
          official_guidance: 0,
          curated_secondary: 0,
        },
        pinnedSnapshots: [
          {
            familyId: "00000000-0000-4000-8000-000000000011",
            familyCode: "nis2-eu-primary",
            snapshotId: "00000000-0000-4000-8000-000000000012",
            snapshotHash: "eu-snapshot",
          },
          {
            familyId: "00000000-0000-4000-8000-000000000013",
            familyCode: "nis2-de-primary",
            snapshotId: "00000000-0000-4000-8000-000000000014",
            snapshotHash: "de-snapshot",
          },
        ],
      },
      {
        embeddingProvider: {
          provider: "test",
          model: "test-embedding",
          modelRevision: "1",
          dimensions: 2,
          retrievalInstructionId: "test",
          embed: vi.fn(),
        },
        queryEmbedding: [1, 0],
      },
    );

    expect(context).toHaveLength(2);
    expect(context.map((item) => item.metadata.familyCode).sort()).toEqual([
      "nis2-de-primary",
      "nis2-eu-primary",
    ]);
    expect(context.every((item) => item.metadata.selectionRole === "mapped_primary")).toBe(true);
  });
});

function row(input: {
  chunkId: string;
  familyCode: string;
  mappedProvisionKey: string;
}) {
  return {
    ...input,
    text: "Official legal text",
    contentHash: `${input.chunkId}-hash`,
    pageNumber: 1,
    sectionPath: null,
    sourceId: `${input.chunkId}-source`,
    sourceTitle: "Official source",
    officialSourceUrl: "https://example.test/legal.pdf",
    authorityTier: "official",
    sourceVersionId: `${input.chunkId}-version`,
    effectiveFrom: null,
    effectiveTo: null,
    renditionId: `${input.chunkId}-rendition`,
    locale: input.familyCode === "nis2-de-primary" ? "de" : "en",
    translationStatus: "official",
    processingGenerationId: `${input.chunkId}-generation`,
    snapshotId: `${input.chunkId}-snapshot`,
    lexicalScore: 0.5,
    semanticScore: 0.8,
    score: 0.7,
  };
}
