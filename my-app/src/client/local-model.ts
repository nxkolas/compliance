import * as z from "zod";

/**
 * Talks to an OpenAI-compatible model server running on the user's own machine.
 *
 * This is the only part of the application that speaks to the local model, and
 * it necessarily runs in the browser: a deployed function cannot reach
 * `127.0.0.1`. An HTTPS page is allowed to call loopback because browsers treat
 * it as a potentially trustworthy origin, but the model server must still send
 * CORS headers for this origin -- for Ollama that means `OLLAMA_ORIGINS`.
 */

/**
 * Why a connection attempt did not work.
 *
 * `cors_blocked` and `unreachable` are worth telling apart because they need
 * completely different fixes — one is a server setting, the other means nothing
 * is listening — and the browser reports both as the same opaque
 * "Failed to fetch". See `classifyReachability`.
 */
export type LocalModelReachability = "ok" | "cors_blocked" | "unreachable";

export type LocalModelProbe = {
  reachable: boolean;
  reachability: LocalModelReachability;
  models: string[];
  /** Whether the model honoured a JSON schema rather than improvising keys. */
  supportsStructuredOutputs: boolean;
  /** The loaded context window, which is smaller than the advertised maximum. */
  loadedContextTokens: number | null;
  embeddingDimensions: number | null;
  failure?: string;
};

/**
 * Separates "the model server refused this page" from "nothing is listening".
 *
 * A cross-origin fetch that the browser blocks and a fetch to a dead port both
 * reject with the same `TypeError: Failed to fetch`; the CORS reason is
 * deliberately withheld from script. Retrying in `no-cors` mode distinguishes
 * them: that mode skips the CORS check, so the request actually goes out and
 * resolves opaquely if something answered. If it resolves, a server is there
 * and its origin policy is what rejected us. If it rejects too, nothing is
 * listening on that port.
 *
 * `no-cors` forbids non-safelisted headers, so the retry deliberately sends
 * none — an auth header would make it fail for the wrong reason.
 */
async function classifyReachability(
  target: LocalModelTarget,
  signal?: AbortSignal,
): Promise<LocalModelReachability> {
  try {
    const response = await fetch(endpoint(target, "/models"), {
      headers: headers(target),
      signal,
    });
    return response.ok ? "ok" : "ok";
  } catch {
    try {
      await fetch(endpoint(target, "/models"), { mode: "no-cors", signal });
      return "cors_blocked";
    } catch {
      return "unreachable";
    }
  }
}

const modelListSchema = z.object({
  data: z.array(z.object({ id: z.string() })).default([]),
});

const chatCompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullish(),
        message: z.object({ content: z.string().nullish() }).partial(),
      }),
    )
    .default([]),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
    })
    .partial()
    .optional(),
});

const embeddingsSchema = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()) })).default([]),
});

const psSchema = z.object({
  models: z
    .array(z.object({ name: z.string(), context_length: z.number().nullish() }))
    .default([]),
});

export type LocalModelTarget = {
  /** Base URL of the OpenAI-compatible API, for example http://127.0.0.1:11434/v1 */
  baseUrl: string;
  apiKey?: string;
};

function endpoint(target: LocalModelTarget, path: string) {
  return `${target.baseUrl.replace(/\/$/, "")}${path}`;
}

function headers(target: LocalModelTarget) {
  return {
    "content-type": "application/json",
    ...(target.apiKey ? { authorization: `Bearer ${target.apiKey}` } : {}),
  };
}

export async function listLocalModels(
  target: LocalModelTarget,
  signal?: AbortSignal,
) {
  const response = await fetch(endpoint(target, "/models"), {
    headers: headers(target),
    signal,
  });
  if (!response.ok) throw new Error(`Model list failed: ${response.status}`);
  return modelListSchema.parse(await response.json()).data.map((m) => m.id);
}

/**
 * Asks the model for one object against a trivial schema.
 *
 * This is the check that matters most when choosing a model. Without native
 * schema enforcement the request still returns HTTP 200 -- the model simply
 * invents key names -- and the failure only appears much later as a rejected
 * generation with nothing failed in the model server's log to point at. A model
 * that cannot pass this must not be selectable.
 */
export async function probeStructuredOutputs(
  target: LocalModelTarget,
  model: string,
  signal?: AbortSignal,
) {
  const response = await fetch(endpoint(target, "/chat/completions"), {
    method: "POST",
    headers: headers(target),
    signal,
    body: JSON.stringify({
      model,
      max_tokens: 200,
      reasoning_effort: "none",
      messages: [
        {
          role: "user",
          content: "Return the ok field as true.",
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "probe",
          strict: true,
          schema: {
            type: "object",
            properties: { ok: { type: "boolean" } },
            required: ["ok"],
            additionalProperties: false,
          },
        },
      },
    }),
  });
  if (!response.ok) return false;
  const parsed = chatCompletionSchema.parse(await response.json());
  const content = parsed.choices[0]?.message?.content;
  if (!content) return false;
  try {
    const value = JSON.parse(content);
    // The key must be the one the schema named. A model improvising its own
    // key produces valid JSON that Zod would later reject, which is exactly
    // the failure this probe exists to catch.
    return typeof value === "object" && value !== null && "ok" in value;
  } catch {
    return false;
  }
}

export async function probeEmbeddingDimensions(
  target: LocalModelTarget,
  model: string,
  signal?: AbortSignal,
) {
  const response = await fetch(endpoint(target, "/embeddings"), {
    method: "POST",
    headers: headers(target),
    signal,
    body: JSON.stringify({ model, input: ["dimension probe"] }),
  });
  if (!response.ok) return null;
  const parsed = embeddingsSchema.parse(await response.json());
  return parsed.data[0]?.embedding.length ?? null;
}

/**
 * Reads the context window of the loaded slot.
 *
 * Ollama's `/api/show` reports the model's theoretical maximum, which is far
 * larger than what is actually loaded and misleading to configure against.
 * `/api/ps` reports the slot. Absent on non-Ollama servers, hence the null.
 */
export async function probeLoadedContext(
  target: LocalModelTarget,
  model: string,
  signal?: AbortSignal,
) {
  const root = target.baseUrl.replace(/\/v1\/?$/, "");
  try {
    const response = await fetch(`${root}/api/ps`, { signal });
    if (!response.ok) return null;
    const parsed = psSchema.parse(await response.json());
    const match = parsed.models.find((entry) => entry.name === model);
    return match?.context_length ?? null;
  } catch {
    return null;
  }
}

/** Runs the whole connect check and reports what the models can actually do. */
export async function probeLocalModel(input: {
  target: LocalModelTarget;
  generationModel: string;
  embeddingModel: string;
  signal?: AbortSignal;
}): Promise<LocalModelProbe> {
  const reachability = await classifyReachability(input.target, input.signal);
  if (reachability !== "ok") {
    return {
      reachable: false,
      reachability,
      models: [],
      supportsStructuredOutputs: false,
      embeddingDimensions: null,
      loadedContextTokens: null,
    };
  }

  try {
    const models = await listLocalModels(input.target, input.signal);
    const [supportsStructuredOutputs, embeddingDimensions, loadedContextTokens] =
      await Promise.all([
        probeStructuredOutputs(input.target, input.generationModel, input.signal),
        probeEmbeddingDimensions(input.target, input.embeddingModel, input.signal),
        probeLoadedContext(input.target, input.generationModel, input.signal),
      ]);
    return {
      reachable: true,
      reachability: "ok",
      models,
      supportsStructuredOutputs,
      embeddingDimensions,
      loadedContextTokens,
    };
  } catch (error) {
    // The server answered the reachability check, so this is a failure of one
    // of the model calls rather than of the connection itself.
    return {
      reachable: false,
      reachability: "ok",
      models: [],
      supportsStructuredOutputs: false,
      embeddingDimensions: null,
      loadedContextTokens: null,
      failure:
        error instanceof Error
          ? error.message
          : "Could not reach the local model server",
    };
  }
}

/** Runs one generation the server prepared, against the local model. */
export async function runLocalGeneration(input: {
  target: LocalModelTarget;
  model: string;
  system: string;
  prompt: string;
  jsonSchema: unknown;
  maxOutputTokens: number;
  providerOptions?: Record<string, unknown>;
  signal?: AbortSignal;
}) {
  const relayed = (input.providerOptions?.["self-hosted"] ?? {}) as Record<
    string,
    unknown
  >;
  const response = await fetch(endpoint(input.target, "/chat/completions"), {
    method: "POST",
    headers: headers(input.target),
    signal: input.signal,
    body: JSON.stringify({
      model: input.model,
      max_tokens: input.maxOutputTokens,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "grounded_output", strict: true, schema: input.jsonSchema },
      },
      // Passed through as the server assembled them. Each server ignores the
      // switch it does not recognise.
      ...(relayed.reasoningEffort
        ? { reasoning_effort: relayed.reasoningEffort }
        : {}),
      ...(relayed.extra_body ? (relayed.extra_body as object) : {}),
    }),
  });
  if (!response.ok) {
    throw new Error(`Local generation failed: ${response.status}`);
  }
  const parsed = chatCompletionSchema.parse(await response.json());
  const content = parsed.choices[0]?.message?.content;
  if (!content) {
    // The distinctive symptom of a thinking model with reasoning left on: the
    // whole output budget went to reasoning tokens and no content came back.
    throw new Error(
      parsed.choices[0]?.finish_reason === "length"
        ? "The local model returned no content and stopped at the token limit, which usually means reasoning is still enabled"
        : "The local model returned no content",
    );
  }
  return {
    output: JSON.parse(content) as unknown,
    attestedUsage: {
      inputTokens: parsed.usage?.prompt_tokens,
      outputTokens: parsed.usage?.completion_tokens,
    },
  };
}

/** Runs one embedding batch the server prepared. */
export async function runLocalEmbedding(input: {
  target: LocalModelTarget;
  model: string;
  values: string[];
  signal?: AbortSignal;
}) {
  const response = await fetch(endpoint(input.target, "/embeddings"), {
    method: "POST",
    headers: headers(input.target),
    signal: input.signal,
    body: JSON.stringify({ model: input.model, input: input.values }),
  });
  if (!response.ok) {
    throw new Error(`Local embedding failed: ${response.status}`);
  }
  return embeddingsSchema
    .parse(await response.json())
    .data.map((entry) => entry.embedding);
}
