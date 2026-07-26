import { describe, expect, it } from "vitest";
import { deriveGapGuidancePolicy } from "@/src/server/gap-analysis/guidance-policy";
import {
  buildGapModelResponseSchemaV6,
  normalizeGroundedGapModelResponseV6,
} from "@/src/server/gap-analysis/generation-schema-v6";

describe("guided-v5 constrained guidance response", () => {
  it("forces evidence sufficiency to none when no organization evidence was admitted", () => {
    const policy = deriveGapGuidancePolicy({
      determinedStatus: "not_fulfilled",
      questions: [
        {
          stableKey: "gap.iam.multi_factor_authentication",
          text: "Is MFA used?",
          stableValue: "not_implemented",
          legalProvisions: [
            {
              id: "provision-mfa",
              key: "eu_nis2.article_21_2_j",
              provisionCode: "21(2)(j)",
            },
          ],
        },
      ],
    });
    const schema = buildGapModelResponseSchemaV6([
      {
        requirementCode: "NIS2-IAM-03",
        outputLocale: "en",
        policy,
        permittedCitationIds: ["LEGAL:mfa"],
        preferredPrimaryLegalCitationIds: ["LEGAL:mfa"],
        admittedOrganizationCitationIds: [],
      },
    ]);

    expect(() =>
      schema.parse({
        findings: {
          "NIS2-IAM-03": {
            evidenceSufficiency: "partial",
            rationale: "MFA is reported as absent.",
            recommendation: "Implement MFA.",
            objective: "Protect privileged access.",
            workPackages: {
              "gap.iam.multi_factor_authentication": {
                deliverables: ["MFA rollout"],
                acceptanceCriteria: {
                  remediated: ["MFA is enabled and tested."],
                },
                suggestedEvidence: ["MFA configuration export"],
              },
            },
            assumptions: [],
            citations: ["LEGAL:mfa"],
            contradictions: [],
            questionnaireDisagreements: [],
            requiresReview: false,
            legalCitation: "LEGAL:mfa",
          },
        },
      }),
    ).toThrow();
  });

  it("rejects work for a satisfied question", () => {
    const policy = deriveGapGuidancePolicy({
      determinedStatus: "partially_fulfilled",
      questions: [
        question("trigger", "partially_implemented", "trigger-law"),
        question("satisfied", "fully_implemented", "satisfied-law"),
      ],
    });
    const schema = schemaFor(policy, ["LEGAL:trigger"]);
    const value = remediationResponse({
      trigger: remediationPackage(),
      satisfied: remediationPackage(),
    });

    expect(() => schema.parse(value)).toThrow();
  });

  it("requires both verification completion paths", () => {
    const policy = deriveGapGuidancePolicy({
      determinedStatus: "insufficient_evidence",
      questions: [question("unknown", "unsure", "unknown-law")],
    });
    const schema = schemaFor(policy, ["LEGAL:unknown"]);
    const value = {
      findings: {
        REQ: {
          ...commonFinding("LEGAL:unknown"),
          objective: "Determine the actual control state.",
          workPackages: {
            unknown: {
              deliverables: ["Assign an owner and inspect the control."],
              acceptanceCriteria: {
                confirmedImplemented: [
                  "Implementation is confirmed by evidence.",
                ],
              },
              suggestedEvidence: ["Configuration export"],
            },
          },
        },
      },
    };

    expect(() => schema.parse(value)).toThrow();
  });

  it("requires admitted organization evidence to be cited for higher sufficiency", () => {
    const policy = deriveGapGuidancePolicy({
      determinedStatus: "not_fulfilled",
      questions: [question("trigger", "not_implemented", "trigger-law")],
    });
    const schema = buildGapModelResponseSchemaV6([
      {
        requirementCode: "REQ",
        outputLocale: "en",
        policy,
        permittedCitationIds: ["LEGAL:trigger", "DOC:relevant"],
        preferredPrimaryLegalCitationIds: ["LEGAL:trigger"],
        admittedOrganizationCitationIds: ["DOC:relevant"],
      },
    ]);
    const value = remediationResponse({ trigger: remediationPackage() });
    value.findings.REQ.evidenceSufficiency = "partial";

    expect(() => schema.parse(value)).toThrow();
  });

  it("retains resolved contradiction diagnostics without reopening review", () => {
    const policy = deriveGapGuidancePolicy({
      determinedStatus: "not_fulfilled",
      questions: [
        question("trigger", "not_implemented", "trigger-law"),
      ],
    });
    const responsePolicy = {
      requirementCode: "REQ",
      outputLocale: "en" as const,
      policy,
      permittedCitationIds: ["LEGAL:trigger", "DOC:relevant"],
      preferredPrimaryLegalCitationIds: ["LEGAL:trigger"],
      admittedOrganizationCitationIds: ["DOC:relevant"],
      forcedEvidenceSufficiency: "sufficient" as const,
      forcedRequiresReview: false,
    };
    const value = remediationResponse({
      trigger: remediationPackage(),
    });
    value.findings.REQ.evidenceSufficiency = "sufficient";
    value.findings.REQ.citations.push("DOC:relevant");
    value.findings.REQ.contradictions.push(
      "The questionnaire conflicts with the accepted document.",
    );

    expect(
      buildGapModelResponseSchemaV6([responsePolicy]).parse(value)
        .findings.REQ.requiresReview,
    ).toBe(false);
  });

  it("rejects an unresolved contradiction without review", () => {
    const policy = deriveGapGuidancePolicy({
      determinedStatus: "not_fulfilled",
      questions: [
        question("trigger", "not_implemented", "trigger-law"),
      ],
    });
    const schema = schemaFor(policy, ["LEGAL:trigger"]);
    const value = remediationResponse({
      trigger: remediationPackage(),
    });
    value.findings.REQ.contradictions.push(
      "The supplied sources disagree.",
    );

    expect(() => schema.parse(value)).toThrow(
      "Contradictory evidence must require review",
    );
  });

  it("omits action guidance from fulfilled findings", () => {
    const policy = deriveGapGuidancePolicy({
      determinedStatus: "fulfilled",
      questions: [question("satisfied", "fully_implemented", "law")],
    });
    const schema = schemaFor(policy, ["LEGAL:law"]);

    expect(() =>
      schema.parse({
        findings: {
          REQ: {
            ...commonFinding("LEGAL:law"),
            objective: "Invented action",
            workPackages: {},
          },
        },
      }),
    ).toThrow();
  });

  it.each([
    {
      locale: "en" as const,
      expected:
        "The questionnaire responses report this requirement as implemented. The following recommendation supports maintenance and evidence readiness for independent verification; it does not find that the control is missing: Create and maintain supporting records.",
    },
    {
      locale: "de" as const,
      expected:
        "Die Fragebogenantworten weisen diese Anforderung als umgesetzt aus. Die folgende Empfehlung dient der Aufrechterhaltung und Nachweisbereitschaft f\u00fcr eine unabh\u00e4ngige Pr\u00fcfung; sie stellt nicht fest, dass die Kontrolle fehlt: Nachweise erstellen und pflegen.",
    },
  ])(
    "frames fulfilled $locale guidance as maintenance rather than remediation",
    ({ locale, expected }) => {
      const policy = deriveGapGuidancePolicy({
        determinedStatus: "fulfilled",
        questions: [
          question("satisfied", "fully_implemented", "law"),
        ],
      });
      const modelRecommendation =
        locale === "de"
          ? "Nachweise erstellen und pflegen."
          : "Create and maintain supporting records.";
      const [finding] = normalizeGroundedGapModelResponseV6({
        value: {
          findings: {
            REQ: {
              ...commonFinding("LEGAL:law"),
              recommendation: modelRecommendation,
            },
          },
        },
        policies: [
          {
            requirementCode: "REQ",
            outputLocale: locale,
            policy,
            permittedCitationIds: ["LEGAL:law"],
            preferredPrimaryLegalCitationIds: ["LEGAL:law"],
            admittedOrganizationCitationIds: [],
          },
        ],
      });

      expect(finding?.recommendation).toBe(expected);
    },
  );

  it.each([
    {
      locale: "en" as const,
      expected:
        "Assign an accountable owner, verify the current implementation state, and collect evidence for: unknown",
    },
    {
      locale: "de" as const,
      expected:
        "Eine verantwortliche Person benennen, den aktuellen Umsetzungsstand prüfen und Nachweise sammeln für: unknown",
    },
  ])(
    "prepends the localized verification kickoff in $locale",
    ({ locale, expected }) => {
      const policy = deriveGapGuidancePolicy({
        determinedStatus: "insufficient_evidence",
        questions: [
          question("unknown", "unsure", "unknown-law"),
        ],
      });
      const responsePolicy = {
        requirementCode: "REQ",
        outputLocale: locale,
        policy,
        permittedCitationIds: ["LEGAL:unknown"],
        preferredPrimaryLegalCitationIds: ["LEGAL:unknown"],
        admittedOrganizationCitationIds: [],
      };
      const value = {
        findings: {
          REQ: {
            ...commonFinding("LEGAL:unknown"),
            objective: "Determine the actual control state.",
            workPackages: {
              unknown: {
                deliverables: ["Review the current record."],
                acceptanceCriteria: {
                  confirmedImplemented: [
                    "Evidence confirms implementation.",
                  ],
                  confirmedDeficient: [
                    "A deficiency is remediated and evidenced.",
                  ],
                },
                suggestedEvidence: ["Configuration export"],
              },
            },
          },
        },
      };

      const [finding] = normalizeGroundedGapModelResponseV6({
        value,
        policies: [responsePolicy],
      });

      expect(finding?.deliverables[0]?.text).toBe(expected);
      expect(finding?.deliverables[0]).toMatchObject({
        questionStableKey: "unknown",
        workKind: "verify",
      });
      expect(finding?.deliverables[1]?.text).toBe(
        "Review the current record.",
      );
    },
  );
});

function schemaFor(
  policy: ReturnType<typeof deriveGapGuidancePolicy>,
  citations: string[],
) {
  return buildGapModelResponseSchemaV6([
    {
      requirementCode: "REQ",
      outputLocale: "en",
      policy,
      permittedCitationIds: citations,
      preferredPrimaryLegalCitationIds: citations,
      admittedOrganizationCitationIds: [],
    },
  ]);
}

function question(
  stableKey: string,
  stableValue:
    | "fully_implemented"
    | "partially_implemented"
    | "not_implemented"
    | "unsure",
  provisionId: string,
) {
  return {
    stableKey,
    stableValue,
    text: stableKey,
    legalProvisions: [
      {
        id: provisionId,
        key: `legal.${provisionId}`,
        provisionCode: provisionId,
      },
    ],
  };
}

function commonFinding(legalCitation: string) {
  return {
    evidenceSufficiency: "none" as
      | "none"
      | "partial"
      | "sufficient",
    rationale: "Rationale",
    recommendation: "Recommendation",
    assumptions: [] as string[],
    citations: [legalCitation],
    contradictions: [] as string[],
    questionnaireDisagreements: [] as string[],
    requiresReview: false,
    legalCitation,
  };
}

function remediationPackage() {
  return {
    deliverables: ["Deliverable"],
    acceptanceCriteria: { remediated: ["Criterion"] },
    suggestedEvidence: ["Evidence"],
  };
}

function remediationResponse(
  workPackages: Record<
    string,
    ReturnType<typeof remediationPackage>
  >,
) {
  return {
    findings: {
      REQ: {
        ...commonFinding("LEGAL:trigger"),
        objective: "Objective",
        workPackages,
      },
    },
  };
}
