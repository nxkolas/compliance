import { beforeEach, describe, expect, it, vi } from "vitest";
import * as z from "zod";

const state = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  requested: [] as Array<Record<string, unknown>>,
}));

// The relay module reaches the table through the service, which is mocked
// below; this only stops importing the real service from opening a connection.
vi.mock("@/src/db", () => ({ db: {} }));

vi.mock("@/src/server/ai/client-inference/service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/src/server/ai/client-inference/service")
  >();
  return {
    ...actual,
    // Stands in for the table: returns whatever row the test staged for this
    // exact input hash, and records what was asked for.
    requestClientInference: vi.fn(async (input: Record<string, unknown>) => {
      const inputHash = actual.inferenceInputHash({
        kind: input.kind as "generation" | "embedding",
        modelId: input.modelId as string,
        payload: input.payload as never,
      });
      state.requested.push({ ...input, inputHash });
      const staged = state.rows.find((row) => row.inputHash === inputHash);
      return staged ?? { id: "req-1", status: "pending", inputHash };
    }),
  };
});

import { createClientRelayGroundedProvider } from "@/src/server/ai/grounding/providers/client-relay";
import { createClientRelayEmbeddingProvider } from "@/src/server/ai/client-inference/embedding-relay";
import { inferenceInputHash } from "@/src/server/ai/client-inference/service";
import { isClientInferenceSuspended } from "@/src/server/ai/client-inference/types";
import { withEmbeddingKey } from "@/src/server/documents/document-config";

const schema = z.object({ answer: z.string() });

function generationProvider() {
  return createClientRelayGroundedProvider({
    organizationId: "org-1",
    jobId: "job-1",
    model: "gemma3:27b",
  });
}

const run = { system: "sys", prompt: "ask", schema };

describe("browser-relayed generation", () => {
  beforeEach(() => {
    state.rows = [];
    state.requested = [];
  });

  /**
   * The suspension is the mechanism that lets a deployed function wait on a
   * model it cannot reach. It must be recognisable as a hand-off rather than a
   * failure, because the job runner parks on it and refunds the attempt.
   */
  it("suspends rather than failing when no client has answered yet", async () => {
    await expect(generationProvider().run(run)).rejects.toSatisfy(
      isClientInferenceSuspended,
    );
  });

  it("returns the stored answer when a client has already responded", async () => {
    const hash = hashFor();
    state.rows = [
      { id: "req-1", status: "succeeded", inputHash: hash, response: { answer: "done" } },
    ];

    const result = await generationProvider().run(run);

    expect(result.output).toEqual({ answer: "done" });
  });

  /**
   * A parked job re-executes from the beginning every time it wakes, so the
   * same call must be recognised as one already answered. Without this, a gap
   * analysis would re-ask the client for every category it had already
   * completed and never finish.
   */
  it("recognises an identical call by input hash across re-executions", async () => {
    await expect(generationProvider().run(run)).rejects.toSatisfy(
      isClientInferenceSuspended,
    );
    await expect(generationProvider().run(run)).rejects.toSatisfy(
      isClientInferenceSuspended,
    );

    const [first, second] = state.requested;
    expect(first!.inputHash).toBe(second!.inputHash);
  });

  it("treats a different prompt as a different call", async () => {
    await generationProvider().run(run).catch(() => undefined);
    await generationProvider()
      .run({ ...run, prompt: "a different question" })
      .catch(() => undefined);

    const [first, second] = state.requested;
    expect(first!.inputHash).not.toBe(second!.inputHash);
  });

  /**
   * A local model reports its token counts through the client, which makes them
   * claims rather than measurements. They must not reach the fields that carry
   * metered provider usage, or cost reporting silently mixes the two.
   */
  it("reports no measured usage for a client-executed call", async () => {
    state.rows = [
      { id: "req-1", status: "succeeded", inputHash: hashFor(), response: { answer: "x" } },
    ];

    const result = await generationProvider().run(run);

    expect(result.usage).toEqual({});
  });

  it("fails terminally when the client reported it could not run", async () => {
    state.rows = [
      {
        id: "req-1",
        status: "failed",
        inputHash: hashFor(),
        failureCode: "LOCAL_MODEL_UNREACHABLE",
        failureMessage: "no model",
      },
    ];

    await expect(generationProvider().run(run)).rejects.toMatchObject({
      name: "GenerationFailure",
      failureClass: "terminal_input",
    });
  });

  function hashFor() {
    // Rebuilt from what the provider actually sent, so the test cannot drift
    // from the payload shape it is meant to be matching.
    return state.requested[0]?.inputHash as string | undefined ?? runHash();
  }

  function runHash() {
    return inferenceInputHash({
      kind: "generation",
      modelId: "gemma3:27b",
      payload: {
        kind: "generation",
        system: "sys",
        prompt: "ask",
        jsonSchema: z.toJSONSchema(schema, { io: "output" }),
        maxOutputTokens: 9000,
      },
    });
  }
});

describe("browser-relayed embeddings", () => {
  const config = withEmbeddingKey({
    provider: "self_hosted",
    model: "embeddinggemma",
    modelRevision: "embeddinggemma",
    dimensions: 3,
    retrievalInstructionId: "none",
    chunkingVersion: "paragraph-v1",
  });

  function embedder() {
    return createClientRelayEmbeddingProvider({
      organizationId: "org-1",
      jobId: "job-1",
      config,
    });
  }

  beforeEach(() => {
    state.rows = [];
    state.requested = [];
  });

  it("embeds nothing without asking a client", async () => {
    expect(await embedder().embed([])).toEqual([]);
    expect(state.requested).toHaveLength(0);
  });

  it("suspends until a client answers", async () => {
    await expect(embedder().embed(["one"])).rejects.toSatisfy(
      isClientInferenceSuspended,
    );
  });

  /**
   * These vectors go straight into pgvector. A client is untrusted input, so a
   * wrong shape has to be rejected before it can be stored rather than
   * discovered later as unusable rows.
   */
  it("rejects a response whose vectors are the wrong width", async () => {
    stage(["one"], [[1, 0]]);
    await expect(embedder().embed(["one"])).rejects.toThrow(
      "not 3 finite numbers",
    );
  });

  it("rejects a response with the wrong number of vectors", async () => {
    stage(["one", "two"], [[1, 0, 0]]);
    await expect(embedder().embed(["one", "two"])).rejects.toThrow(
      "wrong number of embeddings",
    );
  });

  it("rejects non-finite values", async () => {
    stage(["one"], [[1, 0, Number.NaN]]);
    await expect(embedder().embed(["one"])).rejects.toThrow(
      "not 3 finite numbers",
    );
  });

  it("returns a well-formed response", async () => {
    stage(["one"], [[1, 0, 0]]);
    expect(await embedder().embed(["one"])).toEqual([[1, 0, 0]]);
  });

  function stage(values: string[], response: unknown) {
    const hash = inferenceInputHash({
      kind: "embedding",
      modelId: config.model,
      payload: { kind: "embedding", values, purpose: "document", dimensions: 3 },
    });
    state.rows = [{ id: "req-1", status: "succeeded", inputHash: hash, response }];
  }
});
