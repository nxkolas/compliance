import { contentHash } from "@/src/server/compliance/domain";
import {
  evaluateGapCategory,
  type DeterministicGapStatus,
  type GapAnswerValue,
} from "./deterministic-evaluator";

export type GapGuidanceMode =
  | "maintain_and_document"
  | "control_remediation"
  | "evidence_verification";

export type GapWorkKind = "remediate" | "verify";

export type GapGuidanceQuestion = {
  stableKey: string;
  text: string;
  stableValue: GapAnswerValue;
  legalProvisions: Array<{
    id: string;
    key: string;
    provisionCode: string;
  }>;
};

export type GapGuidanceTrigger = GapGuidanceQuestion & {
  workKind: GapWorkKind;
  preferredLegalProvisionIds: string[];
  preferredLegalProvisionKeys: string[];
};

export type GapGuidanceBasis = {
  version: 1;
  triggeringQuestions: Array<{
    stableKey: string;
    answerValue: GapAnswerValue;
    workKind: GapWorkKind;
    preferredLegalProvisionIds: string[];
    preferredLegalProvisionKeys: string[];
  }>;
  satisfiedQuestionStableKeys: string[];
  humanCorrection?: {
    reasonHash: string;
    selectedQuestionStableKey: string | null;
    originalAnswerValue: GapAnswerValue | null;
    correctedAnswerValue: GapAnswerValue | null;
  };
};

export type GapGuidancePolicy = {
  version: 1;
  guidanceMode: GapGuidanceMode;
  triggeringQuestions: GapGuidanceTrigger[];
  satisfiedQuestions: GapGuidanceQuestion[];
  satisfiedQuestionStableKeys: string[];
  preferredLegalProvisionIds: string[];
  preferredLegalProvisionKeys: string[];
  basis: GapGuidanceBasis;
  hash: string;
};

export function guidanceModeForStatus(
  status: DeterministicGapStatus,
): GapGuidanceMode {
  switch (status) {
    case "fulfilled":
      return "maintain_and_document";
    case "partially_fulfilled":
    case "not_fulfilled":
      return "control_remediation";
    case "insufficient_evidence":
      return "evidence_verification";
  }
}

export function deriveGapGuidancePolicy(input: {
  determinedStatus: DeterministicGapStatus;
  questions: GapGuidanceQuestion[];
}): GapGuidancePolicy {
  if (input.questions.length === 0) {
    throw new Error("A guidance policy requires at least one question");
  }
  const stableKeys = input.questions.map((question) => question.stableKey);
  if (
    stableKeys.some((stableKey) => !stableKey.trim()) ||
    new Set(stableKeys).size !== stableKeys.length
  ) {
    throw new Error("Guidance policy question keys must be nonblank and unique");
  }
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
  const triggeringQuestions = input.questions.flatMap(
    (question): GapGuidanceTrigger[] => {
      const workKind =
        question.stableValue === "partially_implemented" ||
        question.stableValue === "not_implemented"
          ? "remediate"
          : question.stableValue === "unsure" ||
              (allNotApplicable && question.stableValue === "not_applicable")
            ? "verify"
            : null;
      if (!workKind) return [];
      return [
        {
          ...question,
          legalProvisions: question.legalProvisions.map((item) => ({ ...item })),
          workKind,
          preferredLegalProvisionIds: uniqueOrdered(
            question.legalProvisions.map((provision) => provision.id),
          ),
          preferredLegalProvisionKeys: uniqueOrdered(
            question.legalProvisions.map((provision) => provision.key),
          ),
        },
      ];
    },
  );
  const satisfiedQuestionStableKeys = input.questions
    .filter((question) => question.stableValue === "fully_implemented")
    .map((question) => question.stableKey);
  const satisfiedQuestions = input.questions
    .filter((question) =>
      satisfiedQuestionStableKeys.includes(question.stableKey),
    )
    .map(cloneQuestion);
  const legalBasisQuestions =
    input.determinedStatus === "fulfilled"
      ? input.questions
      : triggeringQuestions;
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
    throw new Error("Guidance policy has no mapped legal provision");
  }

  const basis: GapGuidanceBasis = {
    version: 1,
    triggeringQuestions: triggeringQuestions.map((question) => ({
      stableKey: question.stableKey,
      answerValue: question.stableValue,
      workKind: question.workKind,
      preferredLegalProvisionIds: question.preferredLegalProvisionIds,
      preferredLegalProvisionKeys: question.preferredLegalProvisionKeys,
    })),
    satisfiedQuestionStableKeys,
  };
  return {
    version: 1,
    guidanceMode: guidanceModeForStatus(input.determinedStatus),
    triggeringQuestions,
    satisfiedQuestions,
    satisfiedQuestionStableKeys,
    preferredLegalProvisionIds,
    preferredLegalProvisionKeys,
    basis,
    hash: contentHash(basis),
  };
}

export function deriveCorrectedGapGuidancePolicy(input: {
  determinedStatus: DeterministicGapStatus;
  questions: GapGuidanceQuestion[];
  correctionReason: string;
}): GapGuidancePolicy {
  const evaluatedStatus = evaluateGapCategory(
    input.questions.map((question) => question.stableValue),
  );
  if (evaluatedStatus === input.determinedStatus) {
    return deriveGapGuidancePolicy(input);
  }
  const reason = input.correctionReason.trim();
  if (!reason) {
    throw new Error("A corrected guidance policy requires a reason");
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
      humanCorrection: {
        reasonHash: contentHash(reason),
        selectedQuestionStableKey: null,
        originalAnswerValue: null,
        correctedAnswerValue: null,
      },
    });
  }

  const selectedQuestion = selectCorrectedQuestion(
    input.questions,
    reason,
  );
  const correctedAnswerValue: GapAnswerValue =
    input.determinedStatus === "not_fulfilled"
      ? "not_implemented"
      : input.determinedStatus === "partially_fulfilled"
        ? "partially_implemented"
        : "unsure";
  const workKind: GapWorkKind =
    input.determinedStatus === "insufficient_evidence"
      ? "verify"
      : "remediate";
  const trigger = makeTrigger(
    {
      ...selectedQuestion,
      stableValue: correctedAnswerValue,
    },
    workKind,
  );
  return buildPolicy({
    determinedStatus: input.determinedStatus,
    questions: input.questions,
    triggeringQuestions: [trigger],
    satisfiedQuestionStableKeys: input.questions
      .filter(
        (question) =>
          question.stableKey !== selectedQuestion.stableKey &&
          question.stableValue === "fully_implemented",
      )
      .map((question) => question.stableKey),
    humanCorrection: {
      reasonHash: contentHash(reason),
      selectedQuestionStableKey: selectedQuestion.stableKey,
      originalAnswerValue: selectedQuestion.stableValue,
      correctedAnswerValue,
    },
  });
}

function uniqueOrdered(values: string[]) {
  return [...new Set(values)];
}

function assertQuestionSet(questions: GapGuidanceQuestion[]) {
  if (questions.length === 0) {
    throw new Error("A guidance policy requires at least one question");
  }
  const stableKeys = questions.map((question) => question.stableKey);
  if (
    stableKeys.some((stableKey) => !stableKey.trim()) ||
    new Set(stableKeys).size !== stableKeys.length
  ) {
    throw new Error(
      "Guidance policy question keys must be nonblank and unique",
    );
  }
}

function selectCorrectedQuestion(
  questions: GapGuidanceQuestion[],
  reason: string,
) {
  const reasonTokens = tokens(reason);
  const ranked = questions
    .map((question, position) => ({
      question,
      position,
      score: [
        ...tokens(`${question.stableKey} ${question.text}`),
      ].filter((token) => reasonTokens.has(token)).length,
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

function tokens(value: string) {
  return new Set(
    value
      .normalize("NFKD")
      .toLocaleLowerCase("en")
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= 3),
  );
}

function makeTrigger(
  question: GapGuidanceQuestion,
  workKind: GapWorkKind,
): GapGuidanceTrigger {
  return {
    ...question,
    legalProvisions: question.legalProvisions.map((item) => ({ ...item })),
    workKind,
    preferredLegalProvisionIds: uniqueOrdered(
      question.legalProvisions.map((provision) => provision.id),
    ),
    preferredLegalProvisionKeys: uniqueOrdered(
      question.legalProvisions.map((provision) => provision.key),
    ),
  };
}

function buildPolicy(input: {
  determinedStatus: DeterministicGapStatus;
  questions: GapGuidanceQuestion[];
  triggeringQuestions: GapGuidanceTrigger[];
  satisfiedQuestionStableKeys: string[];
  humanCorrection: NonNullable<GapGuidanceBasis["humanCorrection"]>;
}): GapGuidancePolicy {
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
    throw new Error("Guidance policy has no mapped legal provision");
  }
  const basis: GapGuidanceBasis = {
    version: 1,
    triggeringQuestions: input.triggeringQuestions.map((question) => ({
      stableKey: question.stableKey,
      answerValue: question.stableValue,
      workKind: question.workKind,
      preferredLegalProvisionIds: question.preferredLegalProvisionIds,
      preferredLegalProvisionKeys: question.preferredLegalProvisionKeys,
    })),
    satisfiedQuestionStableKeys: input.satisfiedQuestionStableKeys,
    humanCorrection: input.humanCorrection,
  };
  return {
    version: 1,
    guidanceMode: guidanceModeForStatus(input.determinedStatus),
    triggeringQuestions: input.triggeringQuestions,
    satisfiedQuestions: input.questions
      .filter((question) =>
        input.satisfiedQuestionStableKeys.includes(
          question.stableKey,
        ),
      )
      .map(cloneQuestion),
    satisfiedQuestionStableKeys: input.satisfiedQuestionStableKeys,
    preferredLegalProvisionIds,
    preferredLegalProvisionKeys,
    basis,
    hash: contentHash(basis),
  };
}

function cloneQuestion(
  question: GapGuidanceQuestion,
): GapGuidanceQuestion {
  return {
    ...question,
    legalProvisions: question.legalProvisions.map((item) => ({
      ...item,
    })),
  };
}
