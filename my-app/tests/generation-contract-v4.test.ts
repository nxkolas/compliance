import { describe, expect, it } from "vitest";
import {
  ACTION_PLAN_PROMPT_V4_VERSION,
  actionPlanPromptV4,
  actionPlanRepairPromptV4,
} from "@/src/server/action-plans/prompt-contract-v4";

describe("Action Plan contract v4 objective safety repair", () => {
  it("prevents raw identifiers in the initial response", () => {
    const prompt = actionPlanPromptV4("en");
    expect(prompt).toContain("Do not put URLs or opaque internal identifiers");
    expect(prompt).toContain("UUID");
  });

  it("explains the objective raw-identifier issue without style gates", () => {
    const prompt = actionPlanRepairPromptV4({
      locale: "en",
      categoryCode: "NIS2-SC-06",
      issues: [
        {
          code: "action_raw_identifier",
          path: ["actions", 0, "result"],
        },
      ],
    });
    expect(prompt).toContain(
      "action_raw_identifier means remove every URL, UUID, or opaque internal identifier",
    );
    expect(prompt).not.toContain("action_title_style means");
    expect(prompt).not.toContain("action_word_count means");
  });

  it("has a distinct immutable version", () => {
    expect(ACTION_PLAN_PROMPT_V4_VERSION).toBe("4");
  });
});
