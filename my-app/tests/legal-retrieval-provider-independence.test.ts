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

const embed = vi.hoisted(() => vi.fn());
vi.mock("@/src/server/modules/documents", () => ({
  createDocumentEmbeddingProvider: vi.fn(() => ({
    provider: "test",
    model: "test-embedding",
    modelRevision: "1",
    dimensions: 2,
    retrievalInstructionId: "test",
    embed,
  })),
  validateEmbeddings: vi.fn(),
}));

import { retrievePinnedLegalContext } from "@/src/server/modules/grounding/legal-retrieval";

const pinnedSnapshots = [
  {
    familyId: "00000000-0000-4000-8000-000000000011",
    familyCode: "nis2-eu-primary",
    snapshotId: "00000000-0000-4000-8000-000000000012",
    snapshotHash: "eu-snapshot",
  },
];

const mappedOnlyLimits = {
  primary_authority: 0,
  official_guidance: 0,
  curated_secondary: 0,
};

describe("legal retrieval provider independence", () => {
  it("resolves mapped provisions through the reviewed binding", async () => {
    mocks.rows = [
      row({
        chunkId: "00000000-0000-4000-8000-000000000001",
        mappedProvisionKey: "eu_nis2.article_21_2_f",
      }),
    ];

    const context = await retrievePinnedLegalContext({
      queryUnitId: "NIS2-BC-05",
      query: "backup requirements",
      asOfDate: "2026-08-05",
      language: "de",
      preferredMappedLegalProvisionKeys: ["eu_nis2.article_21_2_f"],
      tierLimits: mappedOnlyLimits,
      pinnedSnapshots,
    });

    expect(context).toHaveLength(1);
    expect(context[0]?.metadata.mappedLegalProvisionKey).toBe(
      "eu_nis2.article_21_2_f",
    );
    expect(context[0]?.metadata.selectionRole).toBe("mapped_primary");
  });

  it("never embeds anything, on either path", async () => {
    // The regression this whole change exists to prevent: the corpus holds no
    // vectors, so no embedding model can orphan it. Switching an organization
    // or deployment to a different embedder cannot affect legal grounding.
    embed.mockClear();

    mocks.rows = [
      row({
        chunkId: "00000000-0000-4000-8000-000000000001",
        mappedProvisionKey: "eu_nis2.article_21_2_f",
      }),
    ];
    await retrievePinnedLegalContext({
      queryUnitId: "NIS2-BC-05",
      query: "backup requirements",
      asOfDate: "2026-08-05",
      language: "de",
      preferredMappedLegalProvisionKeys: ["eu_nis2.article_21_2_f"],
      tierLimits: mappedOnlyLimits,
      pinnedSnapshots,
    });

    mocks.rows = [
      row({
        chunkId: "00000000-0000-4000-8000-000000000003",
        mappedProvisionKey: null,
      }),
    ];
    const discovered = await retrievePinnedLegalContext({
      queryUnitId: "NIS2-BC-05",
      query: "backup requirements",
      asOfDate: "2026-08-05",
      language: "de",
      tierLimits: { primary_authority: 3 },
      pinnedSnapshots,
    });

    expect(embed).not.toHaveBeenCalled();
    expect(discovered).toHaveLength(1);
    expect(discovered[0]?.metadata.selectionRole).toBe("secondary_context");
  });

  it("ranks discovery on the lexical score alone", async () => {
    mocks.rows = [
      row({
        chunkId: "00000000-0000-4000-8000-000000000004",
        mappedProvisionKey: null,
        lexicalScore: 0.42,
      }),
    ];

    const context = await retrievePinnedLegalContext({
      queryUnitId: "NIS2-BC-05",
      query: "backup requirements",
      asOfDate: "2026-08-05",
      language: "de",
      tierLimits: { primary_authority: 3 },
      pinnedSnapshots,
    });

    expect(context[0]?.metadata.lexicalScore).toBe(0.42);
    expect(context[0]?.metadata).not.toHaveProperty("semanticScore");
  });

  it("still fails loudly when a mapped provision has no reviewed authority", async () => {
    mocks.rows = [];

    await expect(
      retrievePinnedLegalContext({
        queryUnitId: "NIS2-BC-05",
        query: "backup requirements",
        asOfDate: "2026-08-05",
        language: "de",
        preferredMappedLegalProvisionKeys: ["eu_nis2.article_21_2_f"],
        tierLimits: mappedOnlyLimits,
        pinnedSnapshots,
      }),
    ).rejects.toMatchObject({ code: "GAP_MAPPED_LEGAL_AUTHORITY_MISSING" });
  });

  it("rejects a mapped provision whose only binding is an unofficial rendition", async () => {
    mocks.rows = [
      row({
        chunkId: "00000000-0000-4000-8000-000000000002",
        mappedProvisionKey: "eu_nis2.article_21_2_f",
        translationStatus: "unreviewed",
      }),
    ];

    await expect(
      retrievePinnedLegalContext({
        queryUnitId: "NIS2-BC-05",
        query: "backup requirements",
        asOfDate: "2026-08-05",
        language: "de",
        preferredMappedLegalProvisionKeys: ["eu_nis2.article_21_2_f"],
        tierLimits: mappedOnlyLimits,
        pinnedSnapshots,
      }),
    ).rejects.toMatchObject({ code: "GAP_MAPPED_LEGAL_AUTHORITY_MISSING" });
  });
});

function row(input: {
  chunkId: string;
  mappedProvisionKey: string | null;
  translationStatus?: string;
  lexicalScore?: number;
}) {
  return {
    chunkId: input.chunkId,
    mappedProvisionKey: input.mappedProvisionKey,
    familyCode: "nis2-eu-primary",
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
    locale: "de",
    translationStatus: input.translationStatus ?? "official",
    processingGenerationId: `${input.chunkId}-generation`,
    snapshotId: `${input.chunkId}-snapshot`,
    lexicalScore: input.lexicalScore ?? 0.5,
    score: input.lexicalScore ?? 0.5,
  };
}
