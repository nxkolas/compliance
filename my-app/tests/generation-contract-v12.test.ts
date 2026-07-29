import { describe, expect, it } from "vitest";
import {
  normalizeGapCategoryResponseV12,
  type GapResponsePolicyV12,
} from "@/src/server/gap-analysis/generation-schema-v12";
import {
  GAP_PROMPT_V12_VERSION,
  gapPromptV12,
} from "@/src/server/gap-analysis/prompt-contract-v12";

const policy: GapResponsePolicyV12 = {
  requirementCode: "NIS2-PROTECT-10",
  outputLocale: "de",
  statementBasis: {
    version: "1",
    triggeringQuestions: [
      {
        stableKey: "gap.protect.control",
        sourceAssessmentAnswerId: "00000000-0000-4000-8000-000000000001",
        kind: "missing",
      },
    ],
    satisfiedQuestionStableKeys: [],
  },
  semanticContextByQuestion: {
    "gap.protect.control": {
      locale: "de",
      questionStableKey: "gap.protect.control",
      questionText: "Ist die Schutzmaßnahme umgesetzt?",
      selectedAnswer: "not_implemented",
      expectedKind: "missing",
    },
  },
  admittedOrganizationCitationIds: [],
  questionnaireCitationIdsByQuestion: {
    "gap.protect.control": "Q:answer",
  },
  preferredPrimaryLegalCitationId: "LEGAL:protect",
  forcedEvidenceSufficiency: "none",
};

const baseValue = {
  gaps: {
    "gap.protect.control": [
      {
        statement: "Die Schutzmaßnahme ist nicht umgesetzt.",
        supportingOrganizationCitationIds: [],
      },
    ],
  },
  evidenceSufficiency: "none" as const,
  assumptions: [],
};

describe("Gap contract v12 contradiction policy", () => {
  it("normalizes missing documentary support to a non-review finding", () => {
    const result = normalizeGapCategoryResponseV12({
      policy,
      value: {
        ...baseValue,
        reviewNotice:
          "Die Angaben wurden nicht unabhängig durch Organisationsdokumente verifiziert.",
        contradictions: [],
        requiresReview: true,
      },
    });

    expect(result.value).toMatchObject({
      contradictions: [],
      requiresReview: false,
      reviewNotice: null,
    });
    expect(result.normalizationCodes).toContain(
      "normalized_review_without_contradiction",
    );
  });

  it("preserves a review warning for an actual contradiction", () => {
    const result = normalizeGapCategoryResponseV12({
      policy,
      value: {
        ...baseValue,
        reviewNotice:
          "Der Fragebogen und das Organisationsdokument widersprechen sich.",
        contradictions: [
          "Der Fragebogen meldet eine fehlende Maßnahme, das Dokument beschreibt sie als umgesetzt.",
        ],
        requiresReview: true,
      },
    });

    expect(result.value.requiresReview).toBe(true);
    expect(result.value.reviewNotice).toContain("widersprechen");
  });

  it("explicitly excludes missing, irrelevant, and uncited evidence", () => {
    const prompt = gapPromptV12({
      locale: "de",
      semanticContexts: [],
    });

    expect(prompt).toContain(
      "Missing, insufficient, irrelevant, or uncited organization-document evidence is not a contradiction",
    );
    expect(GAP_PROMPT_V12_VERSION).toBe("12");
  });
});
