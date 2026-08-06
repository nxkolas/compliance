import { describe, expect, it } from "vitest";
import { contentHash } from "@/src/server/compliance";
import { hashExactPrompt } from "@/src/server/ai/generation/prompt-provenance";
import {
  CURRENT_GAP_PROMPT_METADATA,
  currentGapContractDefinition,
  gapPrompt,
  normalizeGapCategoryResponse,
  type GapResponsePolicy,
} from "@/src/server/gap-analysis/current-contract";
import {
  CURRENT_ACTION_PLAN_PROMPT_METADATA,
  actionPlanDefinitionHash,
  actionPlanPrompt,
} from "@/src/server/action-plans/current-contract";

describe("current code-owned generation contracts", () => {
  it("preserves the characterized Gap v14 definition and prompt behavior", () => {
    expect(CURRENT_GAP_PROMPT_METADATA.templateHash).toBe(
      "dcb0031e55a4c927b6d27d58856b762650fa6e26335ac2064f9aa8b66b7fc2f3",
    );
    expect(currentGapContractDefinition.versionLabel).toBe("reliability-v8");
    expect(gapPrompt({ locale: "en", semanticContexts: [] })).toContain(
      "Missing, insufficient, irrelevant, or uncited organization-document evidence is not a contradiction",
    );

    const normalized = normalizeGapCategoryResponse({
      policy: gapPolicy(),
      value: {
        gaps: {
          "gap.protect.control": [{
            statement: "The protection control is not implemented.",
            supportingOrganizationCitationIds: [],
          }],
        },
        reviewNotice: "Document support is missing.",
        assumptions: [],
        contradictions: [],
        conflictingOrganizationCitationIds: [],
        requiresReview: true,
      },
    });
    expect(normalized.value).toMatchObject({
      requiresReview: false,
      reviewNotice: null,
      contradictions: [],
    });
  });

  it("accepts only an exact unique organization-citation conflict subset", () => {
    const policy = {
      ...gapPolicy(),
      admittedOrganizationCitations: [
        { label: "D1", citationId: "ORG:policy" },
        { label: "D2", citationId: "ORG:runbook" },
      ],
    };
    const value = {
      gaps: {
        "gap.protect.control": [{
          statement: "The protection control is not implemented.",
          supportingOrganizationCitationIds: [],
        }],
      },
      reviewNotice: "The policy conflicts with the questionnaire.",
      assumptions: [],
      contradictions: ["The policy says the control is implemented."],
      conflictingOrganizationCitationIds: ["D1"],
      requiresReview: true,
    };

    expect(
      normalizeGapCategoryResponse({ policy, value }).value
        .conflictingOrganizationCitationIds,
    ).toEqual(["ORG:policy"]);
    expect(() =>
      normalizeGapCategoryResponse({
        policy,
        value: {
          ...value,
          conflictingOrganizationCitationIds: ["D1", "D1"],
        },
      }),
    ).toThrow();
    expect(() =>
      normalizeGapCategoryResponse({
        policy,
        value: {
          ...value,
          conflictingOrganizationCitationIds: ["LEGAL:protect"],
        },
      }),
    ).toThrow();
  });

  it("preserves the characterized Action Plan v7 prompt and owns a domain hash", () => {
    expect(CURRENT_ACTION_PLAN_PROMPT_METADATA.templateHash).toBe(
      "b08c8ae86f3eb48560d874ccb17bdf3778b13c4174fee7d199a6e6bed8e7c7d4",
    );
    expect(actionPlanPrompt("en")).toContain(
      "verificationResult contains only the completed verification work and its documented outcome",
    );
    expect(actionPlanDefinitionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(actionPlanDefinitionHash).toBe(
      contentHash({
        prompt: CURRENT_ACTION_PLAN_PROMPT_METADATA,
        generation: {
          categoryScoped: true,
          gapCoverage: "within-category-many-to-many",
          outputLocale: "caller-selected",
          responseNormalization: "current",
        },
      }),
    );
  });

  it("fingerprints the exact prompt messages and response schema metadata", () => {
    const first = hashExactPrompt({
      messages: [
        { role: "system", content: "System" },
        { role: "user", content: "User" },
      ],
      responseSchema: { name: "gap", version: "current", schemaVersion: "1" },
    });
    expect(first).toBe(hashExactPrompt({
      responseSchema: { schemaVersion: "1", version: "current", name: "gap" },
      messages: [
        { content: "System", role: "system" },
        { content: "User", role: "user" },
      ],
    }));
    expect(first).not.toBe(hashExactPrompt({
      messages: [
        { role: "system", content: "System changed" },
        { role: "user", content: "User" },
      ],
      responseSchema: { name: "gap", version: "current", schemaVersion: "1" },
    }));
    expect(first).not.toBe(hashExactPrompt({
      messages: [
        { role: "system", content: "System" },
        { role: "user", content: "User" },
      ],
      responseSchema: { name: "gap", version: "current", schemaVersion: "2" },
    }));
  });
});

function gapPolicy(): GapResponsePolicy {
  return {
    requirementCode: "NIS2-PROTECT-10",
    outputLocale: "en",
    statementBasis: {
      version: "1",
      triggeringQuestions: [{
        stableKey: "gap.protect.control",
        sourceAssessmentAnswerId: "00000000-0000-4000-8000-000000000001",
        kind: "missing",
      }],
      satisfiedQuestionStableKeys: [],
    },
    semanticContextByQuestion: {
      "gap.protect.control": {
        locale: "en",
        questionStableKey: "gap.protect.control",
        questionText: "Is the protection control implemented?",
        selectedAnswer: "not_implemented",
        expectedKind: "missing",
      },
    },
    admittedOrganizationCitations: [],
    questionnaireCitationIdsByQuestion: {
      "gap.protect.control": "Q:answer",
    },
    preferredPrimaryLegalCitationId: "LEGAL:protect",
  };
}
