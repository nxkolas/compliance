import { describe, expect, it } from "vitest";
import {
  getVisibleQuestions,
  isAnswered,
} from "@/src/server/applicability-check/question-visibility";

const questions = [
  { id: "eu", stableKey: "bc.eu_activity", config: {} },
  {
    id: "sector",
    stableKey: "bc.entity_types",
    config: {
      visibleWhen: {
        questionStableKey: "bc.eu_activity",
        operator: "equals",
        value: "yes",
      },
    },
  },
  {
    id: "followup",
    stableKey: "bc.followup",
    config: {
      visibleWhen: {
        questionStableKey: "bc.entity_types",
        operator: "contains_any",
        values: ["dns_service_provider"],
      },
    },
  },
];

describe("applicability question visibility", () => {
  it("shows only the entry question before EU activity is confirmed", () => {
    expect(getVisibleQuestions(questions, {}).map((item) => item.id)).toEqual([
      "eu",
    ]);
  });

  it("reveals dependent questions in sequence", () => {
    expect(
      getVisibleQuestions(questions, {
        eu: "yes",
        sector: ["dns_service_provider"],
      }).map((item) => item.id),
    ).toEqual(["eu", "sector", "followup"]);
  });

  it("does not let hidden stale answers drive later visibility", () => {
    expect(
      getVisibleQuestions(questions, {
        eu: "no",
        sector: ["dns_service_provider"],
      }).map((item) => item.id),
    ).toEqual(["eu"]);
  });

  it("treats empty multi-select answers as unanswered", () => {
    expect(isAnswered([])).toBe(false);
    expect(isAnswered(["dns_service_provider"])).toBe(true);
  });
});
