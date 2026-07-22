import "dotenv/config";
import * as z from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { closeDbConnection, db } from "@/src/db";
import { backgroundJobs, legalCorpusFamilies, legalSources, legalSourceVersions } from "@/src/db/schema";
import { createCorpusFamily, createLegalSource } from "@/src/server/corpus/catalog-service";
import { NIS2_CORPUS_BOOTSTRAP_FIXTURE, NIS2_CORPUS_BOOTSTRAP_NOTICE } from "@/src/server/corpus/nis2-bootstrap-fixture";
import { enqueueLegalSourceUrlImport } from "@/src/server/corpus/url-import-service";

const inputSchema = z.object({ actorUserId: z.uuid() });

async function main() {
  const { actorUserId } = inputSchema.parse({ actorUserId: process.argv[2] });
  console.log(NIS2_CORPUS_BOOTSTRAP_NOTICE);
  for (const fixture of NIS2_CORPUS_BOOTSTRAP_FIXTURE) {
    const existingFamily = await db.query.legalCorpusFamilies.findFirst({
      where: eq(legalCorpusFamilies.code, fixture.family.code),
    });
    const family = existingFamily ?? await createCorpusFamily({ actorUserId, ...fixture.family });
    const existingSource = await db.query.legalSources.findFirst({
      where: and(eq(legalSources.familyId, family.id), eq(legalSources.stableCode, fixture.source.stableCode)),
    });
    const source = existingSource ?? await createLegalSource({ actorUserId, familyId: family.id, ...fixture.source });
    const version = await db.query.legalSourceVersions.findFirst({
      where: and(eq(legalSourceVersions.sourceId, source.id), eq(legalSourceVersions.versionLabel, fixture.import.versionLabel)),
    });
    const activeImport = await db.query.backgroundJobs.findFirst({
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
