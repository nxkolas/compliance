import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
  complianceCheckReleaseCorpusReleases,
  gapAnalysisReleaseCorpusReleases,
  legalCorpusFamilies,
  legalCorpusReleaseMembers,
  legalCorpusReleases,
  legalSourceChunkEmbeddings,
  legalSourceChunkProvisions,
  legalSourceChunks,
  legalSourceProcessingGenerations,
  legalSourceRenditions,
  legalSources,
  legalSourceVersions,
} from "@/src/db/schema";
import { createDocumentEmbeddingProvider, validateEmbeddings, type DocumentEmbeddingProvider } from "@/src/server/documents";
import type { GroundingContextItem } from "./types";
import { ApiError } from "../../api/errors";

export async function resolvePinnedLegalScope(input: {
  workflowKind: "compliance" | "gap";
  workflowReleaseId: string;
  familyCodes: string[];
}) {
  const pins = input.workflowKind === "gap"
    ? await db.select({ familyId: gapAnalysisReleaseCorpusReleases.familyId, releaseId: gapAnalysisReleaseCorpusReleases.corpusReleaseId })
        .from(gapAnalysisReleaseCorpusReleases)
        .innerJoin(legalCorpusFamilies, eq(gapAnalysisReleaseCorpusReleases.familyId, legalCorpusFamilies.id))
        .where(and(eq(gapAnalysisReleaseCorpusReleases.gapAnalysisReleaseId, input.workflowReleaseId), inArray(legalCorpusFamilies.code, input.familyCodes)))
    : await db.select({ familyId: complianceCheckReleaseCorpusReleases.familyId, releaseId: complianceCheckReleaseCorpusReleases.corpusReleaseId })
        .from(complianceCheckReleaseCorpusReleases)
        .innerJoin(legalCorpusFamilies, eq(complianceCheckReleaseCorpusReleases.familyId, legalCorpusFamilies.id))
        .where(and(eq(complianceCheckReleaseCorpusReleases.checkReleaseId, input.workflowReleaseId), inArray(legalCorpusFamilies.code, input.familyCodes)));
  if (pins.length !== new Set(input.familyCodes).size) {
    throw new ApiError(409, "Workflow release has incomplete corpus pins", undefined, "CORPUS_PINS_INCOMPLETE");
  }
  return pins;
}

export async function retrievePinnedLegalContext(
  input: {
    workflowKind: "compliance" | "gap";
    workflowReleaseId: string;
    familyCodes: string[];
    frameworkCode: string;
    jurisdictionCodes: string[];
    asOfDate: string;
    language: string;
    queryUnitId: string;
    query: string;
    preferredMappedLegalProvisionIds?: string[];
    preferredMappedLegalProvisionKeys?: string[];
    tierLimits?: Partial<Record<"primary_authority" | "official_guidance" | "curated_secondary", number>>;
    pinnedReleases?: Array<{ familyId: string; releaseId: string }>;
  },
  dependencies: {
    embeddingProvider?: DocumentEmbeddingProvider;
    queryEmbedding?: number[];
  } = {},
): Promise<GroundingContextItem[]> {
  const pins = input.pinnedReleases ?? await resolvePinnedLegalScope(input);
  const provider = dependencies.embeddingProvider ?? createDocumentEmbeddingProvider();
  const queryEmbedding = dependencies.queryEmbedding ??
    (await provider.embed([input.query], "query"))[0];
  if (!queryEmbedding) throw new Error("Query embedding is missing");
  validateEmbeddings([queryEmbedding], 1, provider.dimensions);
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;
  const lexical = sql<number>`coalesce(ts_rank_cd(${legalSourceChunks.searchVector}, websearch_to_tsquery('simple', ${input.query})), 0)`;
  const semantic = sql<number>`1 - (${legalSourceChunkEmbeddings.embedding} OPERATOR(extensions.<=>) ${vectorLiteral}::extensions.vector)`;
  const score = sql<number>`(${lexical} * 0.35) + (${semantic} * 0.65)`;
  const preferredProvisionIds = [
    ...new Set(input.preferredMappedLegalProvisionIds ?? []),
  ];
  const mappedProvisionId = sql<string | null>`coalesce(
    ${legalSourceChunkProvisions.legalProvisionId},
    ${legalSources.legalProvisionId}
  )`;
  const preferredRank = preferredProvisionIds.length
    ? sql<number>`case when ${inArray(mappedProvisionId, preferredProvisionIds)} then 1 else 0 end`
    : sql<number>`0`;
  const rows = await db.select({
    chunkId: legalSourceChunks.id,
    text: legalSourceChunks.text,
    textHash: legalSourceChunks.textHash,
    pageNumber: legalSourceChunks.pageNumber,
    sectionPath: legalSourceChunks.sectionPath,
    provisionCode: legalSourceChunks.provisionCode,
    anchorMetadata: legalSourceChunks.anchorMetadata,
    sourceId: legalSources.id,
    legalProvisionId: mappedProvisionId,
    sourceTitle: legalSources.title,
    authorityTier: legalSources.authorityTier,
    sourceWithdrawnAt: legalSources.withdrawnAt,
    sourceVersionId: legalSourceVersions.id,
    effectiveFrom: legalSourceVersions.effectiveFrom,
    effectiveTo: legalSourceVersions.effectiveTo,
    renditionId: legalSourceRenditions.id,
    language: legalSourceRenditions.language,
    translationStatus: legalSourceRenditions.translationStatus,
    corpusReleaseId: legalCorpusReleases.id,
    processingGenerationId: legalSourceProcessingGenerations.id,
    processingSourceHash: legalSourceProcessingGenerations.normalizedTextHash,
    familyCode: legalCorpusFamilies.code,
    lexicalScore: lexical,
    semanticScore: semantic,
    score,
  }).from(legalCorpusReleaseMembers)
    .innerJoin(legalCorpusReleases, eq(legalCorpusReleaseMembers.releaseId, legalCorpusReleases.id))
    .innerJoin(legalCorpusFamilies, eq(legalCorpusReleases.familyId, legalCorpusFamilies.id))
    .innerJoin(legalSourceVersions, eq(legalCorpusReleaseMembers.sourceVersionId, legalSourceVersions.id))
    .innerJoin(legalSources, eq(legalSourceVersions.sourceId, legalSources.id))
    .innerJoin(legalSourceRenditions, eq(legalCorpusReleaseMembers.renditionId, legalSourceRenditions.id))
    .innerJoin(legalSourceProcessingGenerations, and(
      eq(legalCorpusReleaseMembers.processingGenerationId, legalSourceProcessingGenerations.id),
      eq(legalSourceProcessingGenerations.state, "reviewed"),
    ))
    .innerJoin(legalSourceChunks, eq(legalSourceChunks.generationId, legalSourceProcessingGenerations.id))
    .leftJoin(
      legalSourceChunkProvisions,
      eq(
        legalSourceChunkProvisions.chunkId,
        legalSourceChunks.id,
      ),
    )
    .innerJoin(legalSourceChunkEmbeddings, and(
      eq(legalSourceChunkEmbeddings.generationId, legalSourceProcessingGenerations.id),
      eq(legalSourceChunkEmbeddings.chunkId, legalSourceChunks.id),
      eq(legalSourceChunkEmbeddings.provider, provider.provider),
      eq(legalSourceChunkEmbeddings.model, provider.model),
      eq(legalSourceChunkEmbeddings.dimensions, provider.dimensions),
    ))
    .where(and(
      inArray(legalCorpusReleases.id, pins.map((pin) => pin.releaseId)),
      eq(legalCorpusReleases.status, "published"),
      inArray(legalCorpusFamilies.code, input.familyCodes),
      eq(legalCorpusFamilies.frameworkCode, input.frameworkCode),
      inArray(legalCorpusFamilies.jurisdictionCode, input.jurisdictionCodes),
      or(isNull(legalSourceVersions.effectiveFrom), lte(legalSourceVersions.effectiveFrom, input.asOfDate)),
      or(isNull(legalSourceVersions.effectiveTo), sql`${legalSourceVersions.effectiveTo} >= ${input.asOfDate}`),
      or(eq(legalSourceRenditions.language, input.language), eq(legalSourceRenditions.translationStatus, "official")),
    ))
    .orderBy(desc(preferredRank), desc(score), legalSourceChunks.id)
    .limit(60);

  const limits = { primary_authority: 6, official_guidance: 3, curated_secondary: 2, ...input.tierLimits };
  const used = { primary_authority: 0, official_guidance: 0, curated_secondary: 0 };
  const preferred = new Set(preferredProvisionIds);
  const preferredRows = rows.filter(
    (row) =>
      row.legalProvisionId !== null &&
      preferred.has(row.legalProvisionId) &&
      row.authorityTier === "primary_authority" &&
      row.translationStatus === "official",
  );
  const coveredPreferredIds = new Set(
    preferredRows.flatMap((row) =>
      row.legalProvisionId ? [row.legalProvisionId] : [],
    ),
  );
  const missingPreferredIds = preferredProvisionIds.filter(
    (id) => !coveredPreferredIds.has(id),
  );
  if (missingPreferredIds.length > 0) {
    throw new ApiError(
      409,
      "Mapped legal authority is unavailable for this Gap requirement",
      {
        missingMappedProvisionKeys:
          input.preferredMappedLegalProvisionKeys ?? [],
      },
      "GAP_MAPPED_LEGAL_AUTHORITY_MISSING",
    );
  }
  const selected = new Map<string, (typeof rows)[number]>();
  const selectedMappedFamilies = new Set<string>();
  const mappedPrimaryContextLimit = Math.min(2, pins.length);
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
    if (used[row.authorityTier]++ < limits[row.authorityTier]) {
      selected.set(row.chunkId, row);
    }
  }
  return [...selected.values()].map((row, index) => ({
    channel: "legal",
    citationId: `LEGAL:${input.queryUnitId}:${row.chunkId}`,
    queryUnitId: input.queryUnitId,
    sourceId: row.chunkId,
    excerpt: row.text,
    excerptHash: row.textHash,
    rank: index + 1,
    score: Number(row.score),
    authorityTier: row.authorityTier,
    translationStatus: row.translationStatus,
    metadata: {
      sourceId: row.sourceId, sourceVersionId: row.sourceVersionId, renditionId: row.renditionId, processingGenerationId: row.processingGenerationId, processingSourceHash: row.processingSourceHash,
      title: row.sourceTitle, familyCode: row.familyCode, corpusReleaseId: row.corpusReleaseId,
      language: row.language, pageNumber: row.pageNumber, sectionPath: row.sectionPath,
      provisionCode: row.provisionCode, effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo,
      legalProvisionId: row.legalProvisionId,
      mappedLegalProvisionKey:
        row.legalProvisionId && preferred.has(row.legalProvisionId)
          ? input.preferredMappedLegalProvisionKeys?.[
              preferredProvisionIds.indexOf(row.legalProvisionId)
            ]
          : undefined,
      selectionRole:
        row.legalProvisionId && preferred.has(row.legalProvisionId)
          ? "mapped_primary"
          : "secondary_context",
      retrievalPolicyVersion: "gap_mapped_legal_authority_v1",
      preferredMappedProvision:
        row.legalProvisionId !== null &&
        preferred.has(row.legalProvisionId),
      lexicalScore: Number(row.lexicalScore),
      semanticScore: Number(row.semanticScore),
      combinedScore: Number(row.score),
      ...((row.anchorMetadata && typeof row.anchorMetadata === "object") ? row.anchorMetadata : {}),
      withdrawnAfterPin: Boolean(row.sourceWithdrawnAt), queryHash: createHash("sha256").update(input.query).digest("hex"),
    },
  }));
}
