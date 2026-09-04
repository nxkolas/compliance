import { describe, expect, it } from "vitest";
import {
  deriveAtomicGapTriggerPolicy,
  deriveCorrectedAtomicGapTriggerPolicy,
} from "@/src/server/modules/gap-analysis/trigger-policy";

const legalProvision = {
  id: "00000000-0000-4000-8000-000000000010",
  key: "nis2.iam.mfa",
  provisionCode: "Art. 21(2)(j)",
};

describe("atomic Gap trigger policy", () => {
  it("selects only answers that can produce atomic gaps", () => {
    const policy = deriveAtomicGapTriggerPolicy({
      determinedStatus: "partially_fulfilled",
      questions: [
        {
          stableKey: "gap.iam.mfa",
          text: "Is MFA implemented?",
          stableValue: "partially_implemented",
          legalProvisions: [legalProvision],
        },
        {
          stableKey: "gap.iam.access_review",
          text: "Are access rights reviewed?",
          stableValue: "fully_implemented",
          legalProvisions: [legalProvision],
        },
      ],
    });

    expect(policy.triggeringQuestions).toHaveLength(1);
    expect(policy.triggeringQuestions[0]).toMatchObject({
      stableKey: "gap.iam.mfa",
      stableValue: "partially_implemented",
    });
    expect(policy.satisfiedQuestionStableKeys).toEqual([
      "gap.iam.access_review",
    ]);
    expect(policy).not.toHaveProperty("guidanceMode");
    expect(policy.triggeringQuestions[0]).not.toHaveProperty("workKind");
  });

  it("uses a correction reason to identify the effective trigger", () => {
    const policy = deriveCorrectedAtomicGapTriggerPolicy({
      determinedStatus: "insufficient_evidence",
      questions: [
        {
          stableKey: "gap.backup.restore_test",
          text: "Are restore tests documented?",
          stableValue: "fully_implemented",
          legalProvisions: [legalProvision],
        },
      ],
      correctionReason: "The restore test documentation is uncertain.",
    });

    expect(policy.triggeringQuestions).toHaveLength(1);
    expect(policy.triggeringQuestions[0]).toMatchObject({
      stableKey: "gap.backup.restore_test",
      stableValue: "unsure",
    });
  });
});
