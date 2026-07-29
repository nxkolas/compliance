import { describe, expect, it } from "vitest";
import {
  ACTION_PLAN_PROMPT_V6_VERSION,
  actionPlanPromptV6,
} from "@/src/server/action-plans/prompt-contract-v6";

describe("Action Plan contract v6 verification-result prompt", () => {
  it("keeps server-owned conditional wording out of both model fields", () => {
    const prompt = actionPlanPromptV6("en");
    expect(prompt).toContain(
      "verificationResult contains only the completed verification work and its documented outcome",
    );
    expect(prompt).toContain(
      "Do not put if, when, unless, conditional, or equivalent wording in verificationResult",
    );
    expect(prompt).toContain(
      "conditionalRemediation contains only the remediation work, without a condition or conditional lead-in",
    );
    expect(prompt).toContain(
      "The server adds the localized condition exactly once",
    );
  });

  it("budgets verification fields for the rendered result bound", () => {
    const prompt = actionPlanPromptV6("en");
    expect(prompt).toContain("verificationResult at most 18 words");
    expect(prompt).toContain("conditionalRemediation at most 16 words");
  });

  it("has a distinct immutable version", () => {
    expect(ACTION_PLAN_PROMPT_V6_VERSION).toBe("6");
  });
});
