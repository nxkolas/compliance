import { describe, expect, it } from "vitest";
import * as z from "zod";
import {
  buildGapCategoryResponseSchemaV8,
  defaultGapStatementMaximum,
  normalizeGapCategoryResponseV8,
  type GapResponsePolicyV8,
} from "@/src/server/gap-analysis/generation-schema-v8";
import {
  buildActionPlanCategoryResponseSchemaV2,
  normalizeActionPlanCategoryResponseV2,
  type ActionPlanCategoryPolicyV2,
} from "@/src/server/action-plans/generation-schema-v2";
import { validateAtomicGapStatement } from "@/src/server/gap-analysis/gap-style";

const gapPolicy: GapResponsePolicyV8 = {
  requirementCode: "CAT-A",
  outputLocale: "en",
  statementBasis: {
    version: "1",
    triggeringQuestions: [
      {
        stableKey: "q.missing",
        sourceAssessmentAnswerId: "answer-1",
        kind: "missing",
      },
    ],
    satisfiedQuestionStableKeys: ["q.satisfied"],
  },
  admittedOrganizationCitationIds: ["DOC:1"],
  questionnaireCitationIdsByQuestion: { "q.missing": "Q:1" },
  preferredPrimaryLegalCitationId: "LEGAL:1",
};

describe("Gap contract v8", () => {
  it("requires exact trigger keys and one statement by default", () => {
    const schema = buildGapCategoryResponseSchemaV8(gapPolicy);
    const base = {
      gaps: {
        "q.missing": [
          {
            statement: "The incident response process is missing.",
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
    expect(schema.safeParse(base).success).toBe(true);
    expect(
      schema.safeParse({
        ...base,
        gaps: { ...base.gaps, "q.satisfied": base.gaps["q.missing"] },
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        ...base,
        gaps: {
          "q.missing": [
            ...base.gaps["q.missing"],
            ...base.gaps["q.missing"],
          ],
        },
      }).success,
    ).toBe(false);
    expect(JSON.stringify(z.toJSONSchema(schema))).toContain(
      "state confirmed absence",
    );
  });

  it("emits provider-compatible JSON Schema without optional citations", () => {
    const schema = buildGapCategoryResponseSchemaV8({
      ...gapPolicy,
      admittedOrganizationCitationIds: [],
    });
    const jsonSchema = z.toJSONSchema(schema);
    expect(JSON.stringify(jsonSchema)).not.toContain('"not"');
  });

  it("reserves verification-result space for the server-owned condition", () => {
    const schema = buildActionPlanCategoryResponseSchemaV2(actionPolicy);
    expect(
      schema.safeParse({
        actions: [
          {
            mode: "verification",
            gapKeys: ["G1"],
            verificationTitle: "Verify backup restoration",
            verificationResult:
              "Restorability has been assessed and documented.",
            conditionalRemediation: "x".repeat(101),
            suggestedEvidence: ["Restoration test record"],
            supportingOrganizationCitationIds: [],
          },
          {
            mode: "remediation",
            gapKeys: ["G2"],
            title: "Create incident response process",
            result: "An approved incident response process exists.",
            suggestedEvidence: ["Approved process"],
            supportingOrganizationCitationIds: [],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("projects mandatory questionnaire and legal citations on the server", () => {
    const result = normalizeGapCategoryResponseV8({
      policy: gapPolicy,
      value: {
        gaps: {
          "q.missing": [
            {
              statement: " The incident response process is missing ",
              supportingOrganizationCitationIds: ["DOC:1", "DOC:1"],
            },
          ],
        },
        evidenceSufficiency: "partial",
        reviewNotice: null,
        assumptions: [],
        contradictions: [],
        requiresReview: false,
      },
    });
    expect(result.value.gaps[0]?.citationIds).toEqual(["Q:1", "DOC:1"]);
    expect(result.value.citationIds).toEqual(["LEGAL:1", "DOC:1"]);
    expect(result.value.gaps[0]?.statement).toBe(
      "The incident response process is missing.",
    );
  });

  it("returns a stable path and code for semantic kind repair", () => {
    expect(() =>
      normalizeGapCategoryResponseV8({
        policy: {
          ...gapPolicy,
          statementBasis: {
            ...gapPolicy.statementBasis,
            triggeringQuestions:
              gapPolicy.statementBasis.triggeringQuestions.map(
                (trigger) => ({ ...trigger, kind: "partial" as const }),
              ),
          },
        },
        value: {
          gaps: {
            "q.missing": [
              {
                statement: "It is unclear whether the process exists.",
                supportingOrganizationCitationIds: [],
              },
            ],
          },
          evidenceSufficiency: "none",
          reviewNotice: null,
          assumptions: [],
          contradictions: [],
          requiresReview: false,
        },
      }),
    ).toThrow(
      expect.objectContaining({
        issues: [
          {
            code: "gap_kind_mismatch",
            path: ["gaps", "q.missing", 0, "statement"],
          },
        ],
      }),
    );
  });

  it("treats an evidentiary hedge as a confirmed-kind mismatch", () => {
    expect(() =>
      normalizeGapCategoryResponseV8({
        policy: { ...gapPolicy, admittedOrganizationCitationIds: [] },
        value: {
          gaps: {
            "q.missing": [
              {
                statement:
                  "There is no evidence that backups are performed regularly.",
                supportingOrganizationCitationIds: [],
              },
            ],
          },
          evidenceSufficiency: "none",
          reviewNotice: null,
          assumptions: [],
          contradictions: [],
          requiresReview: false,
        },
      }),
    ).toThrow(
      expect.objectContaining({
        issues: [
          {
            code: "gap_kind_mismatch",
            path: ["gaps", "q.missing", 0, "statement"],
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

  it("accepts idiomatic German uncertainty wording", () => {
    expect(
      validateAtomicGapStatement({
        statement:
          "Es besteht Unsicherheit, ob Zugänge bei einem Austritt zeitnah gesperrt werden.",
        kind: "uncertain",
        locale: "de",
      }),
    ).toContain("Unsicherheit");
  });

  it("reports the coupled review-notice state with stable paths", () => {
    expect(() =>
      normalizeGapCategoryResponseV8({
        policy: {
          ...gapPolicy,
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
});

const actionPolicy: ActionPlanCategoryPolicyV2 = {
  requirementCode: "CAT-A",
  sourceFindingId: "finding-1",
  priority: "high",
  outputLocale: "en",
  gaps: [
    { key: "G1", kind: "uncertain" },
    { key: "G2", kind: "missing" },
  ],
  admittedOrganizationCitationIds: ["DOC:1"],
  mandatoryCitationIdsByGapKey: {
    G1: ["Q:1", "LEGAL:1"],
    G2: ["Q:2", "LEGAL:1"],
  },
};

describe("Action Plan contract v2", () => {
  it("enforces the action mode with disjoint uncertain and confirmed gap keys", () => {
    const schema = buildActionPlanCategoryResponseSchemaV2(actionPolicy);
    const valid = {
      actions: [
        {
          mode: "verification" as const,
          gapKeys: ["G1"],
          verificationTitle: "Verify backup restoration",
          verificationResult: "Restorability has been assessed and documented.",
          conditionalRemediation: null,
          suggestedEvidence: ["Restoration test record"],
          supportingOrganizationCitationIds: [],
        },
        {
          mode: "remediation" as const,
          gapKeys: ["G2"],
          title: "Create incident response process",
          result: "An approved incident response process exists.",
          suggestedEvidence: ["Approved process"],
          supportingOrganizationCitationIds: [],
        },
      ],
    };
    expect(schema.safeParse(valid).success).toBe(true);
    expect(
      schema.safeParse({
        actions: [{ ...valid.actions[1], gapKeys: ["G1"] }],
      }).success,
    ).toBe(false);
  });

  it("emits provider-compatible JSON Schema without optional citations", () => {
    const schema = buildActionPlanCategoryResponseSchemaV2({
      ...actionPolicy,
      admittedOrganizationCitationIds: [],
    });
    const jsonSchema = z.toJSONSchema(schema);
    expect(JSON.stringify(jsonSchema)).not.toContain('"not"');
  });

  it("renders conditional remediation and projects mandatory citations", () => {
    const result = normalizeActionPlanCategoryResponseV2({
      policy: {
        ...actionPolicy,
        requirementCode: "NIS2-BC-05",
        gaps: [{ key: "G1", kind: "uncertain" }],
      },
      value: {
        actions: [
          {
            mode: "verification",
            gapKeys: ["G1"],
            verificationTitle: "Verify backup restoration",
            verificationResult:
              "Restorability has been assessed and documented.",
            conditionalRemediation: "Create a tested restoration procedure",
            suggestedEvidence: ["Restoration test record"],
            supportingOrganizationCitationIds: ["DOC:1"],
          },
        ],
      },
    });
    expect(result.value.actions[0]?.result).toContain(
      "If verification identifies a deficiency",
    );
    expect(result.value.actions[0]?.citationIds).toEqual([
      "Q:1",
      "LEGAL:1",
      "DOC:1",
    ]);
  });

  it("rejects a copied backup example outside the continuity category", () => {
    expect(() =>
      normalizeActionPlanCategoryResponseV2({
        policy: {
          ...actionPolicy,
          requirementCode: "NIS2-GOV-01",
          gaps: [{ key: "G1", kind: "uncertain" }],
        },
        value: {
          actions: [
            {
              mode: "verification",
              gapKeys: ["G1"],
              verificationTitle: "Verify backup restoration",
              verificationResult:
                "Restorability has been assessed and documented.",
              conditionalRemediation: null,
              suggestedEvidence: ["Restoration test record"],
              supportingOrganizationCitationIds: [],
            },
          ],
        },
      }),
    ).toThrow(
      expect.objectContaining({
        issues: [
          {
            code: "action_example_leakage",
            path: ["actions", 0],
          },
        ],
      }),
    );
  });

  it("requires a completed verification outcome", () => {
    expect(() =>
      normalizeActionPlanCategoryResponseV2({
        policy: {
          ...actionPolicy,
          gaps: [{ key: "G1", kind: "uncertain" }],
        },
        value: {
          actions: [
            {
              mode: "verification",
              gapKeys: ["G1"],
              verificationTitle: "Verify access controls",
              verificationResult:
                "It remains unclear whether access controls exist.",
              conditionalRemediation: null,
              suggestedEvidence: ["Access review record"],
              supportingOrganizationCitationIds: [],
            },
          ],
        },
      }),
    ).toThrow(
      expect.objectContaining({
        issues: [
          {
            code: "action_verification_result_state",
            path: ["actions", 0, "verificationResult"],
          },
        ],
      }),
    );
  });

  it("preserves German noun capitalization in conditional remediation", () => {
    const result = normalizeActionPlanCategoryResponseV2({
      policy: {
        ...actionPolicy,
        requirementCode: "NIS2-BC-05",
        outputLocale: "de",
        gaps: [{ key: "G1", kind: "uncertain" }],
      },
      value: {
        actions: [
          {
            mode: "verification",
            gapKeys: ["G1"],
            verificationTitle: "Backup-Wiederherstellung prüfen",
            verificationResult:
              "Die Wiederherstellbarkeit ist dokumentiert bewertet.",
            conditionalRemediation: "Backup-Strategie dokumentieren",
            suggestedEvidence: ["Wiederherstellungstest"],
            supportingOrganizationCitationIds: [],
          },
        ],
      },
    });
    expect(result.value.actions[0]?.result).toContain(
      "ergibt, Backup-Strategie dokumentieren.",
    );
  });

  it("returns a stable repair issue for legal analysis in action prose", () => {
    expect(() =>
      normalizeActionPlanCategoryResponseV2({
        policy: {
          ...actionPolicy,
          gaps: [{ key: "G2", kind: "missing" }],
        },
        value: {
          actions: [
            {
              mode: "remediation",
              gapKeys: ["G2"],
              title: "Document access controls",
              result: "The NIS2 legal requirement is documented.",
              suggestedEvidence: ["Access control record"],
              supportingOrganizationCitationIds: [],
            },
          ],
        },
      }),
    ).toThrow(
      expect.objectContaining({
        issues: [
          {
            code: "action_legal_analysis",
            path: ["actions", 0],
          },
        ],
      }),
    );
  });

  it("budgets the rendered verification result after adding the server condition", () => {
    const repeated = Array.from(
      { length: 18 },
      (_, index) => `w${index}`,
    ).join(" ");
    expect(() =>
      normalizeActionPlanCategoryResponseV2({
        policy: {
          ...actionPolicy,
          gaps: [{ key: "G1", kind: "uncertain" }],
        },
        value: {
          actions: [
            {
              mode: "verification",
              gapKeys: ["G1"],
              verificationTitle: "Verify access controls",
              verificationResult: `${repeated} documented.`,
              conditionalRemediation: `${repeated}.`,
              suggestedEvidence: ["Access review record"],
              supportingOrganizationCitationIds: [],
            },
          ],
        },
      }),
    ).toThrow(
      expect.objectContaining({
        issues: [
          {
            code: "action_result_length",
            path: ["actions", 0],
          },
        ],
      }),
    );
  });
});
