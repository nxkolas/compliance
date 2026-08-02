import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { and, asc, eq, sql } from "drizzle-orm";
import { closeDbConnection, db } from "@/src/db";
import {
  legalCorpusFamilies,
  legalCorpusSnapshotMembers,
  legalCorpusSnapshots,
  legalSourceProcessingGenerations,
  legalSourceRenditions,
  legalSources,
  legalSourceVersions,
} from "@/src/db/schema";
import { currentGapContractDefinition } from "@/src/server/gap-analysis/current-contract";
import { getSupabaseAdminClient } from "@/src/server/supabase-admin";

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const outputDirectory = option("--output-directory");
  const operatorIdentity = option("--operator");
  if (!outputDirectory || !operatorIdentity?.trim()) {
    throw new Error(
      "Usage: npm run db:export:active-corpus -- --output-directory <path> --operator <identity>",
    );
  }
  const absoluteOutput = resolve(outputDirectory);
  await mkdir(absoluteOutput, { recursive: true });

  for (const familyCode of currentGapContractDefinition.requiredCorpusFamilies) {
    const rows = await db.select({
      familyCode: legalCorpusFamilies.code,
      familyTitle: legalCorpusFamilies.title,
      sourceCode: legalSources.code,
      sourceTitle: legalSources.title,
      jurisdictionCode: legalSources.jurisdictionCode,
      authorityTier: legalSources.authorityTier,
      officialSourceUrl: legalSources.officialSourceUrl,
      versionLabel: legalSourceVersions.versionLabel,
      versionContentHash: legalSourceVersions.contentHash,
      effectiveFrom: legalSourceVersions.effectiveFrom,
      effectiveTo: legalSourceVersions.effectiveTo,
      sourceRetrievedAt: legalSourceVersions.sourceRetrievedAt,
      locale: legalSourceRenditions.locale,
      translationStatus: legalSourceRenditions.translationStatus,
      storageBucket: legalSourceRenditions.storageBucket,
      storageKey: legalSourceRenditions.storageKey,
      renditionContentHash: legalSourceRenditions.contentHash,
      parser: legalSourceProcessingGenerations.parser,
      embeddingModel: legalSourceProcessingGenerations.embeddingModel,
    }).from(legalCorpusFamilies)
      .innerJoin(
        legalCorpusSnapshots,
        and(
          eq(legalCorpusSnapshots.id, legalCorpusFamilies.currentSnapshotId),
          eq(legalCorpusSnapshots.familyId, legalCorpusFamilies.id),
        ),
      )
      .innerJoin(
        legalCorpusSnapshotMembers,
        eq(legalCorpusSnapshotMembers.snapshotId, legalCorpusSnapshots.id),
      )
      .innerJoin(
        legalSourceProcessingGenerations,
        eq(
          legalSourceProcessingGenerations.id,
          legalCorpusSnapshotMembers.processingGenerationId,
        ),
      )
      .innerJoin(
        legalSourceVersions,
        eq(legalSourceVersions.id, legalCorpusSnapshotMembers.sourceVersionId),
      )
      .innerJoin(
        legalSourceRenditions,
        eq(legalSourceRenditions.id, legalCorpusSnapshotMembers.renditionId),
      )
      .innerJoin(
        legalSources,
        and(
          eq(legalSources.id, legalSourceVersions.sourceId),
          eq(legalSources.familyId, legalCorpusFamilies.id),
        ),
      )
      .where(eq(legalCorpusFamilies.code, familyCode))
      .orderBy(asc(legalCorpusSnapshotMembers.position));
    const first = rows[0];
    if (!first) throw new Error(`Required family ${familyCode} has no active members`);
    for (const row of rows) {
      const { data, error } = await getSupabaseAdminClient().storage
        .from(row.storageBucket)
        .download(row.storageKey);
      if (error) throw new Error(`Could not download ${row.storageBucket}/${row.storageKey}: ${error.message}`);
      const hash = createHash("sha256")
        .update(new Uint8Array(await data.arrayBuffer()))
        .digest("hex");
      if (hash !== row.renditionContentHash) {
        throw new Error(`Stored rendition hash mismatch for ${row.storageBucket}/${row.storageKey}`);
      }
    }
    const manifest = {
      operatorIdentity,
      family: { code: first.familyCode, title: first.familyTitle },
      sources: rows.map((row) => ({
        code: row.sourceCode,
        title: row.sourceTitle,
        jurisdictionCode: row.jurisdictionCode,
        authorityTier: row.authorityTier,
        officialSourceUrl: row.officialSourceUrl,
        version: {
          versionLabel: row.versionLabel,
          contentHash: row.versionContentHash,
          effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
          effectiveTo: row.effectiveTo?.toISOString() ?? null,
          sourceRetrievedAt: row.sourceRetrievedAt.toISOString(),
        },
        rendition: {
          locale: row.locale,
          translationStatus: row.translationStatus,
          storageBucket: row.storageBucket,
          storageKey: row.storageKey,
          contentHash: row.renditionContentHash,
        },
        processing: { parser: row.parser, embeddingModel: row.embeddingModel },
      })),
    };
    const path = resolve(absoluteOutput, `${familyCode}.manifest.json`);
    if (!path.startsWith(`${absoluteOutput}\\`) && !path.startsWith(`${absoluteOutput}/`)) {
      throw new Error("Manifest output escaped the selected directory");
    }
    await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
    console.log(`Exported ${familyCode} active corpus manifest to ${path}`);
  }

  const dimensionRows = await db.execute<{ dimensions: number }>(
    // Kept out of the manifest because the model owns it, but retained beside
    // the manifests for deterministic reprocessing after recreation.
    sql`
      select vector_dims(embedding)::int as dimensions
      from legal_source_chunk_embeddings
      limit 1
    `,
  );
  const dimension = Array.from(dimensionRows)[0]?.dimensions;
  if (!dimension) throw new Error("Could not determine retained embedding dimensions");
  await writeFile(
    resolve(absoluteOutput, "embedding-dimensions.json"),
    `${JSON.stringify({ dimensions: dimension }, null, 2)}\n`,
    { flag: "wx" },
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(closeDbConnection);
