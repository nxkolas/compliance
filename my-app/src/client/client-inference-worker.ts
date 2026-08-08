import * as z from "zod";
import { ApiClientError, request } from "./api-client";
import {
  runLocalEmbedding,
  runLocalGeneration,
  type LocalModelTarget,
} from "./local-model";

/**
 * Drives one organization's local model on behalf of the server.
 *
 * The server cannot reach a model on a user's machine, so this loop is the
 * transport: claim a request the server prepared, run it locally, post the
 * result back. Posting the result answers 202, which starts an after-response
 * job drain, and that drain is what resumes the parked job -- so the loop is
 * also what makes the work advance.
 *
 * Deliberately serial. Ollama serialises requests by default, so running two at
 * once only lengthens both while doubling the chance of a lease expiring.
 */

const claimSchema = z.object({
  request: z
    .object({
      id: z.string(),
      kind: z.enum(["generation", "embedding"]),
      modelId: z.string(),
      payload: z.unknown(),
      leaseExpiresAt: z.string().nullable(),
      attemptCount: z.number(),
    })
    .nullable(),
});

const acceptedSchema = z.object({ accepted: z.boolean() });
const heartbeatSchema = z.object({ leaseExpiresAt: z.string().nullable() });

const generationPayloadSchema = z.object({
  kind: z.literal("generation"),
  system: z.string(),
  prompt: z.string(),
  jsonSchema: z.unknown(),
  maxOutputTokens: z.number(),
  providerOptions: z.record(z.string(), z.unknown()).optional(),
});

const embeddingPayloadSchema = z.object({
  kind: z.literal("embedding"),
  values: z.array(z.string()),
  purpose: z.enum(["document", "query"]),
  dimensions: z.number(),
});

/** Keeps the claim alive while a slow local model works. */
const HEARTBEAT_INTERVAL_MS = 30_000;

export type WorkerStatus =
  | { state: "idle" }
  | { state: "working"; kind: "generation" | "embedding" }
  | { state: "error"; message: string };

export async function runClientInferenceWorker(input: {
  organizationId: string;
  target: LocalModelTarget;
  signal: AbortSignal;
  onStatus?: (status: WorkerStatus) => void;
  /** Removes a relay whose remembered organization is no longer accessible. */
  onOrganizationUnavailable?: () => void;
  /** Pause between polls when there was nothing to do. */
  idleDelayMs?: number;
}) {
  const idleDelayMs = input.idleDelayMs ?? 3_000;

  while (!input.signal.aborted) {
    let claimed: z.infer<typeof claimSchema>["request"] = null;
    try {
      const result = await request(
        `/api/organizations/${input.organizationId}/client-inference/claim`,
        { method: "POST", outputSchema: claimSchema, signal: input.signal },
      );
      claimed = result.data.request;
    } catch (error) {
      if (input.signal.aborted) return;
      input.onStatus?.({ state: "error", message: describe(error) });
      if (isOrganizationUnavailable(error)) {
        input.onOrganizationUnavailable?.();
        return;
      }
      await delay(idleDelayMs, input.signal);
      continue;
    }

    if (!claimed) {
      input.onStatus?.({ state: "idle" });
      await delay(idleDelayMs, input.signal);
      continue;
    }

    input.onStatus?.({ state: "working", kind: claimed.kind });
    await handleClaim(input, claimed);
  }
}

function isOrganizationUnavailable(error: unknown) {
  return (
    error instanceof ApiClientError &&
    error.status === 404 &&
    error.code === "ORGANIZATION_NOT_FOUND"
  );
}

async function handleClaim(
  input: {
    organizationId: string;
    target: LocalModelTarget;
    signal: AbortSignal;
    onStatus?: (status: WorkerStatus) => void;
  },
  claimed: NonNullable<z.infer<typeof claimSchema>["request"]>,
) {
  const heartbeat = setInterval(() => {
    void request(
      `/api/organizations/${input.organizationId}/client-inference/${claimed.id}/heartbeat`,
      { method: "POST", outputSchema: heartbeatSchema },
    ).catch(() => {
      // A lost claim is recoverable: another client, or this one on its next
      // pass, will pick the request back up once the lease expires.
    });
  }, HEARTBEAT_INTERVAL_MS);

  try {
    const result =
      claimed.kind === "generation"
        ? await runGeneration(input, claimed)
        : await runEmbedding(input, claimed);

    await request(
      `/api/organizations/${input.organizationId}/client-inference/${claimed.id}/result`,
      {
        method: "POST",
        input: result,
        outputSchema: acceptedSchema,
        signal: input.signal,
      },
    );
  } catch (error) {
    if (input.signal.aborted) return;
    input.onStatus?.({ state: "error", message: describe(error) });
    // Reporting the failure is what stops the parked job waiting for a request
    // that will never be answered. Silence would leave it until expiry.
    await request(
      `/api/organizations/${input.organizationId}/client-inference/${claimed.id}/failure`,
      {
        method: "POST",
        input: {
          failureCode: failureCodeFor(error),
          failureMessage: describe(error).slice(0, 500),
        },
        outputSchema: acceptedSchema,
      },
    ).catch(() => undefined);
  } finally {
    clearInterval(heartbeat);
  }
}

async function runGeneration(
  input: { target: LocalModelTarget; signal: AbortSignal },
  claimed: { modelId: string; payload: unknown },
) {
  const payload = generationPayloadSchema.parse(claimed.payload);
  const { output, attestedUsage } = await runLocalGeneration({
    target: input.target,
    model: claimed.modelId,
    system: payload.system,
    prompt: payload.prompt,
    jsonSchema: payload.jsonSchema,
    maxOutputTokens: payload.maxOutputTokens,
    providerOptions: payload.providerOptions,
    signal: input.signal,
  });
  return { output, reportedModelId: claimed.modelId, attestedUsage };
}

async function runEmbedding(
  input: { target: LocalModelTarget; signal: AbortSignal },
  claimed: { modelId: string; payload: unknown },
) {
  const payload = embeddingPayloadSchema.parse(claimed.payload);
  const vectors = await runLocalEmbedding({
    target: input.target,
    model: claimed.modelId,
    values: payload.values,
    signal: input.signal,
  });
  return { output: vectors, reportedModelId: claimed.modelId };
}

function failureCodeFor(error: unknown) {
  const message = describe(error).toLowerCase();
  if (message.includes("failed to fetch") || message.includes("networkerror")) {
    return "LOCAL_MODEL_UNREACHABLE" as const;
  }
  if (message.includes("timeout") || message.includes("aborted")) {
    return "LOCAL_MODEL_TIMEOUT" as const;
  }
  if (message.includes("no content") || message.includes("json")) {
    return "LOCAL_MODEL_REJECTED_SCHEMA" as const;
  }
  return "LOCAL_MODEL_ERROR" as const;
}

function describe(error: unknown) {
  return error instanceof Error ? error.message : "Unknown client error";
}

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
