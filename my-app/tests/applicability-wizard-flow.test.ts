import { describe, expect, it } from "vitest";
import type { ApplicabilityQuestionDto } from "@/src/server/applicability-check/service";
import type { ApplicabilityAnswerValue } from "@/src/server/applicability-check/question-visibility";
import {
  getActivityState,
  getWizardProgressQuestions,
  getWizardSize,
  getWizardStepState,
  isSizeDecisive,
  shouldSubmitAfter,
} from "@/components/applicability-check/wizard-flow";

function question(
  stableKey: string,
  options: Array<{ stableValue: string; metadata: unknown }>,
): ApplicabilityQuestionDto {
  return {
    id: stableKey,
    stableKey,
    position: 1,
    questionText: stableKey,
    helpText: null,
    tooltipText: null,
    answerType: "multi_choice",
    required: true,
    config: {},
    options: options.map((option, index) => ({
      id: `${stableKey}:${option.stableValue}`,
      stableValue: option.stableValue,
      catalogCode: "all",
      label: option.stableValue,
      position: index + 1,
      metadata: option.metadata,
    })),
  };
}

const questions: ApplicabilityQuestionDto[] = [
  question("bc.germany_connection", [
    { stableValue: "de_established", metadata: {} },
    { stableValue: "de_telecom_provider", metadata: {} },
    { stableValue: "none", metadata: {} },
  ]),
  question("bc.sector", [
    { stableValue: "energy", metadata: {} },
    { stableValue: "none_of_these", metadata: { exclusive: true } },
  ]),
  question("bc.activity", [
    { stableValue: "energy_supply_networks", metadata: { sectorCode: "energy", route: "A1", kind: "activity" } },
    { stableValue: "digital_dns", metadata: { sectorCode: "digital", route: "E", kind: "activity" } },
    { stableValue: "digital_other_trust", metadata: { sectorCode: "digital", route: "I", kind: "activity" } },
    { stableValue: "digital_telecom", metadata: { sectorCode: "digital", route: "T", kind: "activity" } },
    { stableValue: "digital_domain_registration", metadata: { sectorCode: "digital", route: "R", kind: "activity" } },
    { stableValue: "energy_none", metadata: { sectorCode: "energy", route: "NO", kind: "none", exclusive: true } },
    { stableValue: "energy_unsure", metadata: { sectorCode: "energy", route: "NO", kind: "unsure", exclusive: true } },
  ]),
  question("bc.employee_count", [
    { stableValue: "under_50", metadata: {} },
    { stableValue: "50_249", metadata: {} },
    { stableValue: "250_plus", metadata: {} },
  ]),
  question("bc.annual_revenue", [
    { stableValue: "revenue_at_most_10m", metadata: {} },
    { stableValue: "revenue_over_10m_to_50m", metadata: {} },
    { stableValue: "revenue_over_50m", metadata: {} },
  ]),
  question("bc.balance_sheet_total", [
    { stableValue: "balance_at_most_10m", metadata: {} },
    { stableValue: "balance_over_10m_to_43m", metadata: {} },
    { stableValue: "balance_over_43m", metadata: {} },
  ]),
];

function answers(
  input: Record<string, ApplicabilityAnswerValue>,
): Record<string, ApplicabilityAnswerValue | undefined> {
  const result: Record<string, ApplicabilityAnswerValue | undefined> = {};
  for (const question of questions) {
    if (input[question.stableKey] !== undefined) {
      result[question.id] = input[question.stableKey];
    }
  }
  return result;
}

describe("guided wizard flow", () => {
  it("counts only reached questions when the active answer is terminal", () => {
    const terminalQuestions = [
      questions[0],
      question("bc.special_status", [
        { stableValue: "essential_or_cer", metadata: {} },
      ]),
      questions[1],
    ];
    const terminalAnswers = {
      [terminalQuestions[0].id]: "de_established",
      [terminalQuestions[1].id]: "essential_or_cer",
    };

    expect(
      shouldSubmitAfter(
        terminalQuestions[1].stableKey,
        terminalAnswers,
        terminalQuestions,
      ),
    ).toBe(true);
    expect(
      getWizardProgressQuestions(terminalQuestions, 1, true).map(
        (candidate) => candidate.stableKey,
      ),
    ).toEqual(["bc.germany_connection", "bc.special_status"]);

    expect(getWizardProgressQuestions(terminalQuestions, 1, false)).toHaveLength(3);
  });

  it("marks the active step complete as soon as it is answered", () => {
    const activeQuestion = questions[1];

    expect(
      getWizardStepState(
        activeQuestion,
        activeQuestion.id,
        { [activeQuestion.id]: "energy" },
      ),
    ).toEqual({ active: true, answered: true });
  });

  it("uses evaluator precedence across selected activities", () => {
    const base = {
      "bc.activity": ["digital_other_trust", "digital_telecom"],
    };
    expect(getActivityState(questions, answers(base))).toBe("I");

    expect(
      getActivityState(
        questions,
        answers({
          "bc.activity": ["digital_dns", "digital_telecom"],
        }),
      ),
    ).toBe("E");

    expect(
      getActivityState(
        questions,
        answers({
          "bc.activity": [
            "digital_domain_registration",
            "digital_dns",
          ],
        }),
      ),
    ).toBe("R");
  });

  it("keeps unsure and none selections separate from real activities", () => {
    expect(
      getActivityState(questions, answers({ "bc.activity": ["energy_unsure"] })),
    ).toBe("UNSURE");
    expect(
      getActivityState(questions, answers({ "bc.activity": ["energy_none"] })),
    ).toBe("NO");
  });

  it("returns the telecom route when Q1 selected the telecom provider", () => {
    expect(
      getActivityState(questions, answers({ "bc.germany_connection": "de_telecom_provider" })),
    ).toBe("T");
  });

  it("computes the size matrix exactly like the evaluator", () => {
    expect(
      getWizardSize(
        questions,
        answers({
          "bc.employee_count": "250_plus",
          "bc.annual_revenue": "revenue_at_most_10m",
          "bc.balance_sheet_total": "balance_at_most_10m",
        }),
      ),
    ).toBe("large");
    expect(
      getWizardSize(
        questions,
        answers({
          "bc.employee_count": "under_50",
          "bc.annual_revenue": "revenue_over_10m_to_50m",
          "bc.balance_sheet_total": "balance_over_10m_to_43m",
        }),
      ),
    ).toBe("medium");
    expect(
      getWizardSize(
        questions,
        answers({
          "bc.employee_count": "under_50",
          "bc.annual_revenue": "revenue_over_10m_to_50m",
          "bc.balance_sheet_total": "balance_at_most_10m",
        }),
      ),
    ).toBe("small");
  });

  it("submits after terminal Germany-connection routes", () => {
    expect(
      shouldSubmitAfter(
        "bc.germany_connection",
        answers({ "bc.germany_connection": "none" }),
        questions,
      ),
    ).toBe(true);
    expect(
      shouldSubmitAfter(
        "bc.germany_connection",
        answers({ "bc.germany_connection": "de_established" }),
        questions,
      ),
    ).toBe(false);
  });

  it("continues to size for Annex-1 routes and submits for size-independent routes", () => {
    expect(
      shouldSubmitAfter(
        "bc.activity",
        answers({ "bc.activity": ["energy_supply_networks"] }),
        questions,
      ),
    ).toBe(false);
    expect(
      shouldSubmitAfter(
        "bc.activity",
        answers({ "bc.activity": ["digital_dns"] }),
        questions,
      ),
    ).toBe(true);
    expect(
      shouldSubmitAfter(
        "bc.activity",
        answers({ "bc.activity": ["digital_other_trust"] }),
        questions,
      ),
    ).toBe(true);
  });

  it("applies the Q6 skip table from the plan", () => {
    const sizeInput = {
      "bc.germany_connection": "de_established",
      "bc.activity": ["energy_supply_networks"],
      "bc.employee_count": "250_plus",
      "bc.annual_revenue": "revenue_at_most_10m",
      "bc.balance_sheet_total": "balance_at_most_10m",
    };
    expect(
      shouldSubmitAfter("bc.balance_sheet_total", answers(sizeInput), questions),
    ).toBe(true);
    expect(isSizeDecisive(questions, answers(sizeInput))).toBe(true);

    const mediumInput = {
      ...sizeInput,
      "bc.employee_count": "50_249",
    };
    expect(isSizeDecisive(questions, answers(mediumInput))).toBe(false);

    const telecomInput = {
      "bc.germany_connection": "de_telecom_provider",
      "bc.employee_count": "50_249",
      "bc.annual_revenue": "revenue_at_most_10m",
      "bc.balance_sheet_total": "balance_at_most_10m",
    };
    expect(isSizeDecisive(questions, answers(telecomInput))).toBe(true);
  });
});
