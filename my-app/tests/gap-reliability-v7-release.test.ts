import { describe, expect, it } from "vitest";
import { compileGapAnalysisRelease } from "@/src/server/gap-analysis/publishing/compile-release";
import { getRepositoryGapRelease } from "@/src/server/gap-analysis/publishing/release-registry";
import {
  ACTION_PLAN_PROMPT_V6_TEMPLATE_HASH,
  ACTION_PLAN_PROMPT_V6_VERSION,
} from "@/src/server/action-plans/prompt-contract-v6";

describe("reliability-v7 immutable successor release", () => {
  it("keeps Action v5 inactive and pins Gap v11 with Action Plan v6", () => {
    const v6 = getRepositoryGapRelease("nis2-gap/reliability-v6");
    const v7 = getRepositoryGapRelease("nis2-gap/reliability-v7");
    expect(v6.actionPlanPrompt?.version).toBe("5");
    expect(v7.prompt.version).toBe("11");
    expect(v7.actionPlanPrompt).toMatchObject({
      version: ACTION_PLAN_PROMPT_V6_VERSION,
      responseSchemaVersion: "6",
      templateHash: ACTION_PLAN_PROMPT_V6_TEMPLATE_HASH,
    });
    expect(compileGapAnalysisRelease(v7).hashes.aggregate).not.toBe(
      compileGapAnalysisRelease(v6).hashes.aggregate,
    );
  });
});
