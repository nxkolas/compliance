export type ApplicabilityAnswerValue = string | string[];

export type VisibilityQuestion = {
  id: string;
  stableKey: string;
  config: unknown;
};

type VisibilityCondition = {
  questionStableKey: string;
  operator: "equals" | "in" | "contains_any";
  value?: string;
  values?: string[];
};

export function getVisibleQuestions<T extends VisibilityQuestion>(
  questions: T[],
  answersByQuestionId: Record<string, ApplicabilityAnswerValue | undefined>,
): T[] {
  const acceptedAnswers: Record<string, ApplicabilityAnswerValue> = {};
  const visibleQuestions: T[] = [];

  for (const question of questions) {
    const condition = getVisibilityCondition(question.config);
    const visible = !condition || evaluateVisibility(condition, acceptedAnswers);

    if (!visible) {
      continue;
    }

    visibleQuestions.push(question);
    const answer = answersByQuestionId[question.id];
    if (isAnswered(answer)) {
      acceptedAnswers[question.stableKey] = answer;
    }
  }

  return visibleQuestions;
}

export function isAnswered(
  value: ApplicabilityAnswerValue | undefined,
): value is ApplicabilityAnswerValue {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

export function getQuestionControl(config: unknown): string | undefined {
  if (!isRecord(config) || !isRecord(config.ui)) {
    return undefined;
  }

  return typeof config.ui.control === "string"
    ? config.ui.control
    : undefined;
}

export function getVisibilityCondition(config: unknown): VisibilityCondition | null {
  if (!isRecord(config) || !isRecord(config.visibleWhen)) {
    return null;
  }

  const condition = config.visibleWhen;
  if (
    typeof condition.questionStableKey !== "string" ||
    !["equals", "in", "contains_any"].includes(String(condition.operator))
  ) {
    return null;
  }

  return {
    questionStableKey: condition.questionStableKey,
    operator: condition.operator as VisibilityCondition["operator"],
    value: typeof condition.value === "string" ? condition.value : undefined,
    values: Array.isArray(condition.values)
      ? condition.values.filter((item): item is string => typeof item === "string")
      : undefined,
  };
}

function evaluateVisibility(
  condition: VisibilityCondition,
  answers: Record<string, ApplicabilityAnswerValue>,
): boolean {
  const answer = answers[condition.questionStableKey];

  if (condition.operator === "equals") {
    return typeof answer === "string" && answer === condition.value;
  }

  const expected = condition.values ?? [];
  if (condition.operator === "in") {
    return typeof answer === "string" && expected.includes(answer);
  }

  return Array.isArray(answer) && answer.some((value) => expected.includes(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
