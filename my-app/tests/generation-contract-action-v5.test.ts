import { describe, expect, it } from "vitest";
import {
  ACTION_PLAN_PROMPT_V5_VERSION,
  actionPlanPromptV5,
} from "@/src/server/action-plans/prompt-contract-v5";

describe("Action Plan contract v5 offline-quality prompt", () => {
  it("requires concise operational prose without legal exposition", () => {
    const prompt = actionPlanPromptV5("en");
    expect(prompt).toContain("at most 12 words");
    expect(prompt).toContain("one or two sentences");
    expect(prompt).toContain("at most 40 words");
    expect(prompt).toContain(
      "Do not name or discuss laws, directives, statutes, articles, sections, obligations, regulators, or citations",
    );
    expect(prompt).toContain("writing constraints");
  });

  it("has a distinct immutable version", () => {
    expect(ACTION_PLAN_PROMPT_V5_VERSION).toBe("5");
  });
});
