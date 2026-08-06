import { describe, expect, it } from "vitest";
import * as z from "zod";
import {
  buildGapCategoryResponseSchema,
  defaultGapStatementMaximum,
  normalizeGapCategoryResponse,
  type GapResponsePolicy,
} from "@/src/server/gap-analysis/generation-schema";
import {
  GAP_PROMPT_VERSION,
  gapPrompt,
  gapRepairPrompt,
} from "@/src/server/gap-analysis/prompt-contract";

const protectPolicy: GapResponsePolicy = {
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

const protectValue = {
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
  conflictingOrganizationCitationIds: [],
};

describe("Gap contract contradiction policy", () => {
  it("emits an OpenAI-compatible root object schema without allOf", () => {
    const jsonSchema = z.toJSONSchema(
      buildGapCategoryResponseSchema(protectPolicy),
    );

    expect(jsonSchema.type).toBe("object");
    expect(jsonSchema).not.toHaveProperty("allOf");
    expect(jsonSchema.properties).toHaveProperty(
      "conflictingOrganizationCitationIds",
    );
  });

  it("normalizes missing documentary support to a non-review finding", () => {
    const result = normalizeGapCategoryResponse({
      policy: protectPolicy,
      value: {
        ...protectValue,
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
    const result = normalizeGapCategoryResponse({
      policy: {
        ...protectPolicy,
        admittedOrganizationCitationIds: ["ORG:policy"],
      },
      value: {
        ...protectValue,
        reviewNotice:
          "Der Fragebogen und das Organisationsdokument widersprechen sich.",
        contradictions: [
          "Der Fragebogen meldet eine fehlende Maßnahme, das Dokument beschreibt sie als umgesetzt.",
        ],
        conflictingOrganizationCitationIds: ["ORG:policy"],
        requiresReview: true,
      },
    });

    expect(result.value.requiresReview).toBe(true);
    expect(result.value.reviewNotice).toContain("widersprechen");
  });

  it("explicitly excludes missing, irrelevant, and uncited evidence", () => {
    const prompt = gapPrompt({ locale: "de", semanticContexts: [] });

    expect(prompt).toContain(
      "Missing, insufficient, irrelevant, or uncited organization-document evidence is not a contradiction",
    );
    expect(GAP_PROMPT_VERSION).toBe("12");
  });

  it("makes concision and absence of legal exposition explicit writing goals", () => {
    const prompt = gapPrompt({ locale: "en", semanticContexts: [] });

    expect(prompt).toContain("at most 20 words");
    expect(prompt).toContain(
      "Do not name laws, directives, articles, sections, obligations, or citations",
    );
    expect(prompt).toContain("writing constraints");
  });
});

const riskPolicy: GapResponsePolicy = {
  requirementCode: "NIS2-RISK-02",
  outputLocale: "de",
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
  statementMaximumByQuestion: {
    "gap.risk.critical_dependencies": 1,
  },
  semanticContextByQuestion: {
    "gap.risk.critical_dependencies": {
      locale: "de",
      questionStableKey: "gap.risk.critical_dependencies",
      questionText: "Sind kritische Abhängigkeiten bekannt?",
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

const riskValue = {
  gaps: {
    "gap.risk.critical_dependencies": [
      {
        statement:
          "Die kritischen Geschäftsprozesse, IT-Systeme, Daten und Dienstleister sind nicht bekannt.",
        supportingOrganizationCitationIds: [],
      },
    ],
  },
  evidenceSufficiency: "none" as const,
  reviewNotice: null,
  assumptions: [],
  contradictions: [],
  requiresReview: false,
  conflictingOrganizationCitationIds: [],
};

describe("Gap contract semantic acceptance", () => {
  it("accepts confirmed-negative German wording without changing its server-owned kind", () => {
    const result = normalizeGapCategoryResponse({
      policy: {
        ...riskPolicy,
        semanticContextByQuestion: {
          "gap.risk.critical_dependencies": {
            locale: "de",
            questionStableKey: "gap.risk.critical_dependencies",
            questionText:
              "Ist bekannt, welche Geschäftsprozesse, IT-Systeme, Daten und Dienstleister für den Betrieb besonders wichtig sind?",
            selectedAnswer: "not_implemented",
            expectedKind: "missing",
          },
        },
      },
      value: riskValue,
    });

    expect(result.value.gaps[0]).toMatchObject({
      kind: "missing",
      statement:
        riskValue.gaps["gap.risk.critical_dependencies"][0]!.statement,
    });
  });

  it("accepts natural wording outside lexical kind lists while retaining exact structured keys", () => {
    const policy: GapResponsePolicy = {
      ...riskPolicy,
      outputLocale: "en",
      statementBasis: {
        ...riskPolicy.statementBasis,
        triggeringQuestions: [
          {
            ...riskPolicy.statementBasis.triggeringQuestions[0]!,
            kind: "partial",
          },
        ],
      },
      semanticContextByQuestion: {
        "gap.risk.critical_dependencies": {
          locale: "en",
          questionStableKey: "gap.risk.critical_dependencies",
          questionText:
            "Are critical business processes, IT systems, data, and suppliers known?",
          selectedAnswer: "partially_implemented",
          expectedKind: "partial",
        },
      },
    };
    const schema = buildGapCategoryResponseSchema(policy);
    const value = {
      ...riskValue,
      gaps: {
        "gap.risk.critical_dependencies": [
          {
            statement:
              "Coverage reaches core services today, with several dependencies awaiting cataloguing.",
            supportingOrganizationCitationIds: [],
          },
        ],
      },
    };

    expect(schema.safeParse(value).success).toBe(true);
    expect(
      normalizeGapCategoryResponse({ policy, value }).value.gaps[0]?.kind,
    ).toBe("partial");
    expect(
      schema.safeParse({
        ...value,
        gaps: {
          "gap.risk.another_key": value.gaps["gap.risk.critical_dependencies"],
        },
      }).success,
    ).toBe(false);
  });
});

describe("Gap contract objective prose safety", () => {
  it.each([
    ["Review https://example.com.", "url_forbidden"],
    ["Review 00000000-0000-4000-8000-000000000099.", "raw_identifier"],
  ])("returns a targeted prose-free issue for %s", (assumption, code) => {
    expect(() =>
      normalizeGapCategoryResponse({
        policy: riskPolicy,
        value: { ...riskValue, assumptions: [assumption] },
      }),
    ).toThrow(
      expect.objectContaining({
        issues: [{ code, path: ["assumptions", 0] }],
      }),
    );
  });

  it.each([
    "See https://example.com for details.",
    "Investigate 00000000-0000-4000-8000-000000000099.",
  ])("rejects unsafe gap prose: %s", (statement) => {
    expect(() =>
      normalizeGapCategoryResponse({
        policy: riskPolicy,
        value: {
          ...riskValue,
          gaps: {
            "gap.risk.critical_dependencies": [
              {
                statement,
                supportingOrganizationCitationIds: [],
              },
            ],
          },
        },
      }),
    ).toThrow(
      expect.objectContaining({
        issues: [
          {
            code: expect.stringMatching(/url_forbidden|raw_identifier/),
            path: ["gaps", "gap.risk.critical_dependencies", 0, "statement"],
          },
        ],
      }),
    );
  });

  it("requires an explicit bounded splittable policy", () => {
    expect(defaultGapStatementMaximum({})).toBe(1);
    expect(
      defaultGapStatementMaximum({ splittable: true, maximumStatements: 3 }),
    ).toBe(3);
    expect(() =>
      defaultGapStatementMaximum({
        splittable: true,
        maximumStatements: 6,
      }),
    ).toThrow();
  });

  it("reports the coupled review-notice state with stable paths", () => {
    expect(() =>
      normalizeGapCategoryResponse({
        policy: {
          ...riskPolicy,
          forcedRequiresReview: undefined,
          statementBasis: {
            version: "1",
            triggeringQuestions: [],
            satisfiedQuestionStableKeys: ["q.satisfied"],
          },
        },
        value: {
          gaps: {},
          evidenceSufficiency: "none",
          reviewNotice: null,
          assumptions: [],
          contradictions: ["The supplied records conflict."],
          requiresReview: true,
          conflictingOrganizationCitationIds: [],
        },
      }),
    ).toThrow(
      expect.objectContaining({
        issues: [
          { code: "review_notice_state", path: ["requiresReview"] },
          { code: "review_notice_state", path: ["reviewNotice"] },
        ],
      }),
    );
  });

  it("explains only objective URL and raw-ID repair codes", () => {
    const prompt = gapRepairPrompt({
      locale: "en",
      categoryCode: "NIS2-RISK-02",
      semanticContexts: Object.values(riskPolicy.semanticContextByQuestion),
      issues: [{ code: "url_forbidden", path: ["assumptions", 0] }],
    });

    expect(prompt).toContain("url_forbidden means remove every URL");
    expect(prompt).not.toContain("keyword");
    expect(prompt).not.toContain("synonym");
  });
});
