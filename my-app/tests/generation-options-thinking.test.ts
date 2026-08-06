import { describe, expect, it } from "vitest";

import { getGenerationOptions } from "@/lib/ai/generation-options";

/**
 * Ollama serves the self-hosted path and only honours `reasoning_effort`. When
 * it is missing, a thinking model spends the whole output budget on reasoning
 * tokens and returns empty content, which reaches the coordinator as an
 * unretryable `GENERATION_TERMINAL` instead of a schema error.
 */
describe("self-hosted thinking controls", () => {
  it("disables reasoning in the form Ollama accepts", () => {
    const options = getGenerationOptions("self_hosted", { thinking: false });

    expect(options.providerOptions?.["self-hosted"]).toMatchObject({
      reasoningEffort: "none",
    });
  });

  it("defaults to disabled when no preference is given", () => {
    const options = getGenerationOptions("self_hosted");

    expect(options.providerOptions?.["self-hosted"]).toMatchObject({
      reasoningEffort: "none",
    });
  });

  it("re-enables reasoning when thinking is requested", () => {
    const options = getGenerationOptions("self_hosted", { thinking: true });

    expect(options.providerOptions?.["self-hosted"]).toMatchObject({
      reasoningEffort: "medium",
    });
  });

  it("still sends the vLLM form for non-Ollama self-hosted deployments", () => {
    const options = getGenerationOptions("self_hosted", { thinking: false });

    expect(options.providerOptions?.["self-hosted"]).toMatchObject({
      extra_body: { chat_template_kwargs: { enable_thinking: false } },
    });
  });

  it("sends no provider options for openai", () => {
    expect(getGenerationOptions("openai").providerOptions).toBeUndefined();
  });
});
