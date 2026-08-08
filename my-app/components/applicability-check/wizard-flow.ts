import type { ApplicabilityAnswerValue } from "@/src/server/applicability-check/question-visibility";
import type { ApplicabilityQuestionDto } from "@/src/server/applicability-check/service";

export type ActivityRoute = "E" | "I" | "T" | "A1" | "A2" | "R" | "NO";

export type WizardActivityState =
  | ActivityRoute
  | "UNSURE"
  | "NO_MATCH";

const TERMINAL_GERMANY_CONNECTION_VALUES = [
  "de_critical_installation",
  "de_federal_administration",
  "de_regional_administration",
  "none",
  "unsure",
];

const TERMINAL_SPECIAL_STATUS_VALUES = [
  "de_critical_installation",
  "essential_or_cer",
  "unsure",
];

/**
 * Strongest applicable route of the selected Q4 activities, mirroring the
 * evaluator precedence. Domain-name registration forces clarification in the
 * evaluator (unresolved domain-registration classification), so it wins here
 * as well. Any "I'm not sure" selection also ends in clarification.
 */
export function getActivityState(
  questions: ApplicabilityQuestionDto[],
  answers: Record<string, ApplicabilityAnswerValue | undefined>,
): WizardActivityState {
  const activityQuestion = questions.find(
    (question) => question.stableKey === "bc.activity",
  );
  const germanyConnection = stringAnswer(
    questions.find((question) => question.stableKey === "bc.germany_connection"),
    answers,
  );
  const answer = activityQuestion ? answers[activityQuestion.id] : undefined;

  if (!activityQuestion || !Array.isArray(answer) || answer.length === 0) {
    if (germanyConnection === "de_telecom_provider") return "T";
    return "NO_MATCH";
  }

  const selectedOptions = answer
    .map((value) =>
      activityQuestion.options.find((option) => option.stableValue === value),
    )
    .filter((option): option is ApplicabilityQuestionDto["options"][number] =>
      Boolean(option),
    );

  const kinds = selectedOptions.map((option) =>
    readMetadata(option.metadata).kind,
  );
  if (kinds.includes("unsure")) return "UNSURE";

  const routes = selectedOptions
    .filter((option) => readMetadata(option.metadata).kind === "activity")
    .map((option) => readMetadata(option.metadata).route)
    .filter((route): route is ActivityRoute =>
      ["E", "I", "T", "A1", "A2", "R"].includes(String(route)),
    );

  for (const route of ["R", "E", "I", "T", "A1", "A2"] as const) {
    if (routes.includes(route)) return route;
  }

  if (kinds.some((kind) => kind === "none")) return "NO";
  return "NO_MATCH";
}

export function getWizardSize(
  questions: ApplicabilityQuestionDto[],
  answers: Record<string, ApplicabilityAnswerValue | undefined>,
): "large" | "medium" | "small" | "unknown" {
  const employees = bucketAnswer(questions, answers, "bc.employee_count");
  const revenue = bucketAnswer(questions, answers, "bc.annual_revenue");
  const balance = bucketAnswer(questions, answers, "bc.balance_sheet_total");
  if (
    !employees ||
    !revenue ||
    !balance ||
    employees === "unsure" ||
    revenue === "unsure" ||
    balance === "unsure"
  ) {
    return "unknown";
  }

  const large =
    employees === "250_plus" ||
    (revenue === "revenue_over_50m" && balance === "balance_over_43m");
  if (large) return "large";

  const medium =
    employees === "50_249" ||
    (["revenue_over_10m_to_50m", "revenue_over_50m"].includes(revenue) &&
      ["balance_over_10m_to_43m", "balance_over_43m"].includes(balance));
  return medium ? "medium" : "small";
}

/**
 * Decides whether the wizard can submit directly after the given step or must
 * advance to the next question. Terminal END routes and the Q6 size-skip
 * table from the plan are encoded here; the evaluator is never short-circuited
 * because submission always writes the equivalent facts.
 */
export function shouldSubmitAfter(
  questionStableKey: string,
  answers: Record<string, ApplicabilityAnswerValue | undefined>,
  questions: ApplicabilityQuestionDto[],
): boolean {
  if (questionStableKey === "bc.germany_connection") {
    const value = stringAnswer(
      questions.find((question) => question.stableKey === questionStableKey),
      answers,
    );
    return TERMINAL_GERMANY_CONNECTION_VALUES.includes(value ?? "");
  }

  if (questionStableKey === "bc.special_status") {
    const value = stringAnswer(
      questions.find((question) => question.stableKey === questionStableKey),
      answers,
    );
    return TERMINAL_SPECIAL_STATUS_VALUES.includes(value ?? "");
  }

  if (questionStableKey === "bc.sector") {
    const value = stringAnswer(
      questions.find((question) => question.stableKey === questionStableKey),
      answers,
    );
    return value === "none_of_these" || value === "unsure";
  }

  if (questionStableKey === "bc.activity") {
    return !["T", "A1", "A2"].includes(getActivityState(questions, answers));
  }

  if (
    questionStableKey === "bc.employee_count" ||
    questionStableKey === "bc.annual_revenue"
  ) {
    return false;
  }

  if (questionStableKey === "bc.balance_sheet_total") {
    return isSizeDecisive(questions, answers);
  }

  return questionStableKey === "bc.aggregation";
}

export function isSizeDecisive(
  questions: ApplicabilityQuestionDto[],
  answers: Record<string, ApplicabilityAnswerValue | undefined>,
): boolean {
  const route = getActivityState(questions, answers);
  if (!["T", "A1", "A2"].includes(route)) return false;
  const size = getWizardSize(questions, answers);
  if (size === "unknown") return false;
  if (route === "T") return size !== "small";
  if (route === "A1") return size === "large";
  return size !== "small";
}

export function aggregationAutoAnswer(): string {
  return "verified_de_without_it_exception";
}

function bucketAnswer(
  questions: ApplicabilityQuestionDto[],
  answers: Record<string, ApplicabilityAnswerValue | undefined>,
  stableKey: string,
): string | null {
  return stringAnswer(
    questions.find((question) => question.stableKey === stableKey),
    answers,
  );
}

function stringAnswer(
  question: ApplicabilityQuestionDto | undefined,
  answers: Record<string, ApplicabilityAnswerValue | undefined>,
): string | null {
  if (!question) return null;
  const value = answers[question.id];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readMetadata(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
