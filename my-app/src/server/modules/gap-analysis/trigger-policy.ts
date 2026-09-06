import {
  evaluateGapCategory,
  type DeterministicGapStatus,
  type GapAnswerValue,
} from "./deterministic-evaluator";

export type AtomicGapTriggerQuestion = {
  stableKey: string;
  text: string;
  stableValue: GapAnswerValue;
  legalProvisions: Array<{
    id: string;
    key: string;
    provisionCode: string;
  }>;
};

export type AtomicGapTrigger = AtomicGapTriggerQuestion & {
  preferredLegalProvisionIds: string[];
  preferredLegalProvisionKeys: string[];
};

export type AtomicGapTriggerPolicy = {
  triggeringQuestions: AtomicGapTrigger[];
  satisfiedQuestions: AtomicGapTriggerQuestion[];
  satisfiedQuestionStableKeys: string[];
  preferredLegalProvisionIds: string[];
  preferredLegalProvisionKeys: string[];
};

export function deriveAtomicGapTriggerPolicy(input: {
  determinedStatus: DeterministicGapStatus;
  questions: AtomicGapTriggerQuestion[];
}): AtomicGapTriggerPolicy {
  assertQuestionSet(input.questions);
  const evaluatedStatus = evaluateGapCategory(
    input.questions.map((question) => question.stableValue),
  );
  if (evaluatedStatus !== input.determinedStatus) {
    throw new Error(
      `Determined status ${input.determinedStatus} conflicts with ${evaluatedStatus}`,
    );
  }

  const allNotApplicable = input.questions.every(
    (question) => question.stableValue === "not_applicable",
  );
  const triggeringQuestions = input.questions
    .filter(
      (question) =>
        question.stableValue === "partially_implemented" ||
        question.stableValue === "not_implemented" ||
        question.stableValue === "unsure" ||
        (allNotApplicable && question.stableValue === "not_applicable"),
    )
    .map(makeTrigger);
  const satisfiedQuestionStableKeys = input.questions
    .filter((question) => question.stableValue === "fully_implemented")
    .map((question) => question.stableKey);

  return buildPolicy({
    determinedStatus: input.determinedStatus,
    questions: input.questions,
    triggeringQuestions,
    satisfiedQuestionStableKeys,
  });
}

export function deriveCorrectedAtomicGapTriggerPolicy(input: {
  determinedStatus: DeterministicGapStatus;
  questions: AtomicGapTriggerQuestion[];
  correctionReason: string;
}): AtomicGapTriggerPolicy {
  const evaluatedStatus = evaluateGapCategory(
    input.questions.map((question) => question.stableValue),
  );
  if (evaluatedStatus === input.determinedStatus) {
    return deriveAtomicGapTriggerPolicy(input);
  }

  const reason = input.correctionReason.trim();
  if (!reason) {
    throw new Error("A corrected atomic Gap policy requires a reason");
  }
  assertQuestionSet(input.questions);

  if (input.determinedStatus === "fulfilled") {
    return buildPolicy({
      determinedStatus: input.determinedStatus,
      questions: input.questions,
      triggeringQuestions: [],
      satisfiedQuestionStableKeys: input.questions.map(
        (question) => question.stableKey,
      ),
    });
  }

  const selectedQuestion = selectCorrectedQuestion(input.questions, reason);
  const correctedAnswerValue: GapAnswerValue =
    input.determinedStatus === "not_fulfilled"
      ? "not_implemented"
      : input.determinedStatus === "partially_fulfilled"
        ? "partially_implemented"
        : "unsure";

  return buildPolicy({
    determinedStatus: input.determinedStatus,
    questions: input.questions,
    triggeringQuestions: [
      makeTrigger({
        ...selectedQuestion,
        stableValue: correctedAnswerValue,
      }),
    ],
    satisfiedQuestionStableKeys: input.questions
      .filter(
        (question) =>
          question.stableKey !== selectedQuestion.stableKey &&
          question.stableValue === "fully_implemented",
      )
      .map((question) => question.stableKey),
  });
}

function buildPolicy(input: {
  determinedStatus: DeterministicGapStatus;
  questions: AtomicGapTriggerQuestion[];
  triggeringQuestions: AtomicGapTrigger[];
  satisfiedQuestionStableKeys: string[];
}): AtomicGapTriggerPolicy {
  const legalBasisQuestions =
    input.determinedStatus === "fulfilled"
      ? input.questions
      : input.triggeringQuestions;
  const preferredLegalProvisionIds = uniqueOrdered(
    legalBasisQuestions.flatMap((question) =>
      question.legalProvisions.map((provision) => provision.id),
    ),
  );
  const preferredLegalProvisionKeys = uniqueOrdered(
    legalBasisQuestions.flatMap((question) =>
      question.legalProvisions.map((provision) => provision.key),
    ),
  );
  if (preferredLegalProvisionIds.length === 0) {
    throw new Error("Atomic Gap policy has no mapped legal provision");
  }

  return {
    triggeringQuestions: input.triggeringQuestions,
    satisfiedQuestions: input.questions
      .filter((question) =>
        input.satisfiedQuestionStableKeys.includes(question.stableKey),
      )
      .map(cloneQuestion),
    satisfiedQuestionStableKeys: input.satisfiedQuestionStableKeys,
    preferredLegalProvisionIds,
    preferredLegalProvisionKeys,
  };
}

function assertQuestionSet(questions: AtomicGapTriggerQuestion[]) {
  if (questions.length === 0) {
    throw new Error("An atomic Gap policy requires at least one question");
  }
  const stableKeys = questions.map((question) => question.stableKey);
  if (
    stableKeys.some((stableKey) => !stableKey.trim()) ||
    new Set(stableKeys).size !== stableKeys.length
  ) {
    throw new Error("Atomic Gap question keys must be nonblank and unique");
  }
}

function selectCorrectedQuestion(
  questions: AtomicGapTriggerQuestion[],
  reason: string,
) {
  const reasonTokens = tokens(reason);
  const ranked = questions
    .map((question, position) => ({
      question,
      position,
      score: [...tokens(`${question.stableKey} ${question.text}`)].filter(
        (token) => reasonTokens.has(token),
      ).length,
    }))
    .sort(
      (left, right) =>
        right.score - left.score || left.position - right.position,
    );
  if (!ranked[0]?.score) {
    throw new Error(
      "Correction reason must identify an affected requirement question",
    );
  }
  return ranked[0].question;
}

function makeTrigger(question: AtomicGapTriggerQuestion): AtomicGapTrigger {
  return {
    ...cloneQuestion(question),
    preferredLegalProvisionIds: uniqueOrdered(
      question.legalProvisions.map((provision) => provision.id),
    ),
    preferredLegalProvisionKeys: uniqueOrdered(
      question.legalProvisions.map((provision) => provision.key),
    ),
  };
}

function cloneQuestion(
  question: AtomicGapTriggerQuestion,
): AtomicGapTriggerQuestion {
  return {
    ...question,
    legalProvisions: question.legalProvisions.map((item) => ({ ...item })),
  };
}

function uniqueOrdered(values: string[]) {
  return [...new Set(values)];
}

function tokens(value: string) {
  return new Set(
    value
      .normalize("NFKD")
      .toLocaleLowerCase("en")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= 3),
  );
}
