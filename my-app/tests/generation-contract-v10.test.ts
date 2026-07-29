import { describe, expect, it } from "vitest";
import {
  normalizeGapCategoryResponseV10,
  type GapResponsePolicyV10,
} from "@/src/server/gap-analysis/generation-schema-v10";
import { gapRepairPromptV10 } from "@/src/server/gap-analysis/prompt-contract-v10";

const policy: GapResponsePolicyV10 = {
  requirementCode: "NIS2-RISK-02",
  outputLocale: "en",
  statementBasis: {
    version: "1",
    triggeringQuestions: [
      {
        stableKey: "gap.risk.critical_dependencies",
        sourceAssessmentAnswerId: "00000000-0000-4000-8000-000000000001",
        kind: "missing",
      },
    ],
    satisfiedQuestionStableKeys: [],
  },
  semanticContextByQuestion: {
    "gap.risk.critical_dependencies": {
      locale: "en",
      questionStableKey: "gap.risk.critical_dependencies",
      questionText: "Are critical dependencies known?",
      selectedAnswer: "not_implemented",
      expectedKind: "missing",
    },
  },
  admittedOrganizationCitationIds: [],
  questionnaireCitationIdsByQuestion: {
    "gap.risk.critical_dependencies": "Q:answer",
  },
  preferredPrimaryLegalCitationId: "LEGAL:risk",
  forcedEvidenceSufficiency: "none",
  forcedRequiresReview: false,
};

const value = {
  gaps: {
    "gap.risk.critical_dependencies": [
      {
        statement: "Critical dependencies have not been established.",
        supportingOrganizationCitationIds: [],
      },
    ],
  },
  evidenceSufficiency: "none" as const,
  reviewNotice: null,
  assumptions: [],
  contradictions: [],
  requiresReview: false,
};

describe("Gap contract v10 objective safety repair", () => {
  it.each([
    ["Review https://example.com.", "url_forbidden"],
    ["Review 00000000-0000-4000-8000-000000000099.", "raw_identifier"],
  ])("returns a targeted prose-free issue for %s", (assumption, code) => {
    expect(() =>
      normalizeGapCategoryResponseV10({
        policy,
        value: { ...value, assumptions: [assumption] },
      }),
    ).toThrow(
      expect.objectContaining({
        issues: [{ code, path: ["assumptions", 0] }],
      }),
    );
  });

  it("explains only objective URL and raw-ID repair codes", () => {
    const prompt = gapRepairPromptV10({
      locale: "en",
      categoryCode: "NIS2-RISK-02",
      semanticContexts: Object.values(policy.semanticContextByQuestion),
      issues: [{ code: "url_forbidden", path: ["assumptions", 0] }],
    });
    expect(prompt).toContain("url_forbidden means remove every URL");
    expect(prompt).not.toContain("keyword");
    expect(prompt).not.toContain("synonym");
  });
});
