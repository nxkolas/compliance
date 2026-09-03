import { beforeEach, describe, expect, it, vi } from "vitest";
import * as z from "zod";

const mocks = vi.hoisted(() => ({
  runValues: [] as unknown[],
  contextValues: [] as unknown[],
  runUpdates: [] as unknown[],
  providerRun: vi.fn(),
  findRun: vi.fn(),
}));

function mutationBuilder(input: {
  values?: (value: unknown) => void;
  set?: (value: unknown) => void;
  returning?: unknown[];
}) {
  const builder = {
    values: vi.fn((value: unknown) => {
      input.values?.(value);
      return builder;
    }),
    set: vi.fn((value: unknown) => {
      input.set?.(value);
      return builder;
    }),
    where: vi.fn(() => builder),
    returning: vi.fn(async () => input.returning ?? []),
    then: (
      resolve: (value: unknown[]) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(input.returning ?? []).then(resolve, reject),
  };
  return builder;
}

vi.mock("@/src/db", () => ({
  db: {
    query: {
      aiProcessingRuns: { findFirst: mocks.findRun },
      aiProcessingRunContext: { findMany: vi.fn().mockResolvedValue([]) },
    },
    insert: vi.fn(() =>
      mutationBuilder({
        values: (value) => mocks.runValues.push(value),
        returning: [
          {
            id: "00000000-0000-4000-8000-000000000010",
          },
        ],
      }),
    ),
    update: vi.fn(() => mutationBuilder({})),
    transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
      callback({
        insert: vi.fn(() =>
          mutationBuilder({
            values: (value) => mocks.contextValues.push(value),
          }),
        ),
        update: vi.fn(() =>
          mutationBuilder({
            set: (value) => mocks.runUpdates.push(value),
          }),
        ),
      }),
    ),
  },
}));

vi.mock("@/src/server/ai/grounding/legal-retrieval", () => ({
  resolvePinnedLegalScope: vi.fn(),
  retrievePinnedLegalContext: vi.fn().mockResolvedValue([
    {
      channel: "legal",
      citationId: "LEGAL:REQ:1",
      queryUnitId: "REQ",
      sourceId: "00000000-0000-4000-8000-000000000020",
      excerpt: "Operators must implement proportionate security controls.",
      excerptHash: "legal-excerpt-hash",
      rank: 1,
      score: 0.99,
      authorityTier: "primary_authority",
      translationStatus: "official",
      metadata: { selectionRole: "mapped_primary" },
    },
  ]),
}));

vi.mock("@/src/server/ai/grounding/organization-retrieval", () => ({
  retrieveOrganizationContext: vi.fn().mockResolvedValue([
    {
      channel: "organization_document",
      citationId: "DOC:REQ:1",
      queryUnitId: "REQ",
      sourceId: "00000000-0000-4000-8000-000000000021",
      excerpt: "The policy does not define a review owner or review cadence.",
      excerptHash: "document-excerpt-hash",
      rank: 1,
      score: 0.95,
      metadata: { selectionRole: "retrieved" },
    },
  ]),
}));

vi.mock("@/src/server/ai/generation/job-run-lifecycle", () => ({
  assertLiveParentJobForAiRun: vi.fn().mockResolvedValue(undefined),
  createAiProcessingRunWithLiveJobGate: vi.fn(async (values) => {
    mocks.runValues.push(values);
    return {
      id: "00000000-0000-4000-8000-000000000010",
      ...values,
    };
  }),
}));

import { runGroundedOperation } from "@/src/server/ai/grounding/gateway";
import {
  generationCallAttemptIdentity,
  generationReservationIdentity,
  parseDurableExecutionAttempt,
} from "@/src/server/ai/generation/attempt-identity";

describe("grounding gateway provenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runValues = [];
    mocks.contextValues = [];
    mocks.runUpdates = [];
    mocks.findRun.mockResolvedValue(null);
    mocks.providerRun.mockResolvedValue({
      output: {
        statements: [
          "The policy has no assigned review owner.",
          "The policy has no documented review cadence.",
        ],
      },
      usage: { inputTokens: 120, outputTokens: 44, cachedInputTokens: 20 },
    });
  });

  it("records the actual provider, exact admitted excerpts, validated citations, and multiple generated outputs", async () => {
    const outputSchema = z.object({
      statements: z.array(z.string().min(1)).length(2),
    });
    const result = await runGroundedOperation({
      actor: { userId: "00000000-0000-4000-8000-000000000001" },
      organizationId: "00000000-0000-4000-8000-000000000002",
      outputLocale: "en",
      workflowReleaseId: "definition-hash",
      asOfDate: "2026-08-02",
      organizationEvidenceVersionIds: [
        "00000000-0000-4000-8000-000000000003",
      ],
      questionnaireAssertions: [
        {
          answerId: "00000000-0000-4000-8000-000000000004",
          queryUnitId: "REQ",
          excerpt: "Is policy governance implemented? Not implemented",
        },
      ],
      groundingInstruction: "Use only supplied context.",
      queryUnits: [{ id: "REQ", query: "Policy governance" }],
      outputContract: {
        schema: () => outputSchema,
        languagePolicy: "language_neutral",
        claims: (output) =>
          output.statements.map((statement, index) => ({
            key: `REQ:${index + 1}`,
            queryUnitId: "REQ",
            kind: "legal" as const,
            binding: true,
            citationIds: ["LEGAL:REQ:1", "DOC:REQ:1"],
            text: statement,
          })),
      },
      idempotencyKey: "grounded-provenance-test",
      preparedGrounding: {
        policy: {} as never,
        pinnedSnapshots: [
          {
            familyId: "00000000-0000-4000-8000-000000000030",
            familyCode: "nis2-eu-primary",
            snapshotId: "00000000-0000-4000-8000-000000000031",
            snapshotHash: "snapshot-hash",
          },
        ],
        provider: {
          mode: "openai",
          provider: "openai",
          model: "gpt-grounded-test",
          run: mocks.providerRun,
        },
      },
    });

    expect(result.output.statements).toHaveLength(2);
    expect(mocks.providerRun).toHaveBeenCalledOnce();
    expect(mocks.runValues[0]).toMatchObject({
      provider: "openai",
      model: "gpt-grounded-test",
      status: "processing",
      idempotencyKey: "grounded-provenance-test",
    });
    expect(mocks.contextValues[0]).toEqual([
      expect.objectContaining({
        channel: "legal_authority",
        exactText: "Operators must implement proportionate security controls.",
      }),
      expect.objectContaining({
        channel: "organization_evidence",
        exactText:
          "The policy does not define a review owner or review cadence.",
      }),
    ]);
    expect(mocks.runUpdates[0]).toMatchObject({
      attemptCount: 1,
      inputTokens: 120,
      outputTokens: 44,
      cachedInputTokens: 20,
      claimValidation: {
        status: "validated",
        claims: [
          expect.objectContaining({
            key: "REQ:1",
            validation: "supported",
            citationIds: ["LEGAL:REQ:1", "DOC:REQ:1"],
          }),
          expect.objectContaining({
            key: "REQ:2",
            validation: "supported",
            citationIds: ["LEGAL:REQ:1", "DOC:REQ:1"],
          }),
        ],
      },
    });
  });

  it("allocates a fresh provider-call identity after a failed durable execution", async () => {
    const reservationIdentity = generationReservationIdentity({
      taskId: "gap-category-task",
      phase: "initial",
    });
    const firstAttemptIdentity = generationCallAttemptIdentity({
      reservationIdentity,
      durableExecutionAttempt: parseDurableExecutionAttempt(1),
      providerAttempt: 1,
    });
    const secondAttemptIdentity = generationCallAttemptIdentity({
      reservationIdentity,
      durableExecutionAttempt: parseDurableExecutionAttempt(2),
      providerAttempt: 1,
    });
    const providerError = new Error("provider unavailable");
    mocks.providerRun
      .mockRejectedValueOnce(providerError)
      .mockResolvedValueOnce({
        output: { value: "validated" },
        usage: { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0 },
      });
    mocks.findRun.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(
      runDurableGroundedAttempt({
        reservationIdentity,
        attemptIdentity: firstAttemptIdentity,
        durableExecutionAttempt: 1,
      }),
    ).rejects.toBe(providerError);

    const failedRun = {
      ...(mocks.runValues[0] as Record<string, unknown>),
      id: "00000000-0000-4000-8000-000000000010",
      status: "failed",
      validatedOutput: null,
    };
    mocks.findRun
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(failedRun);

    await expect(
      runDurableGroundedAttempt({
        reservationIdentity,
        attemptIdentity: secondAttemptIdentity,
        durableExecutionAttempt: 2,
      }),
    ).resolves.toMatchObject({ output: { value: "validated" } });

    expect(firstAttemptIdentity).not.toBe(secondAttemptIdentity);
    expect(mocks.providerRun).toHaveBeenCalledTimes(2);
    expect(mocks.runValues).toEqual([
      expect.objectContaining({
        generationReservationKey: reservationIdentity,
        idempotencyKey: firstAttemptIdentity,
        durableExecutionAttempt: 1,
      }),
      expect.objectContaining({
        generationReservationKey: reservationIdentity,
        idempotencyKey: secondAttemptIdentity,
        durableExecutionAttempt: 2,
      }),
    ]);
  });

  it("recovers a compatible validated category without another provider call", async () => {
    const reservationIdentity = generationReservationIdentity({
      taskId: "gap-category-task",
      phase: "initial",
    });
    const firstAttemptIdentity = generationCallAttemptIdentity({
      reservationIdentity,
      durableExecutionAttempt: parseDurableExecutionAttempt(1),
      providerAttempt: 1,
    });
    mocks.providerRun.mockResolvedValue({
      output: { value: "validated" },
      usage: { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0 },
    });
    mocks.findRun.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    await runDurableGroundedAttempt({
      reservationIdentity,
      attemptIdentity: firstAttemptIdentity,
      durableExecutionAttempt: 1,
    });

    const persisted = mocks.runValues[0] as Record<string, unknown>;
    const recoverableRun = {
      ...persisted,
      id: "00000000-0000-4000-8000-000000000010",
      status: "processing",
      validatedOutput: { value: "validated" },
    };
    const secondAttemptIdentity = generationCallAttemptIdentity({
      reservationIdentity,
      durableExecutionAttempt: parseDurableExecutionAttempt(2),
      providerAttempt: 1,
    });
    mocks.findRun
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(recoverableRun);

    await expect(
      runDurableGroundedAttempt({
        reservationIdentity,
        attemptIdentity: secondAttemptIdentity,
        durableExecutionAttempt: 2,
      }),
    ).resolves.toMatchObject({
      runId: "00000000-0000-4000-8000-000000000010",
      output: { value: "validated" },
      recovered: true,
    });

    expect(mocks.providerRun).toHaveBeenCalledOnce();
    expect(mocks.runValues).toHaveLength(1);
  });
});

function runDurableGroundedAttempt(input: {
  reservationIdentity: string;
  attemptIdentity: string;
  durableExecutionAttempt: number;
}) {
  const outputSchema = z.object({ value: z.string() });
  return runGroundedOperation({
    runOperationKind: "gap_analysis",
    actor: { userId: "00000000-0000-4000-8000-000000000001" },
    organizationId: "00000000-0000-4000-8000-000000000002",
    outputLocale: "en",
    workflowReleaseId: "definition-hash",
    definitionHash: "definition-hash",
    asOfDate: "2026-08-03",
    organizationEvidenceVersionIds: [],
    groundingInstruction: "Use only supplied context.",
    queryUnits: [{ id: "REQ", query: "Policy governance" }],
    outputContract: {
      schema: () => outputSchema,
      languagePolicy: "language_neutral",
      claims: () => [
        {
          key: "REQ:1",
          queryUnitId: "REQ",
          kind: "legal" as const,
          binding: true,
          citationIds: ["LEGAL:REQ:1"],
          text: "validated",
        },
      ],
    },
    idempotencyKey: input.attemptIdentity,
    generationReservationKey: input.reservationIdentity,
    durableExecutionAttempt: input.durableExecutionAttempt,
    providerAttempt: 1,
    assessmentRevisionId: "00000000-0000-4000-8000-000000000003",
    jobId: "00000000-0000-4000-8000-000000000004",
    expectedLeaseOwner: "worker-1",
    promptMetadata: {
      name: "test-gap-category",
      version: "1",
      templateHash: "template-hash",
      responseSchemaVersion: "1",
    },
    preparedGrounding: {
      policy: {} as never,
      pinnedSnapshots: [
        {
          familyId: "00000000-0000-4000-8000-000000000030",
          familyCode: "nis2-eu-primary",
          snapshotId: "00000000-0000-4000-8000-000000000031",
          snapshotHash: "snapshot-hash",
        },
      ],
      provider: {
        mode: "openai",
        provider: "openai",
        model: "gpt-grounded-test",
        run: mocks.providerRun,
      },
    },
  });
}
