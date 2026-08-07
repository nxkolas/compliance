import type { DocumentEmbeddingProvider } from "@/src/server/documents/embeddings";
import type { EmbeddingConfig } from "@/src/server/documents/document-config";
import { requestClientInference, CLIENT_LEASE_SECONDS } from "./service";
import {
  ClientInferenceSuspended,
  type EmbeddingRequestPayload,
} from "./types";

/**
 * A `DocumentEmbeddingProvider` that has the organization's browser run the
 * embedding model instead of calling it from the server.
 *
 * Same suspend-and-resume shape as the generation relay: an already-answered
 * batch is returned by input hash, an unanswered one registers a request and
 * parks the job. Because the input hash covers the exact values, a re-executing
 * job re-embeds nothing it has already embedded.
 *
 * Document ingestion and re-indexing both go through here, which is what makes
 * a re-index a foreground operation for these organizations: it needs a browser
 * attached for the whole run.
 */
export function createClientRelayEmbeddingProvider(input: {
  organizationId: string;
  jobId: string | null;
  config: EmbeddingConfig;
}): DocumentEmbeddingProvider {
  const { config } = input;
  return {
    provider: config.provider,
    model: config.model,
    modelRevision: config.modelRevision,
    dimensions: config.dimensions,
    retrievalInstructionId: config.retrievalInstructionId,
    chunkingVersion: config.chunkingVersion,
    key: config.key,
    async embed(values, purpose = "document") {
      if (values.length === 0) return [];

      const payload: EmbeddingRequestPayload = {
        kind: "embedding",
        values,
        purpose,
        dimensions: config.dimensions,
      };

      const row = await requestClientInference({
        organizationId: input.organizationId,
        kind: "embedding",
        jobId: input.jobId,
        runId: null,
        modelId: config.model,
        payload,
      });

      if (row.status === "succeeded") {
        return assertEmbeddingResponse(row.response, values.length, config.dimensions);
      }

      if (row.status === "failed" || row.status === "expired") {
        throw new Error(
          row.failureMessage ??
            "The local embedding model could not complete this request.",
        );
      }

      throw new ClientInferenceSuspended({
        requestId: row.id,
        organizationId: input.organizationId,
        kind: "embedding",
        retryAfterSeconds: CLIENT_LEASE_SECONDS,
      });
    },
  };
}

/**
 * Client output is untrusted, and a wrong shape here would be written straight
 * into pgvector. Checked before it can become a stored vector rather than after.
 */
function assertEmbeddingResponse(
  response: unknown,
  expectedCount: number,
  dimensions: number,
): number[][] {
  if (!Array.isArray(response) || response.length !== expectedCount) {
    throw new Error(
      "Client returned the wrong number of embeddings for this request",
    );
  }
  return response.map((vector) => {
    if (
      !Array.isArray(vector) ||
      vector.length !== dimensions ||
      vector.some((value) => typeof value !== "number" || !Number.isFinite(value))
    ) {
      throw new Error(
        `Client returned an embedding that is not ${dimensions} finite numbers`,
      );
    }
    return vector as number[];
  });
}
