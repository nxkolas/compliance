import { describe, expect, it } from "vitest";
import { compileGapAnalysisRelease } from "@/src/server/gap-analysis/publishing/compile-release";
import { getRepositoryGapRelease } from "@/src/server/gap-analysis/publishing/release-registry";
import {
  GAP_PROMPT_V8_TEMPLATE_HASH,
  GAP_PROMPT_V8_VERSION,
} from "@/src/server/gap-analysis/prompt-contract-v8";
import {
  ACTION_PLAN_PROMPT_V2_TEMPLATE_HASH,
  ACTION_PLAN_PROMPT_V2_VERSION,
} from "@/src/server/action-plans/prompt-contract-v2";

describe("reliability-v1 immutable release", () => {
  it("is publishable, pinned to v8/v2, and not an activation instruction", () => {
    const release = getRepositoryGapRelease(
      "nis2-gap/reliability-v1",
    );
    const compiled = compileGapAnalysisRelease(release);
    expect(release.prompt).toMatchObject({
      version: GAP_PROMPT_V8_VERSION,
      responseSchemaVersion: "8",
      templateHash: GAP_PROMPT_V8_TEMPLATE_HASH,
    });
    expect(release.actionPlanPrompt).toMatchObject({
      version: ACTION_PLAN_PROMPT_V2_VERSION,
      responseSchemaVersion: "2",
      templateHash: ACTION_PLAN_PROMPT_V2_TEMPLATE_HASH,
    });
    expect(compiled.hashes.aggregate).toHaveLength(64);
  });
});
