import { describe, expect, it } from "vitest";
import { selectGapWorkflowRevisions } from "@/src/server/gap-analysis/workflow-state";

describe("selectGapWorkflowRevisions", () => {
  it("keeps the accepted revision authoritative while a newer candidate is current", () => {
    const result = selectGapWorkflowRevisions({
      accepted: { id: "approved-a", status: "approved" },
      current: { id: "candidate-b", status: "generated" },
    });
    expect(result.accepted?.id).toBe("approved-a");
    expect(result.candidate?.id).toBe("candidate-b");
  });

  it("does not duplicate the accepted revision as a candidate", () => {
    const accepted = { id: "approved-a" };
    expect(
      selectGapWorkflowRevisions({ accepted, current: accepted }),
    ).toEqual({ accepted, candidate: null });
  });
});
