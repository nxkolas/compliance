import { describe, expect, it } from "vitest";
import { evaluateRuleSet } from "@/src/server/applicability-check/rules";

const ruleSet = {
  version: 1,
  defaultOutcome: "possibly_affected",
  disclaimer: "Test disclaimer",
  outcomes: {
    affected: { label: "Betroffen", labelEn: "Affected" },
    possibly_affected: {
      label: "Moeglicherweise betroffen",
      labelEn: "Possibly affected",
    },
    not_affected: { label: "Nicht betroffen", labelEn: "Not affected" },
  },
  rules: [
    {
      id: "affected_high_priority",
      outcome: "affected",
      priority: 100,
      conditions: {
        all: [
          { factKey: "sector", operator: "equals", value: "covered" },
          { factKey: "size", operator: "in", values: ["medium", "large"] },
        ],
      },
      reasons: ["Covered sector and size."],
      confidence: 0.9,
    },
    {
      id: "not_affected_low_priority",
      outcome: "not_affected",
      priority: 50,
      conditions: {
        all: [
          { factKey: "sector", operator: "equals", value: "covered" },
        ],
      },
      reasons: ["Lower priority rule."],
      confidence: 0.7,
    },
    {
      id: "uncertain",
      outcome: "possibly_affected",
      priority: 80,
      conditions: {
        any: [
          { factKey: "sector", operator: "equals", value: "unsure" },
          { questionStableKey: "bc.size", operator: "equals", value: "unsure" },
        ],
      },
      reasons: ["Uncertain answer."],
      confidence: 0.6,
    },
    {
      id: "not_affected",
      outcome: "not_affected",
      priority: 70,
      conditions: {
        all: [
          { factKey: "sector", operator: "equals", value: "other" },
          { factKey: "size", operator: "equals", value: "small" },
        ],
      },
      reasons: ["No relevant signal."],
      confidence: 0.8,
    },
  ],
};

describe("DB-driven applicability rule evaluator", () => {
  it("returns affected when the DB-shaped rule conditions match", () => {
    const result = evaluateRuleSet(ruleSet, {
      facts: { sector: "covered", size: "medium" },
    });

    expect(result.outcome).toBe("affected");
    expect(result.matchedRuleIds).toEqual(["affected_high_priority"]);
    expect(result.confidence).toBe(0.9);
  });

  it("returns not affected when the not affected rule matches", () => {
    const result = evaluateRuleSet(ruleSet, {
      facts: { sector: "other", size: "small" },
    });

    expect(result.outcome).toBe("not_affected");
    expect(result.reasons).toEqual(["No relevant signal."]);
  });

  it("returns possibly affected for uncertain fact answers", () => {
    const result = evaluateRuleSet(ruleSet, {
      facts: { sector: "unsure", size: "small" },
    });

    expect(result.outcome).toBe("possibly_affected");
    expect(result.matchedRuleIds).toEqual(["uncertain"]);
  });

  it("can evaluate questionStableKey conditions from answer context", () => {
    const result = evaluateRuleSet(ruleSet, {
      facts: { sector: "other", size: "small" },
      answers: { "bc.size": "unsure" },
    });

    expect(result.outcome).toBe("possibly_affected");
  });

  it("uses priority ordering when more than one rule matches", () => {
    const result = evaluateRuleSet(ruleSet, {
      facts: { sector: "covered", size: "large" },
    });

    expect(result.matchedRuleIds).toEqual(["affected_high_priority"]);
  });

  it("uses the conservative default when no rule matches", () => {
    const result = evaluateRuleSet(ruleSet, {
      facts: { sector: "other", size: "large" },
    });

    expect(result.outcome).toBe("possibly_affected");
    expect(result.matchedRuleIds).toEqual([]);
  });

  it("accepts module-specific outcomes defined by the rule set", () => {
    const result = evaluateRuleSet(
      {
        version: 1,
        defaultOutcome: "manual_review",
        outcomes: {
          compliant: { label: "Compliant" },
          manual_review: { label: "Manual review" },
        },
        rules: [
          {
            id: "complete_controls",
            outcome: "compliant",
            priority: 10,
            conditions: {
              factKey: "controls_complete",
              operator: "equals",
              value: true,
            },
          },
        ],
      },
      {
        facts: { controls_complete: true },
      },
    );

    expect(result.outcome).toBe("compliant");
    expect(result.label).toBe("Compliant");
  });

  it("rejects rule outcomes that are not defined by the rule set", () => {
    expect(() =>
      evaluateRuleSet(
        {
          version: 1,
          defaultOutcome: "manual_review",
          outcomes: {
            manual_review: { label: "Manual review" },
          },
          rules: [
            {
              id: "complete_controls",
              outcome: "compliant",
              priority: 10,
              conditions: {
                factKey: "controls_complete",
                operator: "equals",
                value: true,
              },
            },
          ],
        },
        {
          facts: { controls_complete: true },
        },
      ),
    ).toThrow("rules.0.outcome");
  });
});
