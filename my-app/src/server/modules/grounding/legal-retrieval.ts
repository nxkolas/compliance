import { createHash } from "node:crypto";
import { and, desc, eq, gte, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/src/db";
import {
  legalCorpusFamilies,
  legalCorpusSnapshotMembers,
  legalCorpusSnapshots,
  legalProvisionChunkBindings,
  legalSourceChunks,
  legalSourceProcessingGenerations,
  legalSourceRenditions,
  legalSources,
  legalSourceVersions,
} from "@/src/db/schema";
import type { GroundingContextItem } from "./types";
import { ApiError } from "../../platform/http/errors";

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

/**
 * Fetches the reviewed chunks bound to an exact set of provision keys.
 *
 * The legal corpus is authored with a human-reviewed
 * `provision key -> chunk` mapping, so the correct authority for a mapped Gap
 * requirement is already known and does not need to be discovered by
 * similarity. Resolving it deterministically keeps legal grounding independent
 * of any embedding model, which is what allows an organization to change its
 * AI provider without re-embedding the corpus.
 */
export async function retrieveMappedProvisionRows(input: {
  provisionKeys: string[];
  asOfDate: string;
  language: "de" | "en";
  pinnedSnapshots: PinnedLegalSnapshot[];
}) {
  const asOf = new Date(`${input.asOfDate}T23:59:59.999Z`);
  return db
    .select(corpusRowShape({ lexical: sql<number>`0`, score: sql<number>`1` }))
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
      legalSourceProcessingGenerations,
      eq(
        legalSourceProcessingGenerations.id,
        legalCorpusSnapshotMembers.processingGenerationId,
      ),
    )
    .innerJoin(
      legalSourceRenditions,
      eq(legalSourceRenditions.id, legalSourceProcessingGenerations.renditionId),
    )
    .innerJoin(
      legalSourceVersions,
      eq(legalSourceVersions.id, legalSourceRenditions.sourceVersionId),
    )
    .innerJoin(legalSources, eq(legalSources.id, legalSourceVersions.sourceId))
    .innerJoin(
      legalSourceChunks,
      eq(
        legalSourceChunks.processingGenerationId,
        legalSourceProcessingGenerations.id,
      ),
    )
    .innerJoin(
      legalProvisionChunkBindings,
      and(
        eq(legalProvisionChunkBindings.chunkId, legalSourceChunks.id),
        inArray(
          legalProvisionChunkBindings.stableProvisionKey,
          input.provisionKeys,
        ),
      ),
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
    .orderBy(legalProvisionChunkBindings.position, legalSourceChunks.id);
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
): Promise<GroundingContextItem[]> {
  const requestedKeys = input.preferredMappedLegalProvisionKeys ?? [];
  const requestedLimits = {
    primary_authority: 6,
    official_guidance: 3,
    curated_secondary: 2,
    ...input.tierLimits,
  };
  const discoveryRequested =
    requestedLimits.primary_authority > 0 ||
    requestedLimits.official_guidance > 0 ||
    requestedLimits.curated_secondary > 0;

  // Gap analysis and action-plan generation ask for mapped provisions only
  // (every tier limit is zero), so the reviewed binding resolves the authority
  // directly.
  if (requestedKeys.length > 0 && !discoveryRequested) {
    const mappedRows = await retrieveMappedProvisionRows({
      provisionKeys: requestedKeys,
      asOfDate: input.asOfDate,
      language: input.language,
      pinnedSnapshots: input.pinnedSnapshots,
    });
    const eligible = mappedRows.filter(
      (row) =>
        row.authorityTier === "official" &&
        ["original", "official"].includes(row.translationStatus),
    );
    assertMappedProvisionCoverage(requestedKeys, eligible);
    return shapeGroundingItems({
      rows: selectMappedRows(eligible, input.pinnedSnapshots),
      queryUnitId: input.queryUnitId,
      query: input.query,
      preferred: new Set(requestedKeys),
    });
  }

  // Discovery beyond the reviewed bindings ranks on the full-text index alone.
  // The corpus deliberately stores no vectors, so legal grounding never depends
  // on which embedding model a deployment or organization happens to use.
  const lexical = sql<number>`coalesce(ts_rank_cd(${legalSourceChunks.searchVector}, websearch_to_tsquery('simple', ${input.query})), 0)`;
  const score = lexical;
  const asOf = new Date(`${input.asOfDate}T23:59:59.999Z`);
  const preferredKeys = requestedKeys;
  const mappedPriority = preferredKeys.length
    ? sql<number>`case when ${legalProvisionChunkBindings.stableProvisionKey} in (${sql.join(preferredKeys.map((key) => sql`${key}`), sql`, `)}) then 1 else 0 end`
    : sql<number>`0`;

  const rows = await db
    .select(corpusRowShape({ lexical, score }))
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
      legalSourceProcessingGenerations,
      eq(
        legalSourceProcessingGenerations.id,
        legalCorpusSnapshotMembers.processingGenerationId,
      ),
    )
    .innerJoin(
      legalSourceRenditions,
      eq(legalSourceRenditions.id, legalSourceProcessingGenerations.renditionId),
    )
    .innerJoin(
      legalSourceVersions,
      eq(legalSourceVersions.id, legalSourceRenditions.sourceVersionId),
    )
    .innerJoin(legalSources, eq(legalSources.id, legalSourceVersions.sourceId))
    .innerJoin(
      legalSourceChunks,
      eq(
        legalSourceChunks.processingGenerationId,
        legalSourceProcessingGenerations.id,
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
  assertMappedProvisionCoverage(preferredKeys, preferredRows);

  const used = {
    primary_authority: 0,
    official_guidance: 0,
    curated_secondary: 0,
  };
  const selected = selectMappedRows(preferredRows, input.pinnedSnapshots);
  for (const row of rows) {
    if (selected.has(row.chunkId)) continue;
    const tier = mapAuthorityTier(row.authorityTier);
    if (used[tier] >= requestedLimits[tier]) continue;
    used[tier] += 1;
    selected.set(row.chunkId, row);
  }

  return shapeGroundingItems({
    rows: selected,
    queryUnitId: input.queryUnitId,
    query: input.query,
    preferred,
  });
}

/**
 * Shared projection so the deterministic and hybrid queries return identical
 * row shapes and can share selection and citation shaping.
 */
function corpusRowShape(scores: {
  lexical: SQL<number>;
  score: SQL<number>;
}) {
  return {
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
    lexicalScore: scores.lexical,
    score: scores.score,
  };
}

type CorpusRow = {
  chunkId: string;
  text: string;
  contentHash: string | null;
  pageNumber: number | null;
  sectionPath: string | null;
  sourceId: string;
  sourceTitle: string;
  officialSourceUrl: string | null;
  authorityTier: "official" | "trusted_translation" | "secondary";
  sourceVersionId: string;
  renditionId: string;
  locale: string;
  translationStatus: "original" | "official" | "reviewed" | "unreviewed";
  processingGenerationId: string;
  snapshotId: string;
  familyCode: string;
  mappedProvisionKey: string | null;
  lexicalScore: number;
  score: number;
};

/**
 * A mapped Gap requirement without its reviewed authority is a corpus
 * integrity failure, not a retrieval miss, so it must fail loudly rather than
 * silently produce an ungrounded finding.
 */
function assertMappedProvisionCoverage(
  requestedKeys: string[],
  rows: Pick<CorpusRow, "mappedProvisionKey">[],
) {
  const covered = new Set(
    rows.flatMap((row) =>
      row.mappedProvisionKey ? [row.mappedProvisionKey] : [],
    ),
  );
  const missing = [...new Set(requestedKeys)].filter(
    (key) => !covered.has(key),
  );
  if (missing.length) {
    throw new ApiError(
      409,
      "Mapped legal authority is unavailable for this Gap requirement",
      { missingMappedProvisionKeys: missing },
      "GAP_MAPPED_LEGAL_AUTHORITY_MISSING",
    );
  }
}

function selectMappedRows<Row extends Pick<CorpusRow, "chunkId" | "familyCode">>(
  preferredRows: Row[],
  pinnedSnapshots: PinnedLegalSnapshot[],
) {
  const selected = new Map<string, Row>();
  const families = new Set<string>();
  const familyLimit = Math.min(2, pinnedSnapshots.length);
  for (const row of preferredRows) {
    if (families.has(row.familyCode) || families.size >= familyLimit) continue;
    selected.set(row.chunkId, row);
    families.add(row.familyCode);
  }
  return selected;
}

function shapeGroundingItems(input: {
  rows: Map<string, CorpusRow>;
  queryUnitId: string;
  query: string;
  preferred: Set<string>;
}): GroundingContextItem[] {
  const queryHash = createHash("sha256").update(input.query).digest("hex");
  return [...input.rows.values()].map((row, index) => ({
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
      selectionRole: input.preferred.has(row.mappedProvisionKey ?? "")
        ? "mapped_primary"
        : "secondary_context",
      retrievalPolicyVersion: "snapshot_grounding_v1",
      lexicalScore: Number(row.lexicalScore),
      combinedScore: Number(row.score),
      queryHash,
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
