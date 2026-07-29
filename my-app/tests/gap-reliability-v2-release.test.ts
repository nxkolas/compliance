import { describe, expect, it } from "vitest";
import { compileGapAnalysisRelease } from "@/src/server/gap-analysis/publishing/compile-release";
import { getRepositoryGapRelease } from "@/src/server/gap-analysis/publishing/release-registry";
import {
  GAP_PROMPT_V9_TEMPLATE_HASH,
  GAP_PROMPT_V9_VERSION,
} from "@/src/server/gap-analysis/prompt-contract-v9";
import {
  ACTION_PLAN_PROMPT_V3_TEMPLATE_HASH,
  ACTION_PLAN_PROMPT_V3_VERSION,
} from "@/src/server/action-plans/prompt-contract-v3";

describe("reliability-v2 immutable release", () => {
  it("is publishable and pinned to v9/v3 without mutating reliability-v1", () => {
    const previous = getRepositoryGapRelease("nis2-gap/reliability-v1");
    const release = getRepositoryGapRelease("nis2-gap/reliability-v2");
    const previousCompiled = compileGapAnalysisRelease(previous);
    const compiled = compileGapAnalysisRelease(release);

    expect(release.prompt).toEqual({
      name: "nis2_atomic_gap_analysis",
      version: GAP_PROMPT_V9_VERSION,
      responseSchemaVersion: "9",
      templateHash: GAP_PROMPT_V9_TEMPLATE_HASH,
    });
    expect(release.actionPlanPrompt).toEqual({
      name: "nis2_action_plan",
      version: ACTION_PLAN_PROMPT_V3_VERSION,
      responseSchemaVersion: "3",
      templateHash: ACTION_PLAN_PROMPT_V3_TEMPLATE_HASH,
    });
    expect(compiled.hashes.aggregate).not.toBe(
      previousCompiled.hashes.aggregate,
    );
    expect(previous.prompt.version).toBe("8");
    expect(previous.actionPlanPrompt?.version).toBe("2");
  });
});
