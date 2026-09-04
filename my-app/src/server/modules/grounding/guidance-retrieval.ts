import { createHash } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db";
import {
  guidanceChunks,
  guidanceProvisionBindings,
  guidanceSources,
} from "@/src/db/schema";
import type { GroundingContextItem } from "./types";

/** Keeps one verbose section from crowding out the rest of the prompt. */
export const GUIDANCE_RETRIEVAL_POLICY = {
  version: "guidance_binding_v1",
  maximumChunks: 2,
  maximumExcerptCharacters: 1_200,
} as const;

/**
 * Resolves authored guidance for a category through reviewed provision-key
 * bindings.
 *
 * Binding lookup rather than search, for the same reason the legal corpus
 * leans on `legalProvisionChunkBindings`: `to_tsvector('simple', …)` applies no
 * stemming and no stopword removal, so German compounds such as
 * "Sicherheitsmaßnahmen" never match "Sicherheitsmaßnahme". The generated
 * `searchVector` exists for a possible later fallback, not for this path.
 *
 * Unlike `retrievePinnedLegalContext` this never throws when nothing is bound.
 * Legal authority is mandatory for a finding; guidance is optional enrichment,
 * and a category with no reviewed binding must still generate.
 *
 * Items carry no `label`, so the model reads them as background and has no
 * handle with which to cite them — guidance is never a citable source.
 */
export async function retrieveGuidanceContext(input: {
  queryUnitId: string;
  provisionKeys: string[];
  limit?: number;
}): Promise<GroundingContextItem[]> {
  const keys = [...new Set(input.provisionKeys)].filter(Boolean);
  if (!keys.length) return [];

  const rows = await db
    .select({
      chunkId: guidanceChunks.id,
      text: guidanceChunks.text,
      contentHash: guidanceChunks.contentHash,
      sectionPath: guidanceChunks.sectionPath,
      position: guidanceProvisionBindings.position,
      provisionKey: guidanceProvisionBindings.stableProvisionKey,
      sourceId: guidanceSources.id,
      sourceSlug: guidanceSources.slug,
      sourceTitle: guidanceSources.title,
      publisher: guidanceSources.publisher,
      sourceVersion: guidanceSources.version,
      url: guidanceSources.url,
      licence: guidanceSources.licence,
      attribution: guidanceSources.attribution,
      language: guidanceSources.language,
    })
    .from(guidanceProvisionBindings)
    .innerJoin(
      guidanceChunks,
      eq(guidanceChunks.id, guidanceProvisionBindings.chunkId),
    )
    .innerJoin(guidanceSources, eq(guidanceSources.id, guidanceChunks.sourceId))
    .where(inArray(guidanceProvisionBindings.stableProvisionKey, keys))
    .orderBy(
      asc(guidanceProvisionBindings.position),
      asc(guidanceChunks.position),
    );

  const limit = Math.max(
    1,
    Math.min(input.limit ?? GUIDANCE_RETRIEVAL_POLICY.maximumChunks, 5),
  );
  const seen = new Set<string>();
  const selected: typeof rows = [];
  for (const row of rows) {
    // A chunk bound to several provision keys must appear once.
    if (seen.has(row.chunkId)) continue;
    seen.add(row.chunkId);
    selected.push(row);
    if (selected.length >= limit) break;
  }

  return selected.map((row, index) => {
    const excerpt = truncate(
      row.text,
      GUIDANCE_RETRIEVAL_POLICY.maximumExcerptCharacters,
    );
    return {
      channel: "guidance",
      citationId: `GUIDE:${input.queryUnitId}:${row.chunkId}`,
      queryUnitId: input.queryUnitId,
      sourceId: row.chunkId,
      excerpt,
      excerptHash:
        row.contentHash || createHash("sha256").update(excerpt).digest("hex"),
      rank: index + 1,
      score: 1,
      metadata: {
        sourceId: row.sourceId,
        slug: row.sourceSlug,
        title: row.sourceTitle,
        publisher: row.publisher,
        sourceVersion: row.sourceVersion,
        url: row.url,
        licence: row.licence,
        attribution: row.attribution,
        language: row.language,
        sectionPath: row.sectionPath,
        mappedLegalProvisionKey: row.provisionKey,
        selectionRole: "bound_guidance",
        retrievalPolicyVersion: GUIDANCE_RETRIEVAL_POLICY.version,
      },
    };
  });
}

function truncate(value: string, maximum: number) {
  const normalized = value.trim();
  if (normalized.length <= maximum) return normalized;
  const cut = normalized.slice(0, maximum);
  const boundary = cut.lastIndexOf(" ");
  return `${boundary > maximum * 0.6 ? cut.slice(0, boundary) : cut}…`;
}
