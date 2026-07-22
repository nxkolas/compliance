import { db } from "@/src/db";
import {
  aiProcessingRunClaimContext,
  aiProcessingRunClaims,
  aiProcessingRunContext,
  aiProcessingRunLegalInputs,
} from "@/src/db/schema";
import type { ClaimValidation } from "./validation";
import type { GroundingContextItem } from "./types";

export async function persistGroundingProvenance(input: {
  runId: string;
  context: GroundingContextItem[];
  claims: ClaimValidation[];
  disclosedExternally: boolean;
}) {
  return db.transaction(async (tx) => {
    const legalInputs = new Map<string, {
      runId: string;
      corpusReleaseId: string;
      sourceVersionId: string;
      processingGenerationId: string;
      sourceHash: string;
    }>();
    for (const item of input.context) {
      if (item.channel !== "legal") continue;
      const corpusReleaseId = item.metadata.corpusReleaseId;
      const sourceVersionId = item.metadata.sourceVersionId;
      const processingGenerationId = item.metadata.processingGenerationId;
      if (typeof corpusReleaseId === "string" && typeof sourceVersionId === "string" && typeof processingGenerationId === "string") {
        legalInputs.set(`${corpusReleaseId}:${processingGenerationId}`, {
          runId: input.runId,
          corpusReleaseId,
          sourceVersionId,
          processingGenerationId,
          sourceHash: typeof item.metadata.processingSourceHash === "string"
            ? item.metadata.processingSourceHash
            : item.excerptHash,
        });
      }
    }
    if (legalInputs.size) await tx.insert(aiProcessingRunLegalInputs).values([...legalInputs.values()]);
    const contextRows = await tx.insert(aiProcessingRunContext).values(input.context.map((item, index) => ({
      runId: input.runId,
      channel: item.channel,
      citationId: item.citationId,
      queryUnitId: item.queryUnitId,
      queryHash: String(item.metadata.queryHash ?? "unknown"),
      retrievalRank: item.rank,
      retrievalScore: String(item.score),
      legalChunkId: item.channel === "legal" ? item.sourceId : undefined,
      documentChunkId: item.channel === "organization_document" ? item.sourceId : undefined,
      assessmentAnswerId: item.channel === "questionnaire_assertion" ? item.sourceId : undefined,
      excerptHash: item.excerptHash,
      excerptSnapshot: item.excerpt,
      disclosedExternally: input.disclosedExternally,
      promptPosition: index,
    }))).returning({ id: aiProcessingRunContext.id, citationId: aiProcessingRunContext.citationId });
    const contextId = new Map(contextRows.map((row) => [row.citationId, row.id]));
    for (const claim of input.claims) {
      const [row] = await tx.insert(aiProcessingRunClaims).values({
        runId: input.runId,
        queryUnitId: claim.queryUnitId,
        claimKey: claim.key,
        claimTextHash: claim.claimTextHash,
        validation: claim.validation,
        safeFailureReason: claim.safeFailureReason,
      }).returning({ id: aiProcessingRunClaims.id });
      const links = claim.citationIds.flatMap((citationId) => {
        const id = contextId.get(citationId);
        return id ? [{ claimId: row.id, contextId: id }] : [];
      });
      if (links.length) await tx.insert(aiProcessingRunClaimContext).values(links);
    }
  });
}
