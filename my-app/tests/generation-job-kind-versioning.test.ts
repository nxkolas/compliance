import { describe, expect, it } from "vitest";
import {
  actionPlanGenerationJobKind,
  gapGenerationJobKind,
  isActionPlanGenerationJobKind,
  isGapGenerationJobKind,
} from "@/src/server/jobs/generation-kinds";

describe("generation job kind versioning", () => {
  it("keeps new contracts away from workers that loaded legacy-only code", () => {
    expect(gapGenerationJobKind("7")).toBe("gap-generation");
    expect(gapGenerationJobKind("8")).toBe("gap-generation-v8");
    expect(actionPlanGenerationJobKind("1")).toBe(
      "action-plan-generation",
    );
    expect(actionPlanGenerationJobKind("2")).toBe(
      "action-plan-generation-v2",
    );
    expect(isGapGenerationJobKind("gap-generation-v8")).toBe(true);
    expect(
      isActionPlanGenerationJobKind("action-plan-generation-v2"),
    ).toBe(true);
  });
});
