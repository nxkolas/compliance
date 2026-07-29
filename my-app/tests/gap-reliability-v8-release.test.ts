import { describe, expect, it } from "vitest";
import { compileGapAnalysisRelease } from "@/src/server/gap-analysis/publishing/compile-release";
import { getRepositoryGapRelease } from "@/src/server/gap-analysis/publishing/release-registry";
import {
  GAP_PROMPT_V12_TEMPLATE_HASH,
  GAP_PROMPT_V12_VERSION,
} from "@/src/server/gap-analysis/prompt-contract-v12";

describe("reliability-v8 immutable successor release", () => {
  it("keeps reliability-v7 immutable and pins Gap v12 with Action Plan v6", () => {
    const v7 = getRepositoryGapRelease("nis2-gap/reliability-v7");
    const v8 = getRepositoryGapRelease("nis2-gap/reliability-v8");

    expect(v7.prompt.version).toBe("11");
    expect(v8.prompt).toMatchObject({
      version: GAP_PROMPT_V12_VERSION,
      responseSchemaVersion: "12",
      templateHash: GAP_PROMPT_V12_TEMPLATE_HASH,
    });
    expect(v8.actionPlanPrompt?.version).toBe("6");
    expect(compileGapAnalysisRelease(v8).hashes.aggregate).not.toBe(
      compileGapAnalysisRelease(v7).hashes.aggregate,
    );
  });
});
