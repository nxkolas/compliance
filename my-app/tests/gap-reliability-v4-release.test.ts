import { describe, expect, it } from "vitest";
import { compileGapAnalysisRelease } from "@/src/server/gap-analysis/publishing/compile-release";
import { getRepositoryGapRelease } from "@/src/server/gap-analysis/publishing/release-registry";
import {
  ACTION_PLAN_PROMPT_V4_TEMPLATE_HASH,
  ACTION_PLAN_PROMPT_V4_VERSION,
} from "@/src/server/action-plans/prompt-contract-v4";

describe("reliability-v4 immutable successor release", () => {
  it("keeps failed v3 inactive and pins Gap v10 with Action Plan v4", () => {
    const v3 = getRepositoryGapRelease("nis2-gap/reliability-v3");
    const v4 = getRepositoryGapRelease("nis2-gap/reliability-v4");
    expect(v3.actionPlanPrompt?.version).toBe("3");
    expect(v4.prompt.version).toBe("10");
    expect(v4.actionPlanPrompt).toMatchObject({
      version: ACTION_PLAN_PROMPT_V4_VERSION,
      responseSchemaVersion: "4",
      templateHash: ACTION_PLAN_PROMPT_V4_TEMPLATE_HASH,
    });
    expect(compileGapAnalysisRelease(v4).hashes.aggregate).not.toBe(
      compileGapAnalysisRelease(v3).hashes.aggregate,
    );
  });
});
