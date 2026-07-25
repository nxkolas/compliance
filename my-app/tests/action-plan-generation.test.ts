import { describe, expect, it, vi } from "vitest";
import { buildActionPlanItems } from "@/src/server/action-plans/service";
import { actionPlanGenerationRequestSchema } from "@/src/contracts/action-plans";

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
      { id: "f1", status: "fulfilled", severity: "low", requirementTitle: "A", recommendation: "A done" },
      { id: "f2", status: "partially_fulfilled", severity: "medium", requirementTitle: "B", recommendation: "Finish B" },
      { id: "f3", status: "not_fulfilled", severity: "critical", requirementTitle: "C", recommendation: "Build C" },
      { id: "f4", status: "insufficient_evidence", severity: "high", requirementTitle: "D", recommendation: "Evidence D" },
    ]);
    expect(items.map((item) => item.sourceFindingId)).toEqual(["f2", "f3", "f4"]);
    expect(items[1]).toMatchObject({ title: "C", priority: "critical", status: "open" });
  });
});
