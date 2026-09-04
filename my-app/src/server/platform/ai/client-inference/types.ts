import type * as z from "zod";
import type { clientInferenceRequests } from "@/src/db/schema";

export type ClientInferenceRequestRow =
  typeof clientInferenceRequests.$inferSelect;

export type ClientInferenceKind = "generation" | "embedding";

/**
 * What the server hands a client for a generation call. The JSON schema travels
 * with it because a local server enforces it natively through grammar
 * constraints, and a model that only sees it described in the prompt invents
 * keys instead.
 */
export type GenerationRequestPayload = {
  kind: "generation";
  system: string;
  prompt: string;
  jsonSchema: unknown;
  maxOutputTokens: number;
  /** Provider options the local server understands; see `getGenerationOptions`. */
  providerOptions?: Record<string, unknown>;
};

export type EmbeddingRequestPayload = {
  kind: "embedding";
  values: string[];
  purpose: "document" | "query";
  /** The width the server expects back. A mismatch is a configuration error. */
  dimensions: number;
};

export type ClientInferenceRequestPayload =
  | GenerationRequestPayload
  | EmbeddingRequestPayload;

/**
 * Raised by the relay provider instead of returning, when a request has been
 * persisted and there is nothing more the server can do until a client answers.
 *
 * It is not a failure. The job runner parks the job on it and refunds the
 * attempt, because the work has not been tried and failed -- it has been handed
 * off.
 */
export class ClientInferenceSuspended extends Error {
  readonly name = "ClientInferenceSuspended";

  constructor(
    readonly detail: {
      requestId: string;
      organizationId: string;
      kind: ClientInferenceKind;
      /** How long to leave the job parked before waking it to check again. */
      retryAfterSeconds: number;
    },
  ) {
    super("Waiting for a client to run this inference request");
  }
}

export function isClientInferenceSuspended(
  error: unknown,
): error is ClientInferenceSuspended {
  return error instanceof ClientInferenceSuspended;
}

export type GenerationRelayResult = {
  output: unknown;
  reportedModelId: string | null;
  /**
   * Attested rather than measured. A local model reports these through the
   * client, so they must never be written where metered provider usage is read
   * back as cost.
   */
  attestedUsage: {
    inputTokens?: number;
    outputTokens?: number;
  } | null;
};

export type SchemaCarrier = { schema: z.ZodType };
