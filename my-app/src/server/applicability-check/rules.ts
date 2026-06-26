export type RuleEvaluationContext = {
  facts: Record<string, unknown>;
  answers?: Record<string, unknown>;
};

export type AffectednessOutcome =
  | "affected"
  | "possibly_affected"
  | "not_affected";

export type RuleEvaluationResult = {
  outcome: AffectednessOutcome;
  label: string;
  labelEn: string | null;
  reasons: string[];
  confidence: number;
  matchedRuleIds: string[];
  ruleSetVersion: number;
  disclaimer: string | null;
};

type RuleSetDocument = {
  version: number;
  defaultOutcome: AffectednessOutcome;
  disclaimer?: string;
  outcomes: Record<string, { label: string; labelEn?: string }>;
  rules: RuleDocument[];
};

type RuleDocument = {
  id: string;
  outcome: AffectednessOutcome;
  priority: number;
  conditions: RuleCondition;
  reasons?: string[];
  confidence?: number;
};

type RuleCondition =
  | { all: RuleCondition[] }
  | { any: RuleCondition[] }
  | { not: RuleCondition }
  | {
      factKey?: string;
      questionStableKey?: string;
      operator: "equals" | "not_equals" | "in" | "not_in" | "exists" | "missing";
      value?: unknown;
      values?: unknown[];
    };

export function evaluateRuleSet(
  ruleSetRules: unknown,
  context: RuleEvaluationContext,
): RuleEvaluationResult {
  const ruleSet = parseRuleSet(ruleSetRules);
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
  condition: Extract<RuleCondition, { operator: string }>,
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

function parseRuleSet(value: unknown): RuleSetDocument {
  if (!isRecord(value)) {
    throw new Error("Rule set must be a JSON object");
  }

  const version = value.version;
  const defaultOutcome = value.defaultOutcome;
  const outcomes = value.outcomes;
  const rules = value.rules;

  if (typeof version !== "number") {
    throw new Error("Rule set version must be a number");
  }

  if (!isOutcome(defaultOutcome)) {
    throw new Error("Rule set defaultOutcome is invalid");
  }

  if (!isRecord(outcomes)) {
    throw new Error("Rule set outcomes must be an object");
  }

  if (!Array.isArray(rules)) {
    throw new Error("Rule set rules must be an array");
  }

  return {
    version,
    defaultOutcome,
    disclaimer:
      typeof value.disclaimer === "string" ? value.disclaimer : undefined,
    outcomes: parseOutcomes(outcomes),
    rules: rules.map(parseRule),
  };
}

function parseOutcomes(
  outcomes: Record<string, unknown>,
): RuleSetDocument["outcomes"] {
  return Object.fromEntries(
    Object.entries(outcomes).map(([outcome, labels]) => {
      if (!isRecord(labels) || typeof labels.label !== "string") {
        throw new Error(`Outcome ${outcome} must define a label`);
      }

      return [
        outcome,
        {
          label: labels.label,
          labelEn:
            typeof labels.labelEn === "string" ? labels.labelEn : undefined,
        },
      ];
    }),
  );
}

function parseRule(value: unknown): RuleDocument {
  if (!isRecord(value)) {
    throw new Error("Rule must be an object");
  }

  if (typeof value.id !== "string" || value.id.trim().length === 0) {
    throw new Error("Rule id is required");
  }

  if (!isOutcome(value.outcome)) {
    throw new Error(`Rule ${value.id} has invalid outcome`);
  }

  if (typeof value.priority !== "number") {
    throw new Error(`Rule ${value.id} priority must be a number`);
  }

  return {
    id: value.id,
    outcome: value.outcome,
    priority: value.priority,
    conditions: parseCondition(value.conditions, value.id),
    reasons: Array.isArray(value.reasons)
      ? value.reasons.filter((reason): reason is string => typeof reason === "string")
      : undefined,
    confidence:
      typeof value.confidence === "number" ? value.confidence : undefined,
  };
}

function parseCondition(value: unknown, ruleId: string): RuleCondition {
  if (!isRecord(value)) {
    throw new Error(`Rule ${ruleId} condition must be an object`);
  }

  if (Array.isArray(value.all)) {
    return { all: value.all.map((child) => parseCondition(child, ruleId)) };
  }

  if (Array.isArray(value.any)) {
    return { any: value.any.map((child) => parseCondition(child, ruleId)) };
  }

  if (value.not !== undefined) {
    return { not: parseCondition(value.not, ruleId) };
  }

  const operator = value.operator;

  if (!isOperator(operator)) {
    throw new Error(`Rule ${ruleId} has invalid condition operator`);
  }

  if (typeof value.factKey !== "string" && typeof value.questionStableKey !== "string") {
    throw new Error(`Rule ${ruleId} condition needs factKey or questionStableKey`);
  }

  return {
    factKey: typeof value.factKey === "string" ? value.factKey : undefined,
    questionStableKey:
      typeof value.questionStableKey === "string"
        ? value.questionStableKey
        : undefined,
    operator,
    value: value.value,
    values: Array.isArray(value.values) ? value.values : undefined,
  };
}

function getOutcomeLabels(
  ruleSet: RuleSetDocument,
  outcome: AffectednessOutcome,
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

function isOutcome(value: unknown): value is AffectednessOutcome {
  return (
    value === "affected" ||
    value === "possibly_affected" ||
    value === "not_affected"
  );
}

function isOperator(
  value: unknown,
): value is Extract<RuleCondition, { operator: string }>["operator"] {
  return (
    value === "equals" ||
    value === "not_equals" ||
    value === "in" ||
    value === "not_in" ||
    value === "exists" ||
    value === "missing"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
