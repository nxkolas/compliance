import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { closeDbConnection, db } from "@/src/db";
import { backgroundJobs, legalCorpusReleaseMembers, legalCorpusReleases, legalSourceChunks } from "@/src/db/schema";
import { getLegalCitationSource, createLegalSourceAccess } from "@/src/server/corpus/operations-service";

const actorUserId = required("CORPUS_SMOKE_PLATFORM_ADMIN_USER_ID");
const releaseId = required("CORPUS_SMOKE_RELEASE_ID");

async function main() {
  const release = await db.query.legalCorpusReleases.findFirst({ where: eq(legalCorpusReleases.id, releaseId) });
  if (!release || release.status !== "published" || release.evaluationState !== "passed") {
    throw new Error("Smoke release must be published and evaluation-passed");
  }
  const member = await db.query.legalCorpusReleaseMembers.findFirst({ where: eq(legalCorpusReleaseMembers.releaseId, release.id) });
  if (!member) throw new Error("Smoke release has no member");
  const chunk = await db.query.legalSourceChunks.findFirst({ where: eq(legalSourceChunks.generationId, member.processingGenerationId) });
  if (!chunk) throw new Error("Smoke release member has no chunk");
  const citation = await getLegalCitationSource({ actorUserId, corpusReleaseId: release.id, chunkId: chunk.id });
  const access = await createLegalSourceAccess({ actorUserId, renditionId: citation.rendition.id, expiresInSeconds: 30 });
  if (!access.url.startsWith("http")) throw new Error("Private source access did not return a signed URL");
  const succeededJob = await db.query.backgroundJobs.findFirst({
    where: and(eq(backgroundJobs.state, "succeeded"), eq(backgroundJobs.resultId, member.processingGenerationId)),
  });
  if (!succeededJob) throw new Error("No succeeded processing job proves worker execution for the smoke generation");
  console.log(`API/corpus smoke passed for release ${release.id}, chunk ${chunk.id}, and job ${succeededJob.id}.`);
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

main()
  .catch((error) => {
    console.error("API/corpus smoke failed", { errorType: error instanceof Error ? error.name : "unknown" });
    process.exitCode = 1;
  })
  .finally(() => closeDbConnection());
