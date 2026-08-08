export type ApplicabilityAnswerValue = string | string[];

export type VisibilityQuestion = {
  id: string;
  stableKey: string;
  config: unknown;
  options?: Array<{ stableValue: string; metadata: unknown }>;
};

type VisibilityCondition = {
  questionStableKey: string;
  operator: "equals" | "in" | "contains_any" | "route_in";
  value?: string;
  values?: string[];
};

export type { VisibilityCondition };

type VisibilityNode =
  | VisibilityCondition
  | { all: VisibilityNode[] }
  | { any: VisibilityNode[] };

export function collectVisibilityQuestionKeys(config: unknown): string[] {
  const node = getVisibilityNodes(config);
  if (!node) return [];
  const keys = new Set<string>();
  const visit = (current: VisibilityNode) => {
    if ("all" in current) {
      current.all.forEach(visit);
      return;
    }
    if ("any" in current) {
      current.any.forEach(visit);
      return;
    }
    keys.add(current.questionStableKey);
  };
  visit(node);
  return [...keys];
}

export function getVisibleQuestions<T extends VisibilityQuestion>(
  questions: T[],
  answersByQuestionId: Record<string, ApplicabilityAnswerValue | undefined>,
): T[] {
  const acceptedAnswers: Record<string, ApplicabilityAnswerValue> = {};
  const visibleQuestions: T[] = [];

  for (const question of questions) {
    const nodes = getVisibilityNodes(question.config);
    const visible = !nodes || evaluateVisibility(nodes, acceptedAnswers, questions);

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

/**
 * Filters a question's options to the ones that are currently visible.
 *
 * The Betroffenheitscheck wizard shows one `bc.activity` question whose
 * options are grouped into sectors; the visible sections follow the sectors
 * selected in `bc.sector` (or the digital section for the cross-border
 * provider route where the sector question is skipped).
 */
export function getVisibleOptions<T extends VisibilityQuestion>(
  questions: T[],
  question: T,
  answersByQuestionId: Record<string, ApplicabilityAnswerValue | undefined>,
): T["options"] {
  const config = isRecord(question.config) ? question.config : null;
  const optionVisibility = isRecord(config?.optionVisibility)
    ? config.optionVisibility
    : null;
  if (!optionVisibility || !question.options) return question.options;

  const attribute =
    typeof optionVisibility.attribute === "string"
      ? optionVisibility.attribute
      : null;
  const sourceStableKey =
    typeof optionVisibility.questionStableKey === "string"
      ? optionVisibility.questionStableKey
      : null;
  if (!attribute || !sourceStableKey) return question.options;

  const sourceQuestion = questions.find(
    (candidate) => candidate.stableKey === sourceStableKey,
  );
  const sourceAnswer = sourceQuestion
    ? answersByQuestionId[sourceQuestion.id]
    : undefined;
  const selectedValues = Array.isArray(sourceAnswer)
    ? new Set(sourceAnswer)
    : typeof sourceAnswer === "string"
      ? new Set([sourceAnswer])
      : new Set<string>();

  if (selectedValues.size === 0) {
    const fallback = Array.isArray(optionVisibility.fallbackValues)
      ? optionVisibility.fallbackValues.filter(
          (value): value is string => typeof value === "string",
        )
      : [];
    if (fallback.length === 0) return question.options;
    for (const value of fallback) selectedValues.add(value);
  }

  return question.options.filter((option) => {
    const metadata = isRecord(option.metadata) ? option.metadata : {};
    const value = metadata[attribute];
    return typeof value === "string" && selectedValues.has(value);
  });
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
  const nodes = getVisibilityNodes(config);
  if (!nodes) return null;
  return toSimpleCondition(nodes);
}

function getVisibilityNodes(config: unknown): VisibilityNode | null {
  if (!isRecord(config) || !isRecord(config.visibleWhen)) {
    return null;
  }
  return parseNode(config.visibleWhen);
}

function parseNode(value: unknown): VisibilityNode | null {
  if (!isRecord(value)) return null;
  if (typeof value.questionStableKey === "string") {
    if (
      typeof value.operator !== "string" ||
      !["equals", "in", "contains_any", "route_in"].includes(value.operator)
    ) {
      return null;
    }
    return {
      questionStableKey: value.questionStableKey,
      operator: value.operator as VisibilityCondition["operator"],
      value: typeof value.value === "string" ? value.value : undefined,
      values: Array.isArray(value.values)
        ? value.values.filter((item): item is string => typeof item === "string")
        : undefined,
    };
  }
  if (Array.isArray(value.all)) {
    const children = value.all
      .map(parseNode)
      .filter((node): node is VisibilityNode => Boolean(node));
    return children.length === value.all.length ? { all: children } : null;
  }
  if (Array.isArray(value.any)) {
    const children = value.any
      .map(parseNode)
      .filter((node): node is VisibilityNode => Boolean(node));
    return children.length === value.any.length ? { any: children } : null;
  }
  return null;
}

function evaluateVisibility(
  node: VisibilityNode,
  answers: Record<string, ApplicabilityAnswerValue>,
  questions: VisibilityQuestion[],
): boolean {
  if ("all" in node) {
    return node.all.every((child) => evaluateVisibility(child, answers, questions));
  }
  if ("any" in node) {
    return node.any.some((child) => evaluateVisibility(child, answers, questions));
  }

  return evaluateCondition(node, answers, questions);
}

function evaluateCondition(
  condition: VisibilityCondition,
  answers: Record<string, ApplicabilityAnswerValue>,
  questions: VisibilityQuestion[],
): boolean {
  const answer = answers[condition.questionStableKey];

  if (condition.operator === "equals") {
    return typeof answer === "string" && answer === condition.value;
  }

  const expected = condition.values ?? [];
  if (condition.operator === "in") {
    return typeof answer === "string" && expected.includes(answer);
  }

  if (condition.operator === "route_in") {
    if (!Array.isArray(answer)) return false;
    const question = questions.find(
      (candidate) => candidate.stableKey === condition.questionStableKey,
    );
    const options = question?.options ?? [];
    return answer.some((selectedValue) =>
      options.some((option) => {
        if (option.stableValue !== selectedValue) return false;
        const metadata = isRecord(option.metadata) ? option.metadata : {};
        return typeof metadata.route === "string" && expected.includes(metadata.route);
      }),
    );
  }

  return Array.isArray(answer) && answer.some((value) => expected.includes(value));
}

function toSimpleCondition(node: VisibilityNode): VisibilityCondition | null {
  if ("all" in node) {
    const children = node.all.map(toSimpleCondition);
    if (children.length !== 1) return null;
    return children[0];
  }
  if ("any" in node) return null;
  return node;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
