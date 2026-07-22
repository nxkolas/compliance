import { describe, expect, it } from "vitest";
import { defaultOrganizationAiProviderPolicy, selectGroundedProvider } from "@/src/server/ai/grounding/provider-policy";
import { validateGroundedClaims } from "@/src/server/ai/grounding/validation";
import type { GroundedProvider, GroundingContextItem } from "@/src/server/ai/grounding/types";

const provider = (mode: string): GroundedProvider => ({
  mode,
  provider: mode,
  model: "test",
  async run() { return { output: {}, usage: {} }; },
});

describe("Grounding Gateway safety", () => {
  it("provisions new organizations without enabling external disclosure", () => {
    expect(defaultOrganizationAiProviderPolicy).toEqual({
      allowedProviderModes: ["company_hosted", "self_hosted"],
      externalDisclosureAllowed: false,
      retentionClassification: "internal_no_external_disclosure",
    });
    expect(defaultOrganizationAiProviderPolicy.allowedProviderModes).not.toContain("openai");
  });

  it("fails closed when external disclosure is forbidden", () => {
    expect(() => selectGroundedProvider({
      allowedModes: ["openai"],
      externalDisclosureAllowed: false,
      providers: { openai: provider("openai") },
    })).toThrowError(expect.objectContaining({ code: "AI_PROVIDER_POLICY_UNSATISFIED" }));
    expect(selectGroundedProvider({
      allowedModes: ["openai", "self_hosted"],
      externalDisclosureAllowed: false,
      providers: { openai: provider("openai"), self_hosted: provider("self_hosted") },
    }).mode).toBe("self_hosted");
  });

  it("keeps legal and organization claims in their evidence channels", () => {
    const context: GroundingContextItem[] = [
      { channel: "legal", citationId: "LEGAL:1", queryUnitId: "r1", sourceId: "1", excerpt: "law", excerptHash: "a", rank: 1, score: 1, authorityTier: "primary_authority", translationStatus: "official", metadata: {} },
      { channel: "organization_document", citationId: "DOC:1", queryUnitId: "r1", sourceId: "2", excerpt: "policy", excerptHash: "b", rank: 1, score: 1, metadata: {} },
    ];
    const claims = validateGroundedClaims({
      queryUnits: [{ id: "r1", query: "requirement" }],
      context,
      claims: [
        { key: "law", queryUnitId: "r1", kind: "legal", binding: true, citationIds: ["LEGAL:1"], text: "required" },
        { key: "implementation", queryUnitId: "r1", kind: "organization", citationIds: ["DOC:1"], text: "implemented" },
        { key: "bad", queryUnitId: "r1", kind: "legal", citationIds: ["DOC:1"], text: "not grounded" },
      ],
    });
    expect(claims.map((claim) => claim.validation)).toEqual(["supported", "supported", "unsupported"]);
  });

  it("rejects secondary-only or unofficial-only binding claims", () => {
    const result = validateGroundedClaims({
      queryUnits: [{ id: "r1", query: "law" }],
      context: [{ channel: "legal", citationId: "LEGAL:2", queryUnitId: "r1", sourceId: "2", excerpt: "commentary", excerptHash: "x", rank: 1, score: 1, authorityTier: "curated_secondary", translationStatus: "reviewed_internal", metadata: {} }],
      claims: [{ key: "binding", queryUnitId: "r1", kind: "legal", binding: true, citationIds: ["LEGAL:2"], text: "must" }],
    });
    expect(result[0].validation).toBe("unsupported");
  });

  it("surfaces conflicting authorities instead of silently choosing one", () => {
    const base = { channel: "legal" as const, queryUnitId: "r1", excerptHash: "h", rank: 1, score: 1, authorityTier: "primary_authority" as const, translationStatus: "official" as const };
    const context: GroundingContextItem[] = [
      { ...base, citationId: "LEGAL:r1:a", sourceId: "a", excerpt: "required", metadata: { conflictGroup: "scope", conflictSide: "required" } },
      { ...base, citationId: "LEGAL:r1:b", sourceId: "b", excerpt: "excluded", metadata: { conflictGroup: "scope", conflictSide: "excluded" } },
    ];
    const [claim] = validateGroundedClaims({ queryUnits: [{ id: "r1", query: "scope" }], context, claims: [{ key: "scope", queryUnitId: "r1", kind: "legal", citationIds: ["LEGAL:r1:a"], text: "required" }] });
    expect(claim.validation).toBe("conflicting");
  });
});
