import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db";
import {
  legalCorpusFamilies,
  legalProvisionChunkBindings,
  legalSourceChunkEmbeddings,
  legalSourceChunks,
  legalSourceProcessingGenerations,
  legalSources,
  legalSourceVersions,
} from "@/src/db/schema";
import { currentGapContractDefinition } from "@/src/server/gap-analysis/current-contract";

const provisionPrefixesByFamily: Record<string, string[]> = {
  "nis2-eu-primary": ["eu_nis2."],
  "nis2-de-primary": ["de_bsig."],
};

export async function validateLegalCorpusActivationCandidate(input: {
  familyCode: string;
  processingGenerationIds: string[];
}) {
  const generationIds = [...new Set(input.processingGenerationIds)];
  if (!generationIds.length || generationIds.length !== input.processingGenerationIds.length) {
    throw new Error("Processing generation IDs must be unique and non-empty");
  }
  const generations = await db.select({
    id: legalSourceProcessingGenerations.id,
    status: legalSourceProcessingGenerations.status,
    embeddingModel: legalSourceProcessingGenerations.embeddingModel,
    familyCode: legalCorpusFamilies.code,
  }).from(legalSourceProcessingGenerations)
    .innerJoin(legalSourceVersions, eq(legalSourceVersions.id, legalSourceProcessingGenerations.sourceVersionId))
    .innerJoin(legalSources, and(
      eq(legalSources.id, legalSourceVersions.sourceId),
      eq(legalSources.familyId, legalSourceVersions.familyId),
    ))
    .innerJoin(legalCorpusFamilies, eq(legalCorpusFamilies.id, legalSources.familyId))
    .where(inArray(legalSourceProcessingGenerations.id, generationIds));
  if (generations.length !== generationIds.length) {
    throw new Error("A processing generation does not exist or has invalid lineage");
  }
  if (generations.some((row) => row.familyCode !== input.familyCode)) {
    throw new Error("Every processing generation must belong to the selected family");
  }
  if (generations.some((row) => row.status !== "succeeded")) {
    throw new Error("Every processing generation must have succeeded");
  }

  const chunks = await db.select({
    id: legalSourceChunks.id,
    processingGenerationId: legalSourceChunks.processingGenerationId,
    text: legalSourceChunks.text,
  }).from(legalSourceChunks)
    .where(inArray(legalSourceChunks.processingGenerationId, generationIds));
  const generationById = new Map(generations.map((row) => [row.id, row]));
  for (const id of generationIds) {
    if (!chunks.some((chunk) => chunk.processingGenerationId === id)) {
      throw new Error(`Processing generation ${id} has no chunks`);
    }
  }
  if (chunks.some((chunk) => !chunk.text.trim())) {
    throw new Error("A selected legal citation chunk is empty");
  }

  const chunkIds = chunks.map((chunk) => chunk.id);
  const embeddings = await db.select({
    chunkId: legalSourceChunkEmbeddings.chunkId,
    model: legalSourceChunkEmbeddings.model,
  }).from(legalSourceChunkEmbeddings)
    .where(inArray(legalSourceChunkEmbeddings.chunkId, chunkIds));
  const embedded = new Set(embeddings.map((row) => `${row.chunkId}\0${row.model}`));
  const missingEmbedding = chunks.find((chunk) => {
    const model = generationById.get(chunk.processingGenerationId)?.embeddingModel;
    return !model || !embedded.has(`${chunk.id}\0${model}`);
  });
  if (missingEmbedding) {
    throw new Error(`Legal chunk ${missingEmbedding.id} has no matching embedding`);
  }

  const bindings = await db.select({
    stableProvisionKey: legalProvisionChunkBindings.stableProvisionKey,
    chunkId: legalProvisionChunkBindings.chunkId,
  }).from(legalProvisionChunkBindings)
    .where(inArray(legalProvisionChunkBindings.chunkId, chunkIds));
  const sourcePrefixes = provisionPrefixesByFamily[input.familyCode] ?? [];
  const expectedKeys = new Set(
    currentGapContractDefinition.questionnaire.questions
      .flatMap((question) => question.legalProvisionKeys ?? [])
      .filter((key) => sourcePrefixes.some((prefix) => key.startsWith(prefix))),
  );
  if (!expectedKeys.size) {
    throw new Error("The selected corpus has no provisions used by the current Gap contract");
  }
  const resolvedKeys = new Set(bindings.map((row) => row.stableProvisionKey));
  const missingBindings = [...expectedKeys].filter((key) => !resolvedKeys.has(key));
  if (missingBindings.length) {
    throw new Error(`Current Gap provisions are unbound: ${missingBindings.join(", ")}`);
  }
  return {
    familyCode: input.familyCode,
    processingGenerationIds: generationIds,
    chunkCount: chunks.length,
    bindingCount: expectedKeys.size,
  };
}
