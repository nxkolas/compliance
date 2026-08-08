import { describe, expect, it } from "vitest";
import {
  getVisibleOptions,
  getVisibleQuestions,
  type ApplicabilityAnswerValue,
} from "@/src/server/applicability-check/question-visibility";

type FixtureQuestion = {
  id: string;
  stableKey: string;
  position: number;
  config: Record<string, unknown>;
  options: Array<{ stableValue: string; metadata: unknown }>;
};

const questions: FixtureQuestion[] = [
  {
    id: "q1",
    stableKey: "bc.germany_connection",
    position: 1,
    config: {},
    options: [
      { stableValue: "de_established", metadata: {} },
      { stableValue: "de_cross_border_digital_provider", metadata: {} },
      { stableValue: "de_telecom_provider", metadata: {} },
    ],
  },
  {
    id: "q2",
    stableKey: "bc.sector",
    position: 2,
    config: {
      visibleWhen: {
        questionStableKey: "bc.germany_connection",
        operator: "equals",
        value: "de_established",
      },
    },
    options: [
      { stableValue: "energy", metadata: {} },
      { stableValue: "digital", metadata: {} },
    ],
  },
  {
    id: "q3",
    stableKey: "bc.activity",
    position: 3,
    config: {
      visibleWhen: {
        any: [
          {
            questionStableKey: "bc.germany_connection",
            operator: "equals",
            value: "de_cross_border_digital_provider",
          },
          {
            all: [
              {
                questionStableKey: "bc.germany_connection",
                operator: "equals",
                value: "de_established",
              },
              {
                questionStableKey: "bc.sector",
                operator: "contains_any",
                values: ["energy", "digital"],
              },
            ],
          },
        ],
      },
      optionVisibility: {
        questionStableKey: "bc.sector",
        attribute: "sectorCode",
        fallbackValues: ["digital"],
      },
    },
    options: [
      { stableValue: "energy_supply_networks", metadata: { sectorCode: "energy", route: "A1" } },
      { stableValue: "digital_dns", metadata: { sectorCode: "digital", route: "E" } },
      { stableValue: "digital_telecom", metadata: { sectorCode: "digital", route: "T" } },
    ],
  },
  {
    id: "q4",
    stableKey: "bc.employee_count",
    position: 4,
    config: {
      visibleWhen: {
        any: [
          {
            all: [
              {
                questionStableKey: "bc.germany_connection",
                operator: "equals",
                value: "de_telecom_provider",
              },
            ],
          },
          {
            all: [
              {
                questionStableKey: "bc.germany_connection",
                operator: "in",
                values: ["de_established", "de_cross_border_digital_provider"],
              },
              {
                questionStableKey: "bc.activity",
                operator: "route_in",
                values: ["T", "A1", "A2"],
              },
            ],
          },
        ],
      },
    },
    options: [{ stableValue: "under_50", metadata: {} }],
  },
];

function answers(input: Record<string, ApplicabilityAnswerValue>) {
  const result: Record<string, ApplicabilityAnswerValue | undefined> = {};
  for (const question of questions) {
    if (input[question.stableKey] !== undefined) {
      result[question.id] = input[question.stableKey];
    }
  }
  return result;
}

function visibleStableKeys(input: Record<string, ApplicabilityAnswerValue>) {
  return getVisibleQuestions(questions, answers(input)).map(
    (question) => question.stableKey,
  );
}

describe("wizard question visibility", () => {
  it("starts with the Germany-connection question only", () => {
    expect(visibleStableKeys({})).toEqual(["bc.germany_connection"]);
  });

  it("shows the sector question only for the establishment route", () => {
    expect(
      visibleStableKeys({ "bc.germany_connection": "de_established" }),
    ).toEqual(["bc.germany_connection", "bc.sector"]);
    expect(
      visibleStableKeys({
        "bc.germany_connection": "de_cross_border_digital_provider",
      }),
    ).toEqual(["bc.germany_connection", "bc.activity"]);
  });

  it("shows the activity question when a sector is selected or via the cross-border route", () => {
    expect(
      visibleStableKeys({
        "bc.germany_connection": "de_established",
        "bc.sector": ["energy"],
      }),
    ).toEqual(["bc.germany_connection", "bc.sector", "bc.activity"]);
    expect(
      visibleStableKeys({
        "bc.germany_connection": "de_established",
        "bc.sector": ["digital"],
      }),
    ).toEqual(["bc.germany_connection", "bc.sector", "bc.activity"]);
  });

  it("filters activity options to the selected sectors", () => {
    const activity = questions.find(
      (question) => question.stableKey === "bc.activity",
    );
    if (!activity) throw new Error("Activity fixture missing");

    const energy = getVisibleOptions(
      questions,
      activity,
      answers({
        "bc.germany_connection": "de_established",
        "bc.sector": ["energy"],
      }),
    );
    expect(energy?.map((option) => option.stableValue)).toEqual([
      "energy_supply_networks",
    ]);

    const digital = getVisibleOptions(
      questions,
      activity,
      answers({
        "bc.germany_connection": "de_cross_border_digital_provider",
      }),
    );
    expect(digital?.map((option) => option.stableValue)).toEqual([
      "digital_dns",
      "digital_telecom",
    ]);
  });

  it("shows the size question only for size-dependent routes", () => {
    expect(
      visibleStableKeys({
        "bc.germany_connection": "de_established",
        "bc.sector": ["energy"],
        "bc.activity": ["energy_supply_networks"],
      }),
    ).toEqual([
      "bc.germany_connection",
      "bc.sector",
      "bc.activity",
      "bc.employee_count",
    ]);
    expect(
      visibleStableKeys({
        "bc.germany_connection": "de_established",
        "bc.sector": ["digital"],
        "bc.activity": ["digital_dns"],
      }),
    ).toEqual([
      "bc.germany_connection",
      "bc.sector",
      "bc.activity",
    ]);
  });

  it("shows the size question directly for the telecom route", () => {
    expect(
      visibleStableKeys({ "bc.germany_connection": "de_telecom_provider" }),
    ).toEqual(["bc.germany_connection", "bc.employee_count"]);
  });
});
