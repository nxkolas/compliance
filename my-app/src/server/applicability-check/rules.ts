import {
  parseRuleSetDocument,
  type FieldRuleCondition,
  type RuleCondition,
  type RuleOutcome,
  type RuleSetDocument,
} from "./rule-set-schema";

export type RuleEvaluationContext = {
  facts: Record<string, unknown>;
  answers?: Record<string, unknown>;
};

export type RuleEvaluationResult = {
  outcome: RuleOutcome;
  label: string;
  labelEn: string | null;
  reasons: string[];
  confidence: number;
  matchedRuleIds: string[];
  ruleSetVersion: number;
  disclaimer: string | null;
};

export function evaluateRuleSet(
  ruleSetRules: unknown,
  context: RuleEvaluationContext,
): RuleEvaluationResult {
  const ruleSet = parseRuleSetDocument(ruleSetRules);
  const orderedRules = [...ruleSet.rules].sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    return left.id.localeCompare(right.id);
  });
  const matchedRule = orderedRules.find((rule) =>
    evaluateCondition(rule.conditions, context),
  );
  const outcome = matchedRule?.outcome ?? ruleSet.defaultOutcome;
  const outcomeLabels = getOutcomeLabels(ruleSet, outcome);

  return {
    outcome,
    label: outcomeLabels.label,
    labelEn: outcomeLabels.labelEn ?? null,
    reasons:
      matchedRule?.reasons?.filter((reason) => reason.trim().length > 0) ??
      ["Keine spezifische Regel hat gegriffen; es wird der konservative Standardwert verwendet."],
    confidence: clampConfidence(matchedRule?.confidence ?? 0.5),
    matchedRuleIds: matchedRule ? [matchedRule.id] : [],
    ruleSetVersion: ruleSet.version,
    disclaimer: ruleSet.disclaimer ?? null,
  };
}

function evaluateCondition(
  condition: RuleCondition,
  context: RuleEvaluationContext,
): boolean {
  if ("all" in condition) {
    return condition.all.every((child) => evaluateCondition(child, context));
  }

  if ("any" in condition) {
    return condition.any.some((child) => evaluateCondition(child, context));
  }

  if ("not" in condition) {
    return !evaluateCondition(condition.not, context);
  }

  const value = getConditionValue(condition, context);

  if (condition.operator === "exists") {
    return value !== undefined && value !== null && value !== "";
  }

  if (condition.operator === "missing") {
    return value === undefined || value === null || value === "";
  }

  if (condition.operator === "equals") {
    return sameJsonValue(value, condition.value);
  }

  if (condition.operator === "not_equals") {
    return !sameJsonValue(value, condition.value);
  }

  const values = condition.values ?? [];

  if (condition.operator === "in") {
    return values.some((expected) => sameJsonValue(value, expected));
  }

  if (condition.operator === "not_in") {
    return !values.some((expected) => sameJsonValue(value, expected));
  }

  return false;
}

function getConditionValue(
  condition: FieldRuleCondition,
  context: RuleEvaluationContext,
) {
  if (condition.factKey) {
    return context.facts[condition.factKey];
  }

  if (condition.questionStableKey) {
    return context.answers?.[condition.questionStableKey];
  }

  return undefined;
}

function getOutcomeLabels(
  ruleSet: RuleSetDocument,
  outcome: RuleOutcome,
) {
  const labels = ruleSet.outcomes[outcome];

  if (!labels) {
    throw new Error(`Rule set does not define labels for ${outcome}`);
  }

  return labels;
}

function sameJsonValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) {
    return 0.5;
  }

  return Math.min(1, Math.max(0, value));
}
