import { describe, expect, it, vi } from "vitest";
import { actionPlanDefinitionHash } from "@/src/server/modules/action-plans/current-contract";
import { currentGapDefinitionHash } from "@/src/server/modules/gap-analysis";
import {
  JOB_KINDS,
  getJobDefinition,
  jobDefinitions,
} from "@/src/server/bootstrap/job-definitions";

vi.mock("@/src/db", () => ({ db: {} }));

const id = "00000000-0000-4000-8000-000000000001";

const inventory = [
  {
    kind: "gap_analysis",
    payload: {
      cycleId: id,
      locale: "en",
      definitionHash: currentGapDefinitionHash,
      buildHash: "build",
      idempotencyKey: "request",
    },
    scope: true,
    read: "gap:read",
    cancel: "gap:contribute",
    cancellable: true,
    result: "analysis_output_revision",
  },
  {
    kind: "gap_conflict_resolution",
    payload: {
      sourceRevisionId: id,
      findingId: id,
      sourceChoice: "document",
      definitionHash: currentGapDefinitionHash,
      buildHash: "build",
    },
    scope: true,
    read: "gap:read",
    cancel: "gap:contribute",
    cancellable: true,
    result: "analysis_output_revision",
  },
  {
    kind: "action_plan_generation",
    payload: {
      sourceGapRevisionId: id,
      locale: "en",
      gapDefinitionHash: currentGapDefinitionHash,
      actionPlanDefinitionHash,
      buildHash: "build",
    },
    scope: true,
    read: "plans:read",
    cancel: "plans:manage",
    cancellable: true,
    result: "action_plan",
  },
  {
    kind: "report_render",
    payload: { reportId: id },
    scope: true,
    read: "reports:read",
    cancel: "reports:create",
    cancellable: true,
    result: "report",
  },
  {
    kind: "document_indexing",
    payload: { documentVersionId: id },
    scope: true,
    read: "documents:read",
    cancel: "documents:write",
    cancellable: true,
    result: "document_version",
  },
  {
    kind: "legal_source_processing",
    payload: { processingGenerationId: id },
    scope: false,
    read: null,
    cancel: null,
    cancellable: false,
    result: "legal_source_processing_generation",
  },
  {
    kind: "maintenance_cleanup",
    payload: { version: 1 },
    scope: false,
    read: null,
    cancel: null,
    cancellable: false,
    result: "maintenance_cleanup",
  },
] as const;

describe("background-job module", () => {
  it("defines payload, scope, policy, and result behavior for every persisted kind", () => {
    expect(Object.keys(jobDefinitions).sort()).toEqual([...JOB_KINDS].sort());

    for (const expected of inventory) {
      const definition = getJobDefinition(expected.kind);
      expect(
        definition.payloadSchema.safeParse(expected.payload).success,
        expected.kind,
      ).toBe(true);
      expect(definition.payloadSchema.safeParse({}).success).toBe(false);
      expect(definition.organizationScoped).toBe(expected.scope);
      expect(definition.requesterRequired).toBe(expected.scope);
      expect(definition.maxAttempts).toBe(3);
      expect(definition.readCapability).toBe(expected.read);
      expect(definition.cancellationCapability).toBe(expected.cancel);
      expect(definition.cancellable).toBe(expected.cancellable);
      expect(
        definition.resultSchema.safeParse({ type: expected.result, id }).success,
      ).toBe(true);
      expect(
        definition.resultSchema.safeParse({ type: "wrong", id }).success,
      ).toBe(false);
    }
  });

  it("applies generation failure policy to contradiction resolution", () => {
    const failure = getJobDefinition("gap_conflict_resolution").classifyFailure({
      code: "ETIMEDOUT",
    });
    expect(failure).toMatchObject({
      cancellation: false,
      code: "GENERATION_PROVIDER_TRANSIENT",
      retryable: true,
    });
  });
});
