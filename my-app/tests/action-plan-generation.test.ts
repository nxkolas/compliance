import { describe, expect, it, vi } from "vitest";
import { buildActionPlanItems } from "@/src/server/action-plans/service";
import {
  actionPlanGenerationRequestSchema,
  actionPlanItemUpdateSchema,
} from "@/src/contracts/action-plans";

vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
});

describe("deterministic action-plan generation", () => {
  it("accepts the current Gap revision without prior approval", () => {
    expect(
      actionPlanGenerationRequestSchema.parse({
        gapRevisionId: "00000000-0000-4000-8000-000000000001",
      }),
    ).toEqual({
      gapRevisionId: "00000000-0000-4000-8000-000000000001",
    });
    expect(() =>
      actionPlanGenerationRequestSchema.parse({
        approvedGapRevisionId:
          "00000000-0000-4000-8000-000000000001",
      }),
    ).toThrow();
  });

  it("creates one item for every finding that is not fulfilled", () => {
    const items = buildActionPlanItems([
      finding("f1", "fulfilled", "low", "A", "A done"),
      finding("f2", "partially_fulfilled", "medium", "B", "Finish B"),
      finding("f3", "not_fulfilled", "critical", "C", "Build C"),
      finding("f4", "insufficient_evidence", "high", "D", "Evidence D"),
    ]);
    expect(items.map((item) => item.sourceFindingId)).toEqual(["f2", "f3", "f4"]);
    expect(items[1]).toMatchObject({
      title: "C",
      measureType: "control_remediation",
      sourceRecommendation: "Build C",
      objective: "Complete C",
      priority: "critical",
      status: "open",
      executionNotes: "",
    });
  });

  it("fails finalization input when actionable guidance is incomplete", () => {
    expect(() =>
      buildActionPlanItems([
        {
          ...finding(
            "f1",
            "not_fulfilled",
            "high",
            "A",
            "Build A",
          ),
          deliverables: [],
        },
      ]),
    ).toThrow(/lacks validated actionable guidance/);
  });

  it("accepts execution notes but rejects generated-guidance patches", () => {
    expect(
      actionPlanItemUpdateSchema.parse({
        executionNotes: "Rollout started in the test tenant.",
      }),
    ).toEqual({
      executionNotes: "Rollout started in the test tenant.",
    });
    expect(() =>
      actionPlanItemUpdateSchema.parse({
        objective: "Replace the immutable objective",
      }),
    ).toThrow();
  });
});

function finding(
  id: string,
  status:
    | "fulfilled"
    | "partially_fulfilled"
    | "not_fulfilled"
    | "insufficient_evidence",
  severity: "low" | "medium" | "high" | "critical",
  requirementTitle: string,
  recommendation: string,
) {
  const actionable = status !== "fulfilled";
  const workKind: "verify" | "remediate" =
    status === "insufficient_evidence" ? "verify" : "remediate";
  return {
    id,
    status,
    severity,
    requirementTitle,
    recommendation,
    guidanceMode: actionable
      ? status === "insufficient_evidence"
        ? ("evidence_verification" as const)
        : ("control_remediation" as const)
      : ("maintain_and_document" as const),
    objective: actionable ? `Complete ${requirementTitle}` : null,
    deliverables: actionable
      ? [
          {
            questionStableKey: `question.${id}`,
            workKind,
            text: `Deliver ${requirementTitle}`,
          },
        ]
      : [],
    acceptanceCriteria: actionable
      ? [
          {
            questionStableKey: `question.${id}`,
            workKind,
            text: `Accept ${requirementTitle}`,
          },
        ]
      : [],
    suggestedEvidence: actionable
      ? [
          {
            questionStableKey: `question.${id}`,
            text: `Evidence ${requirementTitle}`,
          },
        ]
      : [],
  };
}
