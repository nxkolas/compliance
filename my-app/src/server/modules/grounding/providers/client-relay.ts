import * as z from "zod";
import type { GroundedProvider } from "../types";
import { GenerationFailure } from "../../../platform/ai/generation";
import {
  requestClientInference,
  CLIENT_LEASE_SECONDS,
} from "../../../platform/ai/client-inference/service";
import {
  ClientInferenceSuspended,
  type GenerationRequestPayload,
} from "../../../platform/ai/client-inference/types";
import { groundedMaxOutputTokens } from "./ai-sdk";

/**
 * A `GroundedProvider` that hands its work to the organization's browser
 * instead of calling a model itself.
 *
 * It satisfies the same contract as the direct provider, so the gateway needs
 * no special case for the happy path: prompt assembly, claim validation,
 * citation checking and persistence all run exactly as they do for OpenAI. Only
 * the moment of inference differs.
 *
 * `run` has two outcomes rather than one. If a client has already answered this
 * exact call, it returns that answer. If not, it registers the request and
 * throws `ClientInferenceSuspended`, which parks the job rather than failing it.
 * The job re-executes when a client responds, reaches this same call, and finds
 * the answer waiting.
 */
export function createClientRelayGroundedProvider(input: {
  organizationId: string;
  jobId: string | null;
  model: string;
  providerOptions?: Record<string, unknown>;
}): GroundedProvider {
  return {
    mode: "self_hosted",
    provider: "self_hosted_client_relay",
    model: input.model,
    async run(request: {
      system: string;
      prompt: string;
      schema: z.ZodType;
      abortSignal?: AbortSignal;
    }) {
      request.abortSignal?.throwIfAborted();

      const payload: GenerationRequestPayload = {
        kind: "generation",
        system: request.system,
        prompt: request.prompt,
        // Serialised here so the client sends the server's schema verbatim. A
        // local server enforces `response_format: json_schema` natively; a
        // model only *told* about a schema in the prompt returns valid JSON
        // with keys it invented, which Zod then rejects with nothing failed on
        // the model side to point at.
        jsonSchema: z.toJSONSchema(request.schema, { io: "output" }),
        maxOutputTokens: groundedMaxOutputTokens(),
        ...(input.providerOptions
          ? { providerOptions: input.providerOptions }
          : {}),
      };

      const row = await requestClientInference({
        organizationId: input.organizationId,
        kind: "generation",
        jobId: input.jobId,
        runId: null,
        modelId: input.model,
        payload,
      });

      if (row.status === "succeeded") {
        return {
          output: row.response,
          // Deliberately empty. A local model reports token counts through the
          // client, which makes them attestations rather than measurements;
          // writing them into the same fields as metered provider usage would
          // corrupt cost reporting. The attested values stay on the request row.
          usage: {},
        };
      }

      if (row.status === "failed" || row.status === "expired") {
        // Terminal rather than transient: the client already tried and could
        // not, or nobody came. Retrying the same request would park the job
        // again behind the same absent or broken model.
        throw new GenerationFailure(
          "terminal_input",
          row.failureCode ?? "CLIENT_INFERENCE_FAILED",
        );
      }

      throw new ClientInferenceSuspended({
        requestId: row.id,
        organizationId: input.organizationId,
        kind: "generation",
        // Long enough that a parked job is not spun on while a slow local model
        // works, short enough that a finished request is picked up promptly if
        // the resume request's own drain missed it.
        retryAfterSeconds: CLIENT_LEASE_SECONDS,
      });
    },
  };
}
