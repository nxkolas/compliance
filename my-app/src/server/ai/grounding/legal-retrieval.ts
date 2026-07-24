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
  legalSourceChunks,
  legalSourceProcessingGenerations,
  legalSourceRenditions,
  legalSources,
  legalSourceVersions,
} from "@/src/db/schema";
import { createDocumentEmbeddingProvider, validateEmbeddings, type DocumentEmbeddingProvider } from "@/src/server/documents";
import type { GroundingContextItem } from "./types";
import { ApiError } from "../../api/errors";

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
    tierLimits?: Partial<Record<"primary_authority" | "official_guidance" | "curated_secondary", number>>;
  },
  dependencies: { embeddingProvider?: DocumentEmbeddingProvider } = {},
): Promise<GroundingContextItem[]> {
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
  const provider = dependencies.embeddingProvider ?? createDocumentEmbeddingProvider();
  const [queryEmbedding] = await provider.embed([input.query]);
  validateEmbeddings([queryEmbedding], 1, provider.dimensions);
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;
  const lexical = sql<number>`coalesce(ts_rank_cd(${legalSourceChunks.searchVector}, websearch_to_tsquery('simple', ${input.query})), 0)`;
  const semantic = sql<number>`1 - (${legalSourceChunkEmbeddings.embedding} <=> ${vectorLiteral}::vector)`;
  const score = sql<number>`(${lexical} * 0.35) + (${semantic} * 0.65)`;
  const rows = await db.select({
    chunkId: legalSourceChunks.id,
    text: legalSourceChunks.text,
    textHash: legalSourceChunks.textHash,
    pageNumber: legalSourceChunks.pageNumber,
    sectionPath: legalSourceChunks.sectionPath,
    provisionCode: legalSourceChunks.provisionCode,
    anchorMetadata: legalSourceChunks.anchorMetadata,
    sourceId: legalSources.id,
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
    .orderBy(desc(score), legalSourceChunks.id)
    .limit(60);

  const limits = { primary_authority: 6, official_guidance: 3, curated_secondary: 2, ...input.tierLimits };
  const used = { primary_authority: 0, official_guidance: 0, curated_secondary: 0 };
  return rows.filter((row) => used[row.authorityTier]++ < limits[row.authorityTier]).map((row, index) => ({
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
      ...((row.anchorMetadata && typeof row.anchorMetadata === "object") ? row.anchorMetadata : {}),
      withdrawnAfterPin: Boolean(row.sourceWithdrawnAt), queryHash: createHash("sha256").update(input.query).digest("hex"),
    },
  }));
}
