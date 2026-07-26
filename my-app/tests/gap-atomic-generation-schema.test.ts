import { describe, expect, it } from "vitest";
import * as z from "zod";
import {
  buildGapModelResponseSchemaV7,
  deriveAtomicGapKind,
  normalizeGroundedGapModelResponseV7,
} from "@/src/server/gap-analysis/generation-schema-v7";
import { atomicGapGroundedClaims } from "@/src/server/gap-analysis/grounded-claims";

describe("atomic Gap response contract", () => {
  it("treats atomic control-state gaps as organization claims", () => {
    const [claim] = atomicGapGroundedClaims([
      {
        requirementCode: "REQ",
        statementBasis: {
          version: "1",
          triggeringQuestions: [],
          satisfiedQuestionStableKeys: [],
        },
        statementBasisHash: "hash",
        evidenceSufficiency: "none",
        gaps: [
          {
            questionStableKey: "trigger",
            sourceAssessmentAnswerId: "00000000-0000-4000-8000-000000000001",
            kind: "missing",
            statement: "MFA is missing.",
            citationIds: ["Q:answer"],
          },
        ],
        reviewNotice: null,
        assumptions: [],
        citationIds: ["LEGAL:req"],
        contradictions: [],
        requiresReview: false,
        legalCitationId: "LEGAL:req",
      },
    ]);

    expect(claim).toMatchObject({
      kind: "organization",
      binding: false,
      citationIds: ["Q:answer"],
    });
  });

  it("emits an OpenAI-strict schema with every finding property required", () => {
    const schema = z.toJSONSchema(
      buildGapModelResponseSchemaV7([policy()]),
    ) as {
      properties?: {
        findings?: {
          properties?: {
            REQ?: { required?: string[] };
          };
        };
      };
    };

    expect(schema.properties?.findings?.properties?.REQ?.required).toEqual(
      expect.arrayContaining([
        "gaps",
        "evidenceSufficiency",
        "assumptions",
        "citations",
        "contradictions",
        "reviewNotice",
        "requiresReview",
        "legalCitation",
      ]),
    );
  });

  it("describes the server-owned kind and exact answer citation to the provider", () => {
    const schema = z.toJSONSchema(
      buildGapModelResponseSchemaV7([policy()]),
    ) as {
      properties?: {
        findings?: {
          properties?: {
            REQ?: {
              properties?: {
                gaps?: {
                  properties?: {
                    trigger?: {
                      items?: {
                        properties?: {
                          statement?: { description?: string };
                          citations?: { description?: string };
                        };
                      };
                    };
                  };
                };
                reviewNotice?: { description?: string };
              };
            };
          };
        };
      };
    };
    const finding = schema.properties?.findings?.properties?.REQ?.properties;
    const gap =
      finding?.gaps?.properties?.trigger?.items?.properties;

    expect(gap?.statement?.description).toContain(
      'server-owned kind "missing"',
    );
    expect(gap?.citations?.description).toContain("Q:answer");
    expect(finding?.reviewNotice?.description).toContain(
      "Return null when requiresReview is false",
    );
  });

  it("accepts one atomic gap for each server-owned trigger", () => {
    const policies = [
      {
        requirementCode: "NIS2-IAM-03",
        outputLocale: "en" as const,
        status: "not_fulfilled" as const,
        statementBasis: {
          version: "1" as const,
          triggeringQuestions: [
            {
              stableKey: "gap.iam.mfa",
              sourceAssessmentAnswerId: "00000000-0000-4000-8000-000000000001",
              kind: "missing" as const,
            },
          ],
          satisfiedQuestionStableKeys: [],
        },
        permittedCitationIds: [
          "Q:00000000-0000-4000-8000-000000000001",
          "LEGAL:mfa",
        ],
        questionnaireCitationIdsByQuestion: {
          "gap.iam.mfa": "Q:00000000-0000-4000-8000-000000000001",
        },
        admittedOrganizationCitationIds: [],
        preferredPrimaryLegalCitationIds: ["LEGAL:mfa"],
      },
    ];
    const value = {
      findings: {
        "NIS2-IAM-03": {
          gaps: {
            "gap.iam.mfa": [
              {
                statement: "MFA is missing for privileged access.",
                citations: [
                  "Q:00000000-0000-4000-8000-000000000001",
                  "LEGAL:mfa",
                ],
              },
            ],
          },
          evidenceSufficiency: "none" as const,
          assumptions: [],
          citations: ["LEGAL:mfa"],
          contradictions: [],
          reviewNotice: null,
          requiresReview: false,
          legalCitation: "LEGAL:mfa",
        },
      },
    };

    expect(buildGapModelResponseSchemaV7(policies).parse(value)).toEqual(value);
    expect(
      normalizeGroundedGapModelResponseV7({ value, policies })[0]?.gaps,
    ).toEqual([
      {
        questionStableKey: "gap.iam.mfa",
        sourceAssessmentAnswerId: "00000000-0000-4000-8000-000000000001",
        kind: "missing",
        statement: "MFA is missing for privileged access.",
        citationIds: ["Q:00000000-0000-4000-8000-000000000001", "LEGAL:mfa"],
      },
    ]);
  });

  it("requires a review notice exactly when review is required", () => {
    const policies = [policy()];
    const unresolved = response();
    unresolved.findings.REQ.requiresReview = true;
    unresolved.findings.REQ.contradictions = [
      "The questionnaire and admitted evidence conflict.",
    ];

    expect(() =>
      buildGapModelResponseSchemaV7(policies).parse(unresolved),
    ).toThrow(/review notice/i);

    unresolved.findings.REQ.reviewNotice =
      "Questionnaire and document evidence conflict.";
    expect(buildGapModelResponseSchemaV7(policies).parse(unresolved)).toEqual(
      unresolved,
    );

    const resolved = response();
    resolved.findings.REQ.reviewNotice = "This notice must not be present.";
    expect(() =>
      buildGapModelResponseSchemaV7(policies).parse(resolved),
    ).toThrow(/review notice/i);
  });

  it.each([
    ["not_implemented", false, "missing"],
    ["partially_implemented", false, "partial"],
    ["unsure", false, "uncertain"],
    ["not_applicable", true, "uncertain"],
  ] as const)(
    "derives %s as a server-owned %s gap kind",
    (answer, allNotApplicable, expected) => {
      expect(deriveAtomicGapKind(answer, allNotApplicable)).toBe(expected);
    },
  );

  it("rejects satisfied and non-triggering answers", () => {
    expect(() => deriveAtomicGapKind("fully_implemented", false)).toThrow(
      /trigger/i,
    );
    expect(() => deriveAtomicGapKind("not_applicable", false)).toThrow(
      /trigger/i,
    );
  });

  it("enforces exact trigger keys, one-to-five gaps, and answer traceability", () => {
    const policies = [policy()];
    const unknown = response();
    (unknown.findings.REQ.gaps as Record<string, unknown>).satisfied =
      unknown.findings.REQ.gaps.trigger;
    expect(() =>
      buildGapModelResponseSchemaV7(policies).parse(unknown),
    ).toThrow();

    const six = response();
    six.findings.REQ.gaps.trigger = Array.from({ length: 6 }, () => ({
      statement: "MFA is missing for privileged access.",
      citations: ["Q:answer", "LEGAL:req"],
    }));
    expect(() => buildGapModelResponseSchemaV7(policies).parse(six)).toThrow();

    const untraceable = response();
    untraceable.findings.REQ.gaps.trigger[0]!.citations = ["LEGAL:req"];
    expect(() =>
      buildGapModelResponseSchemaV7(policies).parse(untraceable),
    ).toThrow(/questionnaire answer/i);
  });

  it("applies the server-owned gap kind to statement validation", () => {
    const value = response();
    value.findings.REQ.gaps.trigger[0]!.statement =
      "It is unclear whether MFA is used for privileged access.";

    expect(() =>
      buildGapModelResponseSchemaV7([policy()]).parse(value),
    ).toThrow(/missing/i);
  });
});

function policy() {
  return {
    requirementCode: "REQ",
    outputLocale: "en" as const,
    status: "not_fulfilled" as const,
    statementBasis: {
      version: "1" as const,
      triggeringQuestions: [
        {
          stableKey: "trigger",
          sourceAssessmentAnswerId: "00000000-0000-4000-8000-000000000001",
          kind: "missing" as const,
        },
      ],
      satisfiedQuestionStableKeys: ["satisfied"],
    },
    permittedCitationIds: ["Q:answer", "LEGAL:req"],
    questionnaireCitationIdsByQuestion: {
      trigger: "Q:answer",
    },
    admittedOrganizationCitationIds: [],
    preferredPrimaryLegalCitationIds: ["LEGAL:req"],
  };
}

function response() {
  return {
    findings: {
      REQ: {
        gaps: {
          trigger: [
            {
              statement: "MFA is missing for privileged access.",
              citations: ["Q:answer", "LEGAL:req"],
            },
          ],
        },
        evidenceSufficiency: "none" as const,
        assumptions: [] as string[],
        citations: ["LEGAL:req"],
        contradictions: [] as string[],
        requiresReview: false,
        legalCitation: "LEGAL:req",
        reviewNotice: null as string | null,
      },
    },
  };
}
