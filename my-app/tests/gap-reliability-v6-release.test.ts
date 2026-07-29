import { describe, expect, it } from "vitest";
import { compileGapAnalysisRelease } from "@/src/server/gap-analysis/publishing/compile-release";
import { getRepositoryGapRelease } from "@/src/server/gap-analysis/publishing/release-registry";
import {
  ACTION_PLAN_PROMPT_V5_TEMPLATE_HASH,
  ACTION_PLAN_PROMPT_V5_VERSION,
} from "@/src/server/action-plans/prompt-contract-v5";

describe("reliability-v6 immutable successor release", () => {
  it("keeps Action v4 inactive and pins Gap v11 with Action Plan v5", () => {
    const v5 = getRepositoryGapRelease("nis2-gap/reliability-v5");
    const v6 = getRepositoryGapRelease("nis2-gap/reliability-v6");
    expect(v5.actionPlanPrompt?.version).toBe("4");
    expect(v6.prompt.version).toBe("11");
    expect(v6.actionPlanPrompt).toMatchObject({
      version: ACTION_PLAN_PROMPT_V5_VERSION,
      responseSchemaVersion: "5",
      templateHash: ACTION_PLAN_PROMPT_V5_TEMPLATE_HASH,
    });
    expect(compileGapAnalysisRelease(v6).hashes.aggregate).not.toBe(
      compileGapAnalysisRelease(v5).hashes.aggregate,
    );
  });
});
