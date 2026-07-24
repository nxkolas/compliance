import "dotenv/config";
import * as z from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { closeDbConnection, db } from "@/src/db";
import { backgroundJobs, legalCorpusFamilies, legalSources, legalSourceVersions } from "@/src/db/schema";
import { createCorpusFamily, createLegalSource } from "@/src/server/corpus";
import { NIS2_CORPUS_BOOTSTRAP_FIXTURE, NIS2_CORPUS_BOOTSTRAP_NOTICE } from "@/src/server/corpus";
import { enqueueLegalSourceUrlImport } from "@/src/server/corpus";

const inputSchema = z.object({ actorUserId: z.uuid() });

async function main() {
  const { actorUserId } = inputSchema.parse({ actorUserId: process.argv[2] });
  console.log(NIS2_CORPUS_BOOTSTRAP_NOTICE);
  for (const fixture of NIS2_CORPUS_BOOTSTRAP_FIXTURE) {
    const existingFamily = await db.query.legalCorpusFamilies.findFirst({ columns: { id: true, code: true, frameworkCode: true, jurisdictionCode: true, title: true, archivedAt: true, version: true, createdBy: true, createdAt: true, updatedAt: true },
      where: eq(legalCorpusFamilies.code, fixture.family.code),
    });
    const family = existingFamily ?? await createCorpusFamily({ actorUserId, ...fixture.family });
    const existingSource = await db.query.legalSources.findFirst({ columns: { id: true, familyId: true, stableCode: true, title: true, sourceKind: true, authorityTier: true, canonicalPublisher: true, legalInstrumentId: true, legalProvisionId: true, withdrawnAt: true, withdrawalReason: true, version: true, createdBy: true, createdAt: true, updatedAt: true },
      where: and(eq(legalSources.familyId, family.id), eq(legalSources.stableCode, fixture.source.stableCode)),
    });
    const source = existingSource ?? await createLegalSource({ actorUserId, familyId: family.id, ...fixture.source });
    const version = await db.query.legalSourceVersions.findFirst({ columns: { id: true, sourceId: true, versionLabel: true, officialIdentifier: true, upstreamPublishedAt: true, retrievedAt: true, upstreamUrl: true, effectiveFrom: true, effectiveTo: true, contentHash: true, status: true, reviewedBy: true, reviewedAt: true, publishedAt: true, withdrawnBy: true, withdrawnAt: true, withdrawalReason: true, createdBy: true, createdAt: true },
      where: and(eq(legalSourceVersions.sourceId, source.id), eq(legalSourceVersions.versionLabel, fixture.import.versionLabel)),
    });
    const activeImport = await db.query.backgroundJobs.findFirst({ columns: { id: true, organizationId: true, requestedByUserId: true, kind: true, state: true, payload: true, progress: true, attemptCount: true, maxAttempts: true, cancellable: true, cancellationCapability: true, safeErrorCode: true, safeErrorMessage: true, runAfter: true, leaseOwner: true, leaseExpiresAt: true, heartbeatAt: true, cancellationRequestedAt: true, startedAt: true, finishedAt: true, createdAt: true, updatedAt: true },
      where: and(
        eq(backgroundJobs.kind, "legal-source-import"),
        inArray(backgroundJobs.state, ["queued", "running", "cancellation_requested"]),
        sql`${backgroundJobs.payload}->>'sourceId' = ${source.id}`,
        sql`${backgroundJobs.payload}->>'versionLabel' = ${fixture.import.versionLabel}`,
      ),
    });
    if (version || activeImport) {
      console.log(`Kept existing ${fixture.family.code}/${fixture.source.stableCode}.`);
      continue;
    }
    const job = await enqueueLegalSourceUrlImport({ actorUserId, sourceId: source.id, ...fixture.import });
    console.log(`Enqueued ${fixture.family.code}/${fixture.source.stableCode} as job ${job.id}.`);
  }
  console.log("No corpus version was reviewed, published, evaluated, or activated by this script.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDbConnection());
