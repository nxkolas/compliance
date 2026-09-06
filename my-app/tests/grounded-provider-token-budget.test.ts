import * as z from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

const generateObject = vi.hoisted(() => vi.fn());

vi.mock("ai", () => ({ generateObject }));
vi.mock("@/src/server/platform/ai/models", () => ({
  getChatModelId: () => "test-model",
  getComplianceChatModelById: () => "model-handle",
}));

import { createAiSdkGroundedProvider } from "@/src/server/modules/grounding/providers/ai-sdk";

describe("grounded provider token budget", () => {
  beforeEach(() => {
    vi.stubEnv("AI_GROUNDED_MAX_OUTPUT_TOKENS", "");
    generateObject.mockReset();
    generateObject.mockResolvedValue({
      object: { value: "ok" },
      usage: {},
    });
  });

  it("caps the structured-output reservation for a batched grounded call", async () => {
    await createAiSdkGroundedProvider("openai").run({
      system: "system",
      prompt: "prompt",
      schema: z.object({ value: z.string() }),
    });

    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({ maxOutputTokens: 9_000 }),
    );
  });

  it.each([
    ["100", 512],
    ["20000", 12_000],
    ["not-a-number", 9_000],
  ])("clamps configured value %s to %s", async (configured, expected) => {
    vi.stubEnv("AI_GROUNDED_MAX_OUTPUT_TOKENS", configured);

    await createAiSdkGroundedProvider("openai").run({
      system: "system",
      prompt: "prompt",
      schema: z.object({ value: z.string() }),
    });

    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({ maxOutputTokens: expected }),
    );
  });
});
