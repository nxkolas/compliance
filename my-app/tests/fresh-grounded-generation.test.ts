import { beforeEach, describe, expect, it, vi } from "vitest";

const providerFailure = new Error("provider boundary reached");

const mocks = vi.hoisted(() => ({
  cycle: {
    id: "00000000-0000-4000-8000-000000000001",
    organizationId: "00000000-0000-4000-8000-000000000002",
    definitionHash: "current",
    buildHash: "build",
    locale: "en",
    stage: "generating",
    assessmentRevisionId: "00000000-0000-4000-8000-000000000003",
    generationJobId: "00000000-0000-4000-8000-000000000004",
    outputRevisionId: null,
  },
  findCycle: vi.fn(),
  findPlan: vi.fn(),
  findOrganization: vi.fn(),
  findRun: vi.fn(),
  findRevision: vi.fn(),
  selectResults: [] as unknown[][],
  providerRun: vi.fn(),
}));

function queryBuilder(result: unknown[]) {
  const builder = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    leftJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    for: vi.fn(),
    then: (
      resolve: (value: unknown[]) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  for (const method of ["from", "innerJoin", "leftJoin", "where", "orderBy", "limit", "for"] as const) {
    builder[method].mockReturnValue(builder);
  }
  return builder;
}

function mutationBuilder(result: unknown[] = []) {
  const builder = queryBuilder(result);
  return Object.assign(builder, {
    values: vi.fn(() => builder),
    set: vi.fn(() => builder),
    returning: vi.fn(() => Promise.resolve(result)),
    onConflictDoNothing: vi.fn(() => builder),
  });
}

vi.mock("@/src/db", () => ({
  db: {
    query: {
      gapAnalysisCycles: { findFirst: mocks.findCycle },
      actionPlans: { findFirst: mocks.findPlan },
      organizations: { findFirst: mocks.findOrganization },
      aiProcessingRuns: { findFirst: mocks.findRun },
      aiProcessingRunContext: { findMany: vi.fn().mockResolvedValue([]) },
      analysisOutputRevisions: { findFirst: mocks.findRevision },
    },
    select: vi.fn(() => queryBuilder(mocks.selectResults.shift() ?? [])),
    insert: vi.fn(() => mutationBuilder([{ id: "00000000-0000-4000-8000-000000000010" }])),
    update: vi.fn(() => mutationBuilder()),
  },
}));

vi.mock("@/src/server/ai/grounding/providers/ai-sdk", () => ({
  createAiSdkGroundedProvider: vi.fn(() => ({
    mode: "openai",
    provider: "openai",
    model: "grounded-test-model",
    run: mocks.providerRun,
  })),
}));

vi.mock("@/src/server/ai/generation/job-run-lifecycle", () => ({
  assertLiveParentJobForAiRun: vi.fn().mockResolvedValue(undefined),
  createAiProcessingRunWithLiveJobGate: vi.fn(async (values) => ({
    id: "00000000-0000-4000-8000-000000000010",
    ...values,
  })),
}));

vi.mock("@/src/server/ai/grounding/legal-retrieval", () => ({
  resolvePinnedLegalScope: vi.fn().mockResolvedValue([
    {
      familyId: "00000000-0000-4000-8000-000000000011",
      familyCode: "nis2-eu-primary",
      snapshotId: "00000000-0000-4000-8000-000000000012",
      snapshotHash: "snapshot-hash",
    },
  ]),
  retrievePinnedLegalContext: vi.fn(async (input: { queryUnitId: string }) => [
    {
      channel: "legal",
      citationId: `LEGAL:${input.queryUnitId}:chunk`,
      queryUnitId: input.queryUnitId,
      sourceId: "00000000-0000-4000-8000-000000000013",
      excerpt: "Authoritative legal requirement.",
      excerptHash: "legal-hash",
      rank: 1,
      score: 1,
      authorityTier: "primary_authority",
      translationStatus: "official",
      metadata: { selectionRole: "mapped_primary" },
    },
  ]),
}));

vi.mock("@/src/server/documents", () => ({
  createDocumentEmbeddingProvider: vi.fn(() => ({
    provider: "test",
    model: "test-embedding",
    dimensions: 2,
    embed: vi.fn(async (values: string[]) => values.map(() => [0.1, 0.2])),
  })),
  validateEmbeddings: vi.fn(),
  retrieveDocumentEvidence: vi.fn().mockResolvedValue([]),
}));

import { currentGapDefinitionHash, getCurrentGapDefinition } from "@/src/server/definitions";
import { executeGapGenerationJob } from "@/src/server/gap-analysis/analysis-cycle-service";
import { executeActionPlanGenerationJob } from "@/src/server/action-plans/generation-service";

describe("fresh grounded generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cycle.definitionHash = currentGapDefinitionHash;
    mocks.findCycle.mockResolvedValue(mocks.cycle);
    mocks.findPlan.mockResolvedValue(null);
    mocks.findRun.mockResolvedValue(null);
    mocks.findRevision.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000008",
      organizationId: mocks.cycle.organizationId,
      assessmentRevisionId: mocks.cycle.assessmentRevisionId,
      definitionHash: currentGapDefinitionHash,
      locale: "en",
    });
    mocks.findOrganization.mockResolvedValue({
      id: mocks.cycle.organizationId,
      aiProviderMode: "openai",
      archivedAt: null,
    });
    mocks.providerRun.mockRejectedValue(providerFailure);
    mocks.selectResults = [];
  });

  it("fresh Gap generation reaches the configured AI provider", async () => {
    const definition = getCurrentGapDefinition("en");
    mocks.selectResults.push(
      definition.questions.map((question, position) => ({
        id: `00000000-0000-4000-8000-${String(position + 20).padStart(12, "0")}`,
        questionKey: question.stableKey,
        questionText: question.questionText,
        answerValue: "not_implemented",
        selectedOptionLabels: ["Not implemented"],
        position,
      })),
      [],
    );

    await expect(
      executeGapGenerationJob({
        jobId: mocks.cycle.generationJobId,
        cycleId: mocks.cycle.id,
        userId: "00000000-0000-4000-8000-000000000006",
        organizationId: mocks.cycle.organizationId,
        workerId: "worker-1",
        attemptCount: 1,
        locale: "en",
      }),
    ).rejects.toThrow();
    expect(mocks.providerRun).toHaveBeenCalled();
  });

  it("fresh Action Plan generation reaches the configured AI provider", async () => {
    const definition = getCurrentGapDefinition("en");
    const requirement = definition.requirements[0]!;
    const question = definition.questions.find((item) =>
      requirement.questionStableKeys.includes(item.stableKey),
    )!;
    mocks.selectResults.push(
      [
        {
          id: "00000000-0000-4000-8000-000000000007",
          organizationId: mocks.cycle.organizationId,
          outputRevisionId: "00000000-0000-4000-8000-000000000008",
          requirementKey: requirement.stableRequirementId,
          requirementTitle: requirement.title,
          requirementText: requirement.requirementText,
          icon: "shield",
          criticality: "high",
          status: "not_fulfilled",
          summary: "Governance controls are absent.",
          guidance: "Establish governance controls.",
          position: 0,
        },
      ],
      [
        {
          id: "00000000-0000-4000-8000-000000000009",
          findingId: "00000000-0000-4000-8000-000000000007",
          stableKey: `${question.stableKey}.1`,
          kind: "missing",
          statement: "A security policy is not implemented.",
          recommendation: "Define and approve a security policy.",
          position: 0,
        },
      ],
      [],
      [
        {
          id: "00000000-0000-4000-8000-000000000014",
          organizationId: mocks.cycle.organizationId,
          assessmentRevisionId: mocks.cycle.assessmentRevisionId,
          questionKey: question.stableKey,
          questionText: question.questionText,
          answerValue: "not_implemented",
          selectedOptionLabels: ["Not implemented"],
          position: 0,
        },
      ],
    );

    await expect(
      executeActionPlanGenerationJob({
        jobId: mocks.cycle.generationJobId,
        workerId: "worker-1",
        organizationId: mocks.cycle.organizationId,
        userId: "00000000-0000-4000-8000-000000000006",
        sourceGapRevisionId: "00000000-0000-4000-8000-000000000008",
        attemptCount: 1,
        locale: "en",
      }),
    ).rejects.toThrow();
    expect(mocks.providerRun).toHaveBeenCalled();
  });
});
