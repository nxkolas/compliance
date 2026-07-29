import { describe, expect, it } from "vitest";
import {
  normalizeGapCategoryResponseV8,
  type GapResponsePolicyV8,
} from "@/src/server/gap-analysis/generation-schema-v8";
import {
  buildGapCategoryResponseSchemaV9,
  normalizeGapCategoryResponseV9,
  type GapResponsePolicyV9,
} from "@/src/server/gap-analysis/generation-schema-v9";
import {
  buildActionPlanCategoryResponseSchemaV3,
  normalizeActionPlanCategoryResponseV3,
  type ActionPlanCategoryPolicyV3,
} from "@/src/server/action-plans/generation-schema-v3";

const incidentPolicy: GapResponsePolicyV8 = {
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
  admittedOrganizationCitationIds: [],
  questionnaireCitationIdsByQuestion: {
    "gap.risk.critical_dependencies": "Q:answer",
  },
  preferredPrimaryLegalCitationId: "LEGAL:risk",
  forcedEvidenceSufficiency: "none",
  forcedRequiresReview: false,
};

const incidentValue = {
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
};

describe("Gap contract v9", () => {
  it("accepts the incident's confirmed-negative German wording without changing its server-owned kind", () => {
    expect(() =>
      normalizeGapCategoryResponseV8({
        policy: incidentPolicy,
        value: incidentValue,
      }),
    ).toThrow(
      expect.objectContaining({
        issues: [
          {
            code: "gap_kind_mismatch",
            path: ["gaps", "gap.risk.critical_dependencies", 0, "statement"],
          },
        ],
      }),
    );

    const result = normalizeGapCategoryResponseV9({
      policy: {
        ...incidentPolicy,
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
      value: incidentValue,
    });

    expect(result.value.gaps[0]).toMatchObject({
      kind: "missing",
      statement:
        incidentValue.gaps["gap.risk.critical_dependencies"][0].statement,
    });
  });

  it("accepts natural wording outside lexical kind lists while retaining exact structured keys", () => {
    const policy: GapResponsePolicyV9 = {
      ...incidentPolicy,
      outputLocale: "en",
      statementBasis: {
        ...incidentPolicy.statementBasis,
        triggeringQuestions: [
          {
            ...incidentPolicy.statementBasis.triggeringQuestions[0]!,
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
    const schema = buildGapCategoryResponseSchemaV9(policy);
    const value = {
      ...incidentValue,
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
      normalizeGapCategoryResponseV9({ policy, value }).value.gaps[0]?.kind,
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

  it.each([
    "See https://example.com for details.",
    "Investigate 00000000-0000-4000-8000-000000000099.",
  ])("rejects unsafe prose: %s", (statement) => {
    const policy: GapResponsePolicyV9 = {
      ...incidentPolicy,
      semanticContextByQuestion: {
        "gap.risk.critical_dependencies": {
          locale: "de",
          questionStableKey: "gap.risk.critical_dependencies",
          questionText: "Sind kritische Abhängigkeiten bekannt?",
          selectedAnswer: "not_implemented",
          expectedKind: "missing",
        },
      },
    };
    expect(() =>
      normalizeGapCategoryResponseV9({
        policy,
        value: {
          ...incidentValue,
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
            code: expect.stringMatching(
              /content_invalid|action_raw_identifier/,
            ),
            path: ["gaps", "gap.risk.critical_dependencies", 0, "statement"],
          },
        ],
      }),
    );
  });
});

const actionPolicy: ActionPlanCategoryPolicyV3 = {
  requirementCode: "NIS2-GOV-01",
  sourceFindingId: "finding-1",
  priority: "high",
  outputLocale: "en",
  gaps: [
    { key: "G1", kind: "uncertain" },
    { key: "G2", kind: "missing" },
  ],
  admittedOrganizationCitationIds: [],
  mandatoryCitationIdsByGapKey: {
    G1: ["Q:1", "LEGAL:1"],
    G2: ["Q:2", "LEGAL:1"],
  },
};

describe("Action Plan contract v3", () => {
  it("accepts natural verification and remediation prose without lexical style gates", () => {
    const value = {
      actions: [
        {
          mode: "verification" as const,
          gapKeys: ["G1"],
          verificationTitle: "Map the present access landscape",
          verificationResult:
            "A defensible picture of privileged access now exists.",
          conditionalRemediation: null,
          suggestedEvidence: ["Access landscape record"],
          supportingOrganizationCitationIds: [],
        },
        {
          mode: "remediation" as const,
          gapKeys: ["G2"],
          title: "Shape a durable response process",
          result:
            "Teams share one operational path for handling security events.",
          suggestedEvidence: ["Response process record"],
          supportingOrganizationCitationIds: [],
        },
      ],
    };

    const result = normalizeActionPlanCategoryResponseV3({
      policy: actionPolicy,
      value,
    });
    expect(result.value.actions).toHaveLength(2);
    expect(result.value.actions[0]?.gapKeys).toEqual(["G1"]);
    expect(result.value.actions[1]?.gapKeys).toEqual(["G2"]);
  });

  it("enforces server-owned modes and complete coverage", () => {
    const schema = buildActionPlanCategoryResponseSchemaV3(actionPolicy);
    expect(
      schema.safeParse({
        actions: [
          {
            mode: "remediation",
            gapKeys: ["G1"],
            title: "Map access",
            result: "The access landscape exists.",
            suggestedEvidence: ["Access record"],
            supportingOrganizationCitationIds: [],
          },
        ],
      }).success,
    ).toBe(false);

    expect(() =>
      normalizeActionPlanCategoryResponseV3({
        policy: actionPolicy,
        value: {
          actions: [
            {
              mode: "verification",
              gapKeys: ["G1"],
              verificationTitle: "Map access",
              verificationResult: "The access landscape now exists.",
              conditionalRemediation: null,
              suggestedEvidence: ["Access record"],
              supportingOrganizationCitationIds: [],
            },
          ],
        },
      }),
    ).toThrow(
      expect.objectContaining({
        issues: [{ code: "coverage_incomplete", path: ["actions"] }],
      }),
    );
  });
});
