import { describe, expect, it } from "vitest";
import {
  deriveCorrectedGapGuidancePolicy,
  deriveGapGuidancePolicy,
} from "@/src/server/gap-analysis/guidance-policy";
import {
  buildGapGuidanceQueryV6,
  buildGapRetrievalQueryV6,
} from "@/src/server/gap-analysis/prompt-contract-v6";

describe("guided-v5 Gap guidance policy", () => {
  it("keeps a fully implemented requirement in maintain-and-document mode", () => {
    const policy = deriveGapGuidancePolicy({
      determinedStatus: "fulfilled",
      questions: [
        {
          stableKey: "gap.iam.least_privilege",
          text: "Are access rights limited?",
          stableValue: "fully_implemented",
          legalProvisions: [
            {
              id: "provision-iam",
              key: "eu_nis2.article_21_2_i",
              provisionCode: "21(2)(i)",
            },
          ],
        },
      ],
    });

    expect(policy).toMatchObject({
      version: 1,
      guidanceMode: "maintain_and_document",
      triggeringQuestions: [],
      satisfiedQuestionStableKeys: ["gap.iam.least_privilege"],
      preferredLegalProvisionIds: ["provision-iam"],
      preferredLegalProvisionKeys: ["eu_nis2.article_21_2_i"],
    });
    expect(policy.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    {
      status: "partially_fulfilled" as const,
      value: "partially_implemented" as const,
      mode: "control_remediation",
      workKind: "remediate",
    },
    {
      status: "not_fulfilled" as const,
      value: "not_implemented" as const,
      mode: "control_remediation",
      workKind: "remediate",
    },
    {
      status: "insufficient_evidence" as const,
      value: "unsure" as const,
      mode: "evidence_verification",
      workKind: "verify",
    },
  ])(
    "derives $workKind work only for the $value trigger",
    ({ status, value, mode, workKind }) => {
      const policy = deriveGapGuidancePolicy({
        determinedStatus: status,
        questions: [
          question("satisfied", "fully_implemented", "provision-satisfied"),
          question("trigger", value, "provision-trigger"),
          question("not-applicable", "not_applicable", "provision-na"),
        ],
      });

      expect(policy.guidanceMode).toBe(mode);
      expect(policy.triggeringQuestions).toEqual([
        expect.objectContaining({ stableKey: "trigger", workKind }),
      ]);
      expect(policy.preferredLegalProvisionIds).toEqual([
        "provision-trigger",
      ]);
      expect(policy.satisfiedQuestionStableKeys).toEqual(["satisfied"]);
    },
  );

  it("keeps remediation and uncertainty as distinct work packages", () => {
    const policy = deriveGapGuidancePolicy({
      determinedStatus: "not_fulfilled",
      questions: [
        question("missing", "not_implemented", "provision-missing"),
        question("unknown", "unsure", "provision-unknown"),
      ],
    });

    expect(
      policy.triggeringQuestions.map(({ stableKey, workKind }) => ({
        stableKey,
        workKind,
      })),
    ).toEqual([
      { stableKey: "missing", workKind: "remediate" },
      { stableKey: "unknown", workKind: "verify" },
    ]);
  });

  it("treats an all-not-applicable category as verification work", () => {
    const policy = deriveGapGuidancePolicy({
      determinedStatus: "insufficient_evidence",
      questions: [
        question("first", "not_applicable", "provision-first"),
        question("second", "not_applicable", "provision-second"),
      ],
    });

    expect(policy.triggeringQuestions).toEqual([
      expect.objectContaining({ stableKey: "first", workKind: "verify" }),
      expect.objectContaining({ stableKey: "second", workKind: "verify" }),
    ]);
  });

  it("hashes ordered language-neutral policy facts deterministically", () => {
    const first = deriveGapGuidancePolicy({
      determinedStatus: "not_fulfilled",
      questions: [
        question("first", "not_implemented", "provision-first", "English"),
        question("second", "not_implemented", "provision-second", "English"),
      ],
    });
    const translated = deriveGapGuidancePolicy({
      determinedStatus: "not_fulfilled",
      questions: [
        question("first", "not_implemented", "provision-first", "Deutsch"),
        question("second", "not_implemented", "provision-second", "Deutsch"),
      ],
    });
    const reordered = deriveGapGuidancePolicy({
      determinedStatus: "not_fulfilled",
      questions: [
        question("second", "not_implemented", "provision-second", "English"),
        question("first", "not_implemented", "provision-first", "English"),
      ],
    });

    expect(first.hash).toBe(translated.hash);
    expect(reordered.hash).not.toBe(first.hash);
  });

  it("maps a status correction to one exact question and audits the override", () => {
    const policy = deriveCorrectedGapGuidancePolicy({
      determinedStatus: "not_fulfilled",
      correctionReason:
        "The restore test record contradicts the questionnaire answer.",
      questions: [
        question(
          "gap.continuity.backup_schedule",
          "fully_implemented",
          "provision-backup",
          "Are backups scheduled?",
        ),
        question(
          "gap.continuity.restore_tests",
          "fully_implemented",
          "provision-restore",
          "Are restoration tests performed?",
        ),
      ],
    });

    expect(policy.triggeringQuestions).toEqual([
      expect.objectContaining({
        stableKey: "gap.continuity.restore_tests",
        stableValue: "not_implemented",
        workKind: "remediate",
      }),
    ]);
    expect(policy.preferredLegalProvisionIds).toEqual([
      "provision-restore",
    ]);
    expect(policy.basis.humanCorrection).toMatchObject({
      selectedQuestionStableKey: "gap.continuity.restore_tests",
      originalAnswerValue: "fully_implemented",
      correctedAnswerValue: "not_implemented",
    });
    expect(policy.basis.humanCorrection?.reasonHash).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });

  it("rejects a status correction reason that identifies no exact question", () => {
    expect(() =>
      deriveCorrectedGapGuidancePolicy({
        determinedStatus: "not_fulfilled",
        correctionReason: "This must be changed.",
        questions: [
          question(
            "gap.continuity.restore_tests",
            "fully_implemented",
            "provision-restore",
          ),
        ],
      }),
    ).toThrow("identify an affected requirement question");
  });

  it("renders an explicit content boundary around only triggering questions", () => {
    const policy = deriveGapGuidancePolicy({
      determinedStatus: "partially_fulfilled",
      questions: [
        question(
          "gap.governance.security_owner",
          "fully_implemented",
          "owner-law",
          "Is security responsibility assigned?",
        ),
        question(
          "gap.governance.management_oversight",
          "partially_implemented",
          "oversight-law",
          "Does management approve and oversee security measures?",
        ),
      ],
    });

    const query = JSON.parse(
      buildGapGuidanceQueryV6({
        requirement: {
          code: "NIS2-GOV-01",
          title: "Governance",
          requirementText: "Responsibility and oversight",
        },
        policy,
      }),
    );

    expect(query.serverOwnedPolicy.contentScope).toEqual({
      actionGuidanceMayAddressOnly: [
        {
          stableKey: "gap.governance.management_oversight",
          text: "Does management approve and oversee security measures?",
        },
      ],
      excludedSatisfiedQuestionStableKeys: [
        "gap.governance.security_owner",
      ],
      instruction: expect.stringContaining(
        "Do not request, restate, or imply work",
      ),
    });
    expect(query.serverOwnedPolicy.verificationSequence).toBeNull();
  });

  it("retrieves fulfilled evidence with every control-specific question", () => {
    const policy = deriveGapGuidancePolicy({
      determinedStatus: "fulfilled",
      questions: [
        question(
          "gap.continuity.regular_backups",
          "fully_implemented",
          "backup-law",
          "Are important systems backed up regularly?",
        ),
        question(
          "gap.continuity.restore_tests",
          "fully_implemented",
          "restore-law",
          "Are backup restorations tested regularly?",
        ),
      ],
    });

    const retrievalQuery = buildGapRetrievalQueryV6({
      requirement: {
        title: "Business continuity",
        requirementText: "Maintain resilient operations.",
      },
      policy,
    });

    expect(retrievalQuery).toContain(
      "Are important systems backed up regularly?",
    );
    expect(retrievalQuery).toContain(
      "Are backup restorations tested regularly?",
    );
    expect(retrievalQuery).not.toContain(
      "Maintain resilient operations.",
    );
  });

  it("renders verification-first conditional instructions for uncertainty", () => {
    const policy = deriveGapGuidancePolicy({
      determinedStatus: "insufficient_evidence",
      questions: [
        question(
          "gap.risk.analysis_updates",
          "unsure",
          "risk-law",
          "Is the risk analysis updated after changes?",
        ),
      ],
    });

    const query = JSON.parse(
      buildGapGuidanceQueryV6({
        requirement: {
          code: "NIS2-RISK-02",
          title: "Risk analysis",
          requirementText: "Keep risk analysis current",
        },
        policy,
      }),
    );

    expect(
      query.serverOwnedPolicy.verificationSequence.instruction,
    ).toContain(
      "assign an accountable owner, verify the current implementation state, and collect evidence",
    );
    expect(
      query.serverOwnedPolicy.verificationSequence.instruction,
    ).toContain("only as a conditional next step");
  });
});

function question(
  stableKey: string,
  stableValue:
    | "fully_implemented"
    | "partially_implemented"
    | "not_implemented"
    | "unsure"
    | "not_applicable",
  legalProvisionId: string,
  text = stableKey,
) {
  return {
    stableKey,
    text,
    stableValue,
    legalProvisions: [
      {
        id: legalProvisionId,
        key: `legal.${legalProvisionId}`,
        provisionCode: legalProvisionId,
      },
    ],
  };
}
