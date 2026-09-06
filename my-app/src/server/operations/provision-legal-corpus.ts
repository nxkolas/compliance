import * as z from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import {
  legalCorpusFamilies,
  legalProvisionChunkBindings,
  legalSourceProcessingGenerations,
  legalSourceRenditions,
  legalSources,
  legalSourceVersions,
  platformAuditEvents,
} from "@/src/db/schema";
import { enqueueJob } from "@/src/server/platform/jobs";

const timestamp = z.iso.datetime().transform((value) => new Date(value));
const optionalTimestamp = z.union([timestamp, z.null()]).optional();

export const legalCorpusProvisionManifestSchema = z.object({
  operatorIdentity: z.string().trim().min(1),
  family: z.object({
    code: z.string().trim().min(1),
    title: z.string().trim().min(1),
  }),
  sources: z.array(z.object({
    code: z.string().trim().min(1),
    title: z.string().trim().min(1),
    jurisdictionCode: z.string().length(2),
    authorityTier: z.enum(["official", "trusted_translation", "secondary"]),
    officialSourceUrl: z.url(),
    version: z.object({
      versionLabel: z.string().trim().min(1),
      contentHash: z.string().regex(/^[a-f0-9]{64}$/),
      effectiveFrom: optionalTimestamp,
      effectiveTo: optionalTimestamp,
      sourceRetrievedAt: timestamp,
    }),
    rendition: z.object({
      locale: z.enum(["de", "en"]),
      translationStatus: z.enum(["original", "official", "reviewed", "unreviewed"]),
      storageBucket: z.string().trim().min(1),
      storageKey: z.string().trim().min(1),
      contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    }),
    processing: z.object({
      parser: z.string().trim().min(1),
    }),
  })).min(1),
});

export type LegalCorpusProvisionManifest = z.input<
  typeof legalCorpusProvisionManifestSchema
>;

export async function provisionLegalCorpus(
  unparsed: LegalCorpusProvisionManifest,
) {
  const input = legalCorpusProvisionManifestSchema.parse(unparsed);
  return db.transaction(async (tx) => {
    await tx.insert(legalCorpusFamilies).values(input.family)
      .onConflictDoNothing({ target: legalCorpusFamilies.code });
    const family = await tx.query.legalCorpusFamilies.findFirst({
      where: {
        RAW: (table, operators) =>
          eq(table.code, input.family.code) ?? operators.sql`true`,
      },
    });
    if (!family) throw new Error("Legal corpus family was not created");

    const generations = [];
    for (const sourceInput of input.sources) {
      await tx.insert(legalSources).values({
        familyId: family.id,
        code: sourceInput.code,
        title: sourceInput.title,
        jurisdictionCode: sourceInput.jurisdictionCode,
        authorityTier: sourceInput.authorityTier,
        officialSourceUrl: sourceInput.officialSourceUrl,
      }).onConflictDoNothing({
        target: [legalSources.familyId, legalSources.code],
      });
      const source = await tx.query.legalSources.findFirst({
        where: {
          RAW: (table, operators) =>
            and(
              eq(table.familyId, family.id),
              eq(table.code, sourceInput.code),
            ) ?? operators.sql`true`,
        },
      });
      if (!source) throw new Error(`Legal source ${sourceInput.code} was not created`);

      await tx.insert(legalSourceVersions).values({
        familyId: family.id,
        sourceId: source.id,
        ...sourceInput.version,
      }).onConflictDoNothing({
        target: [legalSourceVersions.sourceId, legalSourceVersions.versionLabel],
      });
      const version = await tx.query.legalSourceVersions.findFirst({
        where: {
          RAW: (table, operators) =>
            and(
              eq(table.sourceId, source.id),
              eq(table.versionLabel, sourceInput.version.versionLabel),
            ) ?? operators.sql`true`,
        },
      });
      if (!version || version.contentHash !== sourceInput.version.contentHash) {
        throw new Error(`Legal source version ${sourceInput.version.versionLabel} conflicts with the manifest`);
      }

      await tx.insert(legalSourceRenditions).values({
        sourceVersionId: version.id,
        ...sourceInput.rendition,
      }).onConflictDoNothing({
        target: [legalSourceRenditions.sourceVersionId, legalSourceRenditions.locale],
      });
      const rendition = await tx.query.legalSourceRenditions.findFirst({
        where: {
          RAW: (table, operators) =>
            and(
              eq(table.sourceVersionId, version.id),
              eq(table.locale, sourceInput.rendition.locale),
            ) ?? operators.sql`true`,
        },
      });
      if (!rendition || rendition.contentHash !== sourceInput.rendition.contentHash) {
        throw new Error(`Legal rendition ${sourceInput.rendition.locale} conflicts with the manifest`);
      }

      await tx.insert(legalSourceProcessingGenerations).values({
        renditionId: rendition.id,
        status: "pending",
        ...sourceInput.processing,
      }).onConflictDoNothing({
        target: [
          legalSourceProcessingGenerations.renditionId,
          legalSourceProcessingGenerations.parser,
        ],
      });
      const generation = await tx.query.legalSourceProcessingGenerations.findFirst({
        where: {
          RAW: (table, operators) =>
            and(
              eq(table.renditionId, rendition.id),
              eq(table.parser, sourceInput.processing.parser),
            ) ?? operators.sql`true`,
        },
      });
      if (!generation) throw new Error("Legal processing generation was not created");
      if (!generation.jobId && generation.status === "pending") {
        const job = await enqueueJob({
          kind: "legal_source_processing",
          payload: { processingGenerationId: generation.id },
        }, { executor: tx });
        await tx.update(legalSourceProcessingGenerations)
          .set({ jobId: job.id })
          .where(eq(legalSourceProcessingGenerations.id, generation.id));
        generation.jobId = job.id;
      }
      generations.push({
        sourceId: source.id,
        versionId: version.id,
        renditionId: rendition.id,
        processingGenerationId: generation.id,
        jobId: generation.jobId,
      });
    }
    await tx.insert(platformAuditEvents).values({
      operatorIdentity: input.operatorIdentity,
      eventType: "legal_corpus.provisioned",
      entityType: "legal_corpus_family",
      entityId: family.id,
      metadata: {
        familyCode: family.code,
        sources: input.sources.map((source) => source.code),
      },
    });
    return { family, generations };
  });
}

export async function bindLegalProvisions(input: {
  operatorIdentity: string;
  bindings: Array<{
    stableProvisionKey: string;
    chunkId: string;
    position: number;
  }>;
}) {
  if (!input.operatorIdentity.trim()) throw new Error("Operator identity is required");
  if (!input.bindings.length) throw new Error("At least one legal provision binding is required");
  return db.transaction(async (tx) => {
    for (const binding of input.bindings) {
      await tx.insert(legalProvisionChunkBindings).values({
        ...binding,
        reviewedBy: input.operatorIdentity,
        reviewedAt: new Date(),
      }).onConflictDoUpdate({
        target: [
          legalProvisionChunkBindings.stableProvisionKey,
          legalProvisionChunkBindings.chunkId,
        ],
        set: {
          position: binding.position,
          reviewedBy: input.operatorIdentity,
          reviewedAt: new Date(),
        },
      });
    }
    await tx.insert(platformAuditEvents).values({
      operatorIdentity: input.operatorIdentity,
      eventType: "legal_provision.bindings_updated",
      entityType: "legal_provision_chunk_binding",
      entityId: input.bindings[0]!.chunkId,
      metadata: { count: input.bindings.length },
    });
    return { count: input.bindings.length };
  });
}
