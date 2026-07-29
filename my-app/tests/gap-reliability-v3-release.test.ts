import { describe, expect, it } from "vitest";
import { compileGapAnalysisRelease } from "@/src/server/gap-analysis/publishing/compile-release";
import { getRepositoryGapRelease } from "@/src/server/gap-analysis/publishing/release-registry";
import {
  GAP_PROMPT_V10_TEMPLATE_HASH,
  GAP_PROMPT_V10_VERSION,
} from "@/src/server/gap-analysis/prompt-contract-v10";

describe("reliability-v3 immutable successor release", () => {
  it("keeps failed v9 inactive and pins targeted Gap v10 with Action Plan v3", () => {
    const v2 = getRepositoryGapRelease("nis2-gap/reliability-v2");
    const v3 = getRepositoryGapRelease("nis2-gap/reliability-v3");
    expect(v2.prompt.version).toBe("9");
    expect(v3.prompt).toMatchObject({
      version: GAP_PROMPT_V10_VERSION,
      responseSchemaVersion: "10",
      templateHash: GAP_PROMPT_V10_TEMPLATE_HASH,
    });
    expect(v3.actionPlanPrompt?.version).toBe("3");
    expect(compileGapAnalysisRelease(v3).hashes.aggregate).not.toBe(
      compileGapAnalysisRelease(v2).hashes.aggregate,
    );
  });
});
