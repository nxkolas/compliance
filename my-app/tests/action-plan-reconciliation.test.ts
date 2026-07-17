import { describe, expect, it } from "vitest";
import { reconcileActionPlanItems } from "@/src/server/action-plans/reconciliation";

describe("reconcileActionPlanItems", () => {
  it.each([
    ["open exact gap", previous("open"), finding("v1", "not_fulfilled"), "unchanged_gap", false, "carry_over"],
    ["fulfilled", previous("in_progress"), finding("v1", "fulfilled"), "proposed_closure", true, "close"],
    ["done but still open", previous("done"), finding("v1", "partially_fulfilled"), "effectiveness_not_confirmed", true, "reopen"],
    ["cancelled but still open", previous("cancelled"), finding("v1", "not_fulfilled"), "effectiveness_not_confirmed", true, "create_follow_up"],
    ["changed version", previous("open"), finding("v2", "not_fulfilled"), "requirement_version_changed", true, "carry_over"],
  ] as const)(
    "%s",
    (_name, oldItem, newFinding, changeKind, requiresDecision, proposedDecision) => {
      const [result] = reconcileActionPlanItems({
        previousItems: [oldItem],
        targetFindings: [newFinding],
      });
      expect(result).toMatchObject({ changeKind, requiresDecision, proposedDecision });
    },
  );

  it("creates an automatic open proposal for a new gap and no item for a new fulfilled finding", () => {
    const result = reconcileActionPlanItems({
      previousItems: [],
      targetFindings: [
        { ...finding("v1", "not_fulfilled"), stableRequirementId: "new-gap" },
        { ...finding("v1", "fulfilled"), stableRequirementId: "fulfilled" },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      stableRequirementId: "new-gap",
      changeKind: "new_gap",
      requiresDecision: false,
    });
  });

  it("keeps removed requirements as legacy measures pending a decision", () => {
    const [result] = reconcileActionPlanItems({
      previousItems: [previous("done")],
      targetFindings: [],
    });
    expect(result).toMatchObject({
      changeKind: "requirement_removed",
      proposedDecision: "keep_legacy",
      requiresDecision: true,
    });
  });
});

function previous(status: "open" | "in_progress" | "done" | "cancelled") {
  return {
    itemId: "item-1",
    findingId: "old-finding",
    stableRequirementId: "requirement-1",
    requirementVersionId: "v1",
    status,
  };
}

function finding(
  requirementVersionId: string,
  status: "fulfilled" | "partially_fulfilled" | "not_fulfilled" | "insufficient_evidence",
) {
  return {
    findingId: "new-finding",
    stableRequirementId: "requirement-1",
    requirementVersionId,
    status,
  };
}
