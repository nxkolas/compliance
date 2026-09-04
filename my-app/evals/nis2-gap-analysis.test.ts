import { describe, expect, it } from "vitest";
import { getPromptModeConfig } from "../src/server/modules/grounding/prompts/prompt-modes";

describe("NIS2 gap-analysis mode", () => {
  it("requires curated citations and uses low temperature", () => {
    const config = getPromptModeConfig("nis2_gap_analysis");

    expect(config.requiresCuratedCitation).toBe(true);
    expect(config.citationStrictness).toBe("strict");
    expect(config.temperature).toBeLessThanOrEqual(0.1);
  });
});
