import { describe, expect, it } from "vitest";
import { buildGroundedPrompt } from "@/src/server/ai/grounding/context-builder";
import { selectGroundedProvider } from "@/src/server/ai/grounding/provider-policy";
import {
  safeGroundingFailureMessage,
  toGroundingFailureDiagnostic,
  validateGroundedClaims,
} from "@/src/server/ai/grounding/validation";
import {
  resolveGroundingRetrievalQuery,
  type GroundedProvider,
  type GroundingContextItem,
} from "@/src/server/ai/grounding/types";

const provider = (mode: string): GroundedProvider => ({
  mode,
  provider: mode,
  model: "test",
  async run() { return { output: {}, usage: {} }; },
});

describe("Grounding Gateway safety", () => {
  it("uses channel-specific retrieval queries", () => {
    const unit = {
      id: "r1",
      query: '{"requirement":{"title":"model input"}}',
      retrievalQuery: "legal terms de_bsig.section_30_1",
      organizationRetrievalQuery: "plain organization-control terms",
    };
    expect(
      resolveGroundingRetrievalQuery(unit, "legal"),
    ).toBe("legal terms de_bsig.section_30_1");
    expect(
      resolveGroundingRetrievalQuery(unit, "organization_document"),
    ).toBe("plain organization-control terms");
    expect(
      resolveGroundingRetrievalQuery({
        id: "r1",
        query: "model input fallback",
      }, "organization_document"),
    ).toBe("model input fallback");
  });

  it("keeps retrieval-only legal identifiers out of the model prompt", () => {
    const prompt = buildGroundedPrompt(
      [{
        id: "r1",
        query: "Visible requirement",
        retrievalQuery: "Visible requirement de_bsig.section_30_1",
      }],
      [],
    );

    expect(prompt.prompt).toContain("Visible requirement");
    expect(prompt.prompt).not.toContain("de_bsig.section_30_1");
  });

  it("uses exactly the provider mode selected by the organization", () => {
    expect(() => selectGroundedProvider({
      selectedMode: "self_hosted",
      providers: { openai: provider("openai") },
    })).toThrowError(expect.objectContaining({ code: "AI_PROVIDER_UNAVAILABLE" }));
    expect(selectGroundedProvider({
      selectedMode: "self_hosted",
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

  it("projects rejected claims into safe failure diagnostics", () => {
    const [claim] = validateGroundedClaims({
      queryUnits: [{ id: "r1", query: "law" }],
      context: [],
      claims: [{
        key: "gap:r1",
        queryUnitId: "r1",
        kind: "legal",
        binding: true,
        citationIds: [],
        text: "sensitive generated rationale",
      }],
    });

    const diagnostic = toGroundingFailureDiagnostic([claim]);

    expect(diagnostic).toEqual({
      claims: [{
        key: "gap:r1",
        reason: "Legal claim lacks legal authority",
      }],
    });
    expect(JSON.stringify(diagnostic)).not.toContain(
      "sensitive generated rationale",
    );
    const persisted = safeGroundingFailureMessage({
      code: "GROUNDING_VALIDATION_FAILED",
      details: {
        ...diagnostic,
        generatedProse: "sensitive generated rationale",
        excerpt: "sensitive source excerpt",
      },
    });
    expect(JSON.parse(persisted)).toEqual({
      code: "GROUNDING_VALIDATION_FAILED",
      claims: [{
        key: "gap:r1",
        reason: "Legal claim lacks legal authority",
      }],
    });
    expect(persisted).not.toMatch(/sensitive generated|sensitive source/);
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
