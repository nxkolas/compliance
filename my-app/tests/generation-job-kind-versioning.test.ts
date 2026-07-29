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
    expect(gapGenerationJobKind("9")).toBe("gap-generation-v9");
    expect(gapGenerationJobKind("10")).toBe("gap-generation-v10");
    expect(gapGenerationJobKind("11")).toBe("gap-generation-v11");
    expect(gapGenerationJobKind("12")).toBe("gap-generation-v12");
    expect(actionPlanGenerationJobKind("1")).toBe("action-plan-generation");
    expect(actionPlanGenerationJobKind("2")).toBe("action-plan-generation-v2");
    expect(actionPlanGenerationJobKind("3")).toBe("action-plan-generation-v3");
    expect(actionPlanGenerationJobKind("4")).toBe("action-plan-generation-v4");
    expect(actionPlanGenerationJobKind("5")).toBe("action-plan-generation-v5");
    expect(actionPlanGenerationJobKind("6")).toBe("action-plan-generation-v6");
    expect(isGapGenerationJobKind("gap-generation-v8")).toBe(true);
    expect(isGapGenerationJobKind("gap-generation-v9")).toBe(true);
    expect(isGapGenerationJobKind("gap-generation-v10")).toBe(true);
    expect(isGapGenerationJobKind("gap-generation-v11")).toBe(true);
    expect(isGapGenerationJobKind("gap-generation-v12")).toBe(true);
    expect(isActionPlanGenerationJobKind("action-plan-generation-v2")).toBe(
      true,
    );
    expect(isActionPlanGenerationJobKind("action-plan-generation-v3")).toBe(
      true,
    );
    expect(isActionPlanGenerationJobKind("action-plan-generation-v4")).toBe(
      true,
    );
    expect(isActionPlanGenerationJobKind("action-plan-generation-v5")).toBe(
      true,
    );
    expect(isActionPlanGenerationJobKind("action-plan-generation-v6")).toBe(
      true,
    );
  });
});
