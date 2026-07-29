import { describe, expect, it } from "vitest";
import { compileGapAnalysisRelease } from "@/src/server/gap-analysis/publishing/compile-release";
import { getRepositoryGapRelease } from "@/src/server/gap-analysis/publishing/release-registry";
import {
  GAP_PROMPT_V11_TEMPLATE_HASH,
  GAP_PROMPT_V11_VERSION,
} from "@/src/server/gap-analysis/prompt-contract-v11";

describe("reliability-v5 immutable successor release", () => {
  it("keeps failed v10 inactive and pins Gap v11 with Action Plan v4", () => {
    const v4 = getRepositoryGapRelease("nis2-gap/reliability-v4");
    const v5 = getRepositoryGapRelease("nis2-gap/reliability-v5");
    expect(v4.prompt.version).toBe("10");
    expect(v5.prompt).toMatchObject({
      version: GAP_PROMPT_V11_VERSION,
      responseSchemaVersion: "11",
      templateHash: GAP_PROMPT_V11_TEMPLATE_HASH,
    });
    expect(v5.actionPlanPrompt?.version).toBe("4");
    expect(compileGapAnalysisRelease(v5).hashes.aggregate).not.toBe(
      compileGapAnalysisRelease(v4).hashes.aggregate,
    );
  });
});
