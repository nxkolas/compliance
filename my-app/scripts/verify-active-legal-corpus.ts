import "dotenv/config";
import { asc, eq } from "drizzle-orm";
import { closeDbConnection, db } from "@/src/db";
import {
  legalCorpusFamilies,
  legalCorpusSnapshotMembers,
  legalCorpusSnapshots,
} from "@/src/db/schema";
import { validateLegalCorpusActivationCandidate } from "@/src/server/modules/legal-corpus";
import { currentGapContractDefinition } from "@/src/server/modules/gap-analysis";

async function main() {
  for (const familyCode of currentGapContractDefinition.requiredCorpusFamilies) {
    const [active] = await db.select({
      familyId: legalCorpusFamilies.id,
      snapshotId: legalCorpusSnapshots.id,
      contentHash: legalCorpusSnapshots.contentHash,
    }).from(legalCorpusFamilies)
      .innerJoin(
        legalCorpusSnapshots,
        eq(legalCorpusSnapshots.id, legalCorpusFamilies.currentSnapshotId),
      )
      .where(eq(legalCorpusFamilies.code, familyCode));
    if (!active) throw new Error(`Required corpus family ${familyCode} has no active snapshot`);
    const members = await db.select({
      processingGenerationId: legalCorpusSnapshotMembers.processingGenerationId,
    }).from(legalCorpusSnapshotMembers)
      .where(eq(legalCorpusSnapshotMembers.snapshotId, active.snapshotId))
      .orderBy(asc(legalCorpusSnapshotMembers.position));
    const validated = await validateLegalCorpusActivationCandidate({
      familyCode,
      processingGenerationIds: members.map((member) => member.processingGenerationId),
    });
    console.log(
      `Verified active corpus ${familyCode}: members=${members.length} chunks=${validated.chunkCount} bindings=${validated.bindingCount} hash=${active.contentHash}`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(closeDbConnection);
