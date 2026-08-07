import { describe, expect, it } from "vitest";
import { renderComplianceSystemPrompt } from "../lib/ai/prompts/compliance-system";
import { getPromptModeConfig } from "../lib/ai/prompts/prompt-modes";
import { getModelCapabilityProfile } from "../lib/ai/model-capabilities";

describe("hallucination guardrails", () => {
  it("instructs the model not to invent legal deadlines or sources", () => {
    const prompt = renderComplianceSystemPrompt({
      organization: {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Example GmbH",
        legalName: null,
        countryCode: "DE",
        aiProviderMode: "openai",
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      retrievedContext: [],
      chatSummary: null,
      modeConfig: getPromptModeConfig("audit_preparation"),
      locale: "en",
      modelCapabilities: getModelCapabilityProfile("self_hosted"),
    });

    expect(prompt).toContain("Never invent source IDs");
    expect(prompt).toContain("not enough sourced information");
    expect(prompt).toContain("Citation reliability profile: low");
  });
});
