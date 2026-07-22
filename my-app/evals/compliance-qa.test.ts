import { describe, expect, it } from "vitest";
import { buildCompliancePrompt } from "../lib/ai/prompts/prompt-builder";
import { getModelCapabilityProfile } from "../lib/ai/model-capabilities";

const organization = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Example GmbH",
  legalName: "Example GmbH",
  country: "DE",
  archivedAt: null,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
} as const;

describe("general compliance prompt", () => {
  it("includes disclaimer, organization context, and no-source behavior", () => {
    const prompt = buildCompliancePrompt({
      mode: "general_compliance_qa",
      organization,
      retrievedChunks: [],
      chatSummary: null,
      locale: "de",
      modelCapabilities: getModelCapabilityProfile("openai"),
    });

    expect(prompt.system).toContain("not legal advice");
    expect(prompt.system).toContain("Example GmbH");
    expect(prompt.system).toContain("not enough sourced information");
  });

  it("keeps tenant data out of the stored prompt template", () => {
    const prompt = buildCompliancePrompt({
      mode: "general_compliance_qa",
      organization,
      retrievedChunks: [],
      chatSummary: null,
      locale: "de",
      modelCapabilities: getModelCapabilityProfile("openai"),
    });

    expect(prompt.promptTemplate).not.toContain("Example GmbH");
    expect(prompt.promptTemplate).toContain("{{organization.name}}");
    expect(prompt.promptTemplateHash).not.toBe(prompt.promptHash);
  });
});
