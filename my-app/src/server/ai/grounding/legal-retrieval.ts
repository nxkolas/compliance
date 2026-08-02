import { createHash } from "node:crypto";
import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
  legalCorpusFamilies,
  legalCorpusSnapshotMembers,
  legalCorpusSnapshots,
  legalProvisionChunkBindings,
  legalSourceChunkEmbeddings,
  legalSourceChunks,
  legalSourceProcessingGenerations,
  legalSourceRenditions,
  legalSources,
  legalSourceVersions,
} from "@/src/db/schema";
import {
  createDocumentEmbeddingProvider,
  validateEmbeddings,
  type DocumentEmbeddingProvider,
} from "@/src/server/documents";
import type { GroundingContextItem } from "./types";
import { ApiError } from "../../api/errors";

export type PinnedLegalSnapshot = {
  familyId: string;
  familyCode: string;
  snapshotId: string;
  snapshotHash: string;
};

export async function resolvePinnedLegalScope(input: {
  familyCodes: string[];
}): Promise<PinnedLegalSnapshot[]> {
  const familyCodes = [...new Set(input.familyCodes)].sort();
  const rows = await db
    .select({
      familyId: legalCorpusFamilies.id,
      familyCode: legalCorpusFamilies.code,
      snapshotId: legalCorpusSnapshots.id,
      snapshotHash: legalCorpusSnapshots.contentHash,
    })
    .from(legalCorpusFamilies)
    .innerJoin(
      legalCorpusSnapshots,
      and(
        eq(legalCorpusSnapshots.id, legalCorpusFamilies.currentSnapshotId),
        eq(legalCorpusSnapshots.familyId, legalCorpusFamilies.id),
      ),
    )
    .where(inArray(legalCorpusFamilies.code, familyCodes));
  if (rows.length !== familyCodes.length) {
    throw new ApiError(
      409,
      "A required legal corpus family has no active snapshot",
      undefined,
      "CORPUS_PINS_INCOMPLETE",
    );
  }
  return rows.sort((left, right) =>
    left.familyCode.localeCompare(right.familyCode),
  );
}

export async function retrievePinnedLegalContext(
  input: {
    queryUnitId: string;
    query: string;
    asOfDate: string;
    language: "de" | "en";
    preferredMappedLegalProvisionKeys?: string[];
    tierLimits?: Partial<
      Record<
        "primary_authority" | "official_guidance" | "curated_secondary",
        number
      >
    >;
    pinnedSnapshots: PinnedLegalSnapshot[];
  },
  dependencies: {
    embeddingProvider?: DocumentEmbeddingProvider;
    queryEmbedding?: number[];
  } = {},
): Promise<GroundingContextItem[]> {
  const provider =
    dependencies.embeddingProvider ?? createDocumentEmbeddingProvider();
  const queryEmbedding =
    dependencies.queryEmbedding ?? (await provider.embed([input.query], "query"))[0];
  if (!queryEmbedding) throw new Error("Query embedding is missing");
  validateEmbeddings([queryEmbedding], 1, provider.dimensions);

  const vectorLiteral = `[${queryEmbedding.join(",")}]`;
  const lexical = sql<number>`coalesce(ts_rank_cd(${legalSourceChunks.searchVector}, websearch_to_tsquery('simple', ${input.query})), 0)`;
  const semantic = sql<number>`1 - (${legalSourceChunkEmbeddings.embedding} OPERATOR(extensions.<=>) ${vectorLiteral}::extensions.vector)`;
  const score = sql<number>`(${lexical} * 0.35) + ((${semantic}) * 0.65)`;
  const asOf = new Date(`${input.asOfDate}T23:59:59.999Z`);
  const preferredKeys = input.preferredMappedLegalProvisionKeys ?? [];
  const mappedPriority = preferredKeys.length
    ? sql<number>`case when ${legalProvisionChunkBindings.stableProvisionKey} in (${sql.join(preferredKeys.map((key) => sql`${key}`), sql`, `)}) then 1 else 0 end`
    : sql<number>`0`;

  const rows = await db
    .select({
      chunkId: legalSourceChunks.id,
      text: legalSourceChunks.text,
      contentHash: legalSourceChunks.contentHash,
      pageNumber: legalSourceChunks.pageNumber,
      sectionPath: legalSourceChunks.sectionPath,
      sourceId: legalSources.id,
      sourceTitle: legalSources.title,
      officialSourceUrl: legalSources.officialSourceUrl,
      authorityTier: legalSources.authorityTier,
      sourceVersionId: legalSourceVersions.id,
      effectiveFrom: legalSourceVersions.effectiveFrom,
      effectiveTo: legalSourceVersions.effectiveTo,
      renditionId: legalSourceRenditions.id,
      locale: legalSourceRenditions.locale,
      translationStatus: legalSourceRenditions.translationStatus,
      processingGenerationId: legalSourceProcessingGenerations.id,
      snapshotId: legalCorpusSnapshots.id,
      familyCode: legalCorpusFamilies.code,
      mappedProvisionKey: legalProvisionChunkBindings.stableProvisionKey,
      lexicalScore: lexical,
      semanticScore: semantic,
      score,
    })
    .from(legalCorpusSnapshotMembers)
    .innerJoin(
      legalCorpusSnapshots,
      eq(legalCorpusSnapshots.id, legalCorpusSnapshotMembers.snapshotId),
    )
    .innerJoin(
      legalCorpusFamilies,
      eq(legalCorpusFamilies.id, legalCorpusSnapshots.familyId),
    )
    .innerJoin(
      legalSourceVersions,
      eq(legalSourceVersions.id, legalCorpusSnapshotMembers.sourceVersionId),
    )
    .innerJoin(legalSources, eq(legalSources.id, legalSourceVersions.sourceId))
    .innerJoin(
      legalSourceRenditions,
      eq(legalSourceRenditions.id, legalCorpusSnapshotMembers.renditionId),
    )
    .innerJoin(
      legalSourceProcessingGenerations,
      eq(
        legalSourceProcessingGenerations.id,
        legalCorpusSnapshotMembers.processingGenerationId,
      ),
    )
    .innerJoin(
      legalSourceChunks,
      eq(
        legalSourceChunks.processingGenerationId,
        legalSourceProcessingGenerations.id,
      ),
    )
    .innerJoin(
      legalSourceChunkEmbeddings,
      and(
        eq(legalSourceChunkEmbeddings.chunkId, legalSourceChunks.id),
        eq(legalSourceChunkEmbeddings.model, provider.model),
      ),
    )
    .leftJoin(
      legalProvisionChunkBindings,
      eq(legalProvisionChunkBindings.chunkId, legalSourceChunks.id),
    )
    .where(
      and(
        inArray(
          legalCorpusSnapshots.id,
          input.pinnedSnapshots.map((pin) => pin.snapshotId),
        ),
        eq(legalSourceProcessingGenerations.status, "succeeded"),
        or(isNull(legalSourceVersions.effectiveFrom), lte(legalSourceVersions.effectiveFrom, asOf)),
        or(isNull(legalSourceVersions.effectiveTo), gte(legalSourceVersions.effectiveTo, asOf)),
        or(
          eq(legalSourceRenditions.locale, input.language),
          eq(legalSourceRenditions.translationStatus, "official"),
        ),
      ),
    )
    .orderBy(desc(mappedPriority), desc(score), legalSourceChunks.id)
    .limit(80);

  const preferred = new Set(preferredKeys);
  const preferredRows = rows.filter(
    (row) =>
      row.mappedProvisionKey !== null &&
      preferred.has(row.mappedProvisionKey) &&
      row.authorityTier === "official" &&
      ["original", "official"].includes(row.translationStatus),
  );
  const coveredPreferredKeys = new Set(
    preferredRows.flatMap((row) =>
      row.mappedProvisionKey ? [row.mappedProvisionKey] : [],
    ),
  );
  const missing = [...preferred].filter(
    (key) => !coveredPreferredKeys.has(key),
  );
  if (missing.length) {
    throw new ApiError(
      409,
      "Mapped legal authority is unavailable for this Gap requirement",
      { missingMappedProvisionKeys: missing },
      "GAP_MAPPED_LEGAL_AUTHORITY_MISSING",
    );
  }

  const limits = {
    primary_authority: 6,
    official_guidance: 3,
    curated_secondary: 2,
    ...input.tierLimits,
  };
  const used = {
    primary_authority: 0,
    official_guidance: 0,
    curated_secondary: 0,
  };
  const selected = new Map<string, (typeof rows)[number]>();
  const selectedMappedFamilies = new Set<string>();
  const mappedPrimaryContextLimit = Math.min(2, input.pinnedSnapshots.length);
  for (const row of preferredRows) {
    if (
      selectedMappedFamilies.has(row.familyCode) ||
      selectedMappedFamilies.size >= mappedPrimaryContextLimit
    ) {
      continue;
    }
    selected.set(row.chunkId, row);
    selectedMappedFamilies.add(row.familyCode);
  }
  for (const row of rows) {
    if (selected.has(row.chunkId)) continue;
    const tier = mapAuthorityTier(row.authorityTier);
    if (used[tier] >= limits[tier]) continue;
    used[tier] += 1;
    selected.set(row.chunkId, row);
  }

  return [...selected.values()].map((row, index) => ({
    channel: "legal",
    citationId: `LEGAL:${input.queryUnitId}:${row.chunkId}`,
    queryUnitId: input.queryUnitId,
    sourceId: row.chunkId,
    excerpt: row.text,
    excerptHash:
      row.contentHash || createHash("sha256").update(row.text).digest("hex"),
    rank: index + 1,
    score: Number(row.score),
    authorityTier: mapAuthorityTier(row.authorityTier),
    translationStatus: mapTranslationStatus(row.translationStatus),
    metadata: {
      sourceId: row.sourceId,
      sourceVersionId: row.sourceVersionId,
      renditionId: row.renditionId,
      processingGenerationId: row.processingGenerationId,
      snapshotId: row.snapshotId,
      familyCode: row.familyCode,
      title: row.sourceTitle,
      officialSourceUrl: row.officialSourceUrl,
      language: row.locale,
      pageNumber: row.pageNumber,
      sectionPath: row.sectionPath,
      mappedLegalProvisionKey: row.mappedProvisionKey,
      selectionRole: preferred.has(row.mappedProvisionKey ?? "")
        ? "mapped_primary"
        : "secondary_context",
      retrievalPolicyVersion: "snapshot_grounding_v1",
      lexicalScore: Number(row.lexicalScore),
      semanticScore: Number(row.semanticScore),
      combinedScore: Number(row.score),
      queryHash: createHash("sha256").update(input.query).digest("hex"),
    },
  }));
}

function mapAuthorityTier(
  value: "official" | "trusted_translation" | "secondary",
) {
  return value === "official"
    ? ("primary_authority" as const)
    : value === "trusted_translation"
      ? ("official_guidance" as const)
      : ("curated_secondary" as const);
}

function mapTranslationStatus(
  value: "original" | "official" | "reviewed" | "unreviewed",
) {
  return value === "original" || value === "official"
    ? ("official" as const)
    : value === "reviewed"
      ? ("reviewed_internal" as const)
      : ("machine_assisted" as const);
}
