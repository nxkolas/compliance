import { describe, expect, it } from "vitest";
import {
  GAP_PROMPT_V11_VERSION,
  gapPromptV11,
} from "@/src/server/gap-analysis/prompt-contract-v11";

describe("Gap contract v11 offline-quality prompt", () => {
  it("makes concision and absence of legal exposition explicit writing goals", () => {
    const prompt = gapPromptV11({
      locale: "en",
      semanticContexts: [],
    });
    expect(prompt).toContain("at most 20 words");
    expect(prompt).toContain(
      "Do not name laws, directives, articles, sections, obligations, or citations",
    );
    expect(prompt).toContain("writing constraints");
  });

  it("has a distinct immutable version", () => {
    expect(GAP_PROMPT_V11_VERSION).toBe("11");
  });
});
