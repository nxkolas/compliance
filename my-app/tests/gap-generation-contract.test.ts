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
import { buildGroundedPrompt } from "@/src/server/ai/grounding/context-builder";
import type { GroundingContextItem } from "@/src/server/ai/grounding/types";

const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/iu;

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
  admittedOrganizationCitations: [],
  questionnaireCitationIdsByQuestion: {
    "gap.protect.control": "Q:answer",
  },
  preferredPrimaryLegalCitationId: "LEGAL:protect",
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
        admittedOrganizationCitations: [
          { label: "D1", citationId: "ORG:policy" },
        ],
      },
      value: {
        ...protectValue,
        reviewNotice:
          "Der Fragebogen und das Organisationsdokument widersprechen sich.",
        contradictions: [
          "Der Fragebogen meldet eine fehlende Maßnahme, das Dokument beschreibt sie als umgesetzt.",
        ],
        conflictingOrganizationCitationIds: ["D1"],
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
    expect(GAP_PROMPT_VERSION).toBe("13");
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

const conflictPolicy: GapResponsePolicy = {
  ...protectPolicy,
  outputLocale: "en",
  semanticContextByQuestion: {
    "gap.protect.control": {
      locale: "en",
      questionStableKey: "gap.protect.control",
      questionText: "Is the protection control implemented?",
      selectedAnswer: "not_implemented",
      expectedKind: "missing",
    },
  },
  admittedOrganizationCitations: [
    { label: "D1", citationId: "ORG:policy" },
    { label: "D2", citationId: "ORG:runbook" },
  ],
};

const conflictValue = {
  gaps: {
    "gap.protect.control": [
      {
        statement: "The protection control is not implemented.",
        supportingOrganizationCitationIds: [],
      },
    ],
  },
  assumptions: [],
};

describe("Gap contract citation labels", () => {
  const chunkUuid = "0e6f5a2c-9b31-4d7e-8a4f-2c1d3e4f5a6b";
  const answerUuid = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
  const context: GroundingContextItem[] = [
    {
      channel: "legal",
      citationId: `LEGAL:NIS2-PROTECT-10:${chunkUuid}`,
      label: "L1",
      queryUnitId: "NIS2-PROTECT-10",
      sourceId: chunkUuid,
      excerpt: "The entity shall implement protection measures.",
      excerptHash: "a",
      rank: 1,
      score: 1,
      metadata: {},
    },
    {
      channel: "organization_document",
      citationId: `DOC:NIS2-PROTECT-10:${chunkUuid}`,
      label: "D1",
      queryUnitId: "NIS2-PROTECT-10",
      sourceId: chunkUuid,
      excerpt: "Our policy states the control is implemented.",
      excerptHash: "b",
      rank: 1,
      score: 1,
      metadata: {},
    },
    {
      channel: "questionnaire_assertion",
      citationId: `Q:NIS2-PROTECT-10:${answerUuid}`,
      label: "Q1",
      queryUnitId: "NIS2-PROTECT-10",
      sourceId: answerUuid,
      excerpt: "Is the protection control implemented?: Not implemented",
      excerptHash: "c",
      rank: 1,
      score: 1,
      metadata: {},
    },
  ];

  it("shows the model labels and never a raw identifier", () => {
    const { prompt } = buildGroundedPrompt(
      [{ id: "NIS2-PROTECT-10", query: "protection control" }],
      context,
    );

    expect(prompt).toContain("[L1]");
    expect(prompt).toContain("[D1]");
    expect(prompt).toContain("[Q1]");
    expect(prompt).not.toMatch(UUID_PATTERN);
    expect(prompt).not.toContain("DOC:NIS2-PROTECT-10");
  });

  it("resolves a selected label back to its citation ID", () => {
    const citationId = `DOC:NIS2-PROTECT-10:${chunkUuid}`;
    const result = normalizeGapCategoryResponse({
      policy: {
        ...conflictPolicy,
        admittedOrganizationCitations: [{ label: "D1", citationId }],
      },
      value: {
        ...conflictValue,
        gaps: {
          "gap.protect.control": [
            {
              statement: "The protection control is not implemented.",
              supportingOrganizationCitationIds: ["D1"],
            },
          ],
        },
        reviewNotice: null,
        contradictions: [],
        conflictingOrganizationCitationIds: [],
        requiresReview: false,
      },
    });

    expect(result.value.gaps[0]?.citationIds).toContain(citationId);
    expect(result.value.gaps[0]?.citationIds).not.toContain("D1");
    expect(result.value.citationIds).toContain(citationId);
  });
});

describe("Gap contract review-branch pinning", () => {
  it("pins requiresReview and reviewNotice when nothing was admitted", () => {
    const schema = z.toJSONSchema(
      buildGapCategoryResponseSchema({
        ...protectPolicy,
        forcedRequiresReview: false,
      }),
    ) as {
      properties: Record<string, { const?: unknown; type?: unknown }>;
    };

    expect(schema.properties.requiresReview).toMatchObject({ const: false });
    expect(schema.properties.reviewNotice).toMatchObject({ type: "null" });
  });

  it("leaves both free when organization evidence was admitted", () => {
    const schema = z.toJSONSchema(
      buildGapCategoryResponseSchema(conflictPolicy),
    ) as {
      properties: Record<string, { const?: unknown; type?: unknown }>;
    };

    expect(schema.properties.requiresReview).not.toHaveProperty("const");
    expect(schema.properties.reviewNotice).not.toMatchObject({ type: "null" });
  });
});

describe("Gap contract conflict-citation reconciliation", () => {
  it("keeps the exact citation the model named", () => {
    const result = normalizeGapCategoryResponse({
      policy: conflictPolicy,
      value: {
        ...conflictValue,
        reviewNotice: "The policy conflicts with the questionnaire.",
        contradictions: ["The policy says the control is implemented."],
        conflictingOrganizationCitationIds: ["D1"],
        requiresReview: true,
      },
    });

    expect(result.value.conflictingOrganizationCitationIds).toEqual([
      "ORG:policy",
    ]);
    expect(result.normalizationCodes).not.toContain(
      "normalized_conflict_citations_defaulted",
    );
  });

  it("falls back to every admitted citation when review names none", () => {
    const result = normalizeGapCategoryResponse({
      policy: conflictPolicy,
      value: {
        ...conflictValue,
        reviewNotice: "The policy conflicts with the questionnaire.",
        contradictions: ["The policy says the control is implemented."],
        conflictingOrganizationCitationIds: [],
        requiresReview: true,
      },
    });

    expect(result.value.conflictingOrganizationCitationIds).toEqual([
      "ORG:policy",
      "ORG:runbook",
    ]);
    expect(result.normalizationCodes).toContain(
      "normalized_conflict_citations_defaulted",
    );
  });

  it("drops conflict citations on a non-review finding", () => {
    const result = normalizeGapCategoryResponse({
      policy: conflictPolicy,
      value: {
        ...conflictValue,
        reviewNotice: null,
        contradictions: [],
        conflictingOrganizationCitationIds: ["D1"],
        requiresReview: false,
      },
    });

    expect(result.value.conflictingOrganizationCitationIds).toEqual([]);
    expect(result.normalizationCodes).toContain(
      "normalized_conflict_citations_cleared",
    );
  });

  it("clears conflicts when a review claim has no contradiction behind it", () => {
    const result = normalizeGapCategoryResponse({
      policy: conflictPolicy,
      value: {
        ...conflictValue,
        reviewNotice: "Document support is missing.",
        contradictions: [],
        conflictingOrganizationCitationIds: ["D1"],
        requiresReview: true,
      },
    });

    expect(result.value).toMatchObject({
      requiresReview: false,
      reviewNotice: null,
      conflictingOrganizationCitationIds: [],
    });
    expect(result.normalizationCodes).toEqual(
      expect.arrayContaining([
        "normalized_review_without_contradiction",
        "normalized_conflict_citations_cleared",
      ]),
    );
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
  admittedOrganizationCitations: [],
  questionnaireCitationIdsByQuestion: {
    "gap.risk.critical_dependencies": "Q:answer",
  },
  preferredPrimaryLegalCitationId: "LEGAL:risk",
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
