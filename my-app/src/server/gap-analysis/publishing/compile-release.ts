import { contentHash } from "@/src/server/compliance/domain";
import { GAP_PROMPT_TEMPLATE_HASH } from "../prompt-contract";
import { GAP_PROMPT_V2_TEMPLATE_HASH } from "../prompt-contract-v2";
import { GAP_PROMPT_V5_TEMPLATE_HASH } from "../prompt-contract-v5";
import { GAP_PROMPT_V6_TEMPLATE_HASH } from "../prompt-contract-v6";
import type { GapAnalysisReleaseDefinition } from "../releases/types";

export function compileGapAnalysisRelease(
  release: GapAnalysisReleaseDefinition,
) {
  const errors: string[] = [];
  requireNonEmpty(release.releaseCode, "release code", errors);
  requireNonEmpty(release.versionLabel, "version label", errors);
  requireNonEmpty(release.compatibleCheck.checkCode, "compatible check code", errors);
  unique(release.requiredCorpusFamilies, "required corpus family", errors);
  if (release.requiredCorpusFamilies.length === 0) errors.push("At least one corpus family is required");
  if (
    ![
      GAP_PROMPT_V2_TEMPLATE_HASH,
      GAP_PROMPT_TEMPLATE_HASH,
      GAP_PROMPT_V5_TEMPLATE_HASH,
      GAP_PROMPT_V6_TEMPLATE_HASH,
    ].includes(
      release.prompt.templateHash,
    )
  ) {
    errors.push("Prompt template hash does not match the code-defined prompt");
  }
  requireLocalizedText(release.title, "module title", errors);
  requireLocalizedText(
    release.questionnaire.title,
    "questionnaire title",
    errors,
  );
  requireLocalizedText(
    release.requirementSet.title,
    "requirement-set title",
    errors,
  );

  unique(
    release.questionnaire.questions.map((question) => question.stableKey),
    "question stable key",
    errors,
  );
  unique(
    release.questionnaire.questions.map((question) => String(question.position)),
    "question position",
    errors,
  );
  const questionKeys = new Set(
    release.questionnaire.questions.map((question) => question.stableKey),
  );
  for (const question of release.questionnaire.questions) {
    requireLocalizedText(question.text, `question ${question.stableKey}`, errors);
    requireLocalizedText(
      question.help,
      `question ${question.stableKey} help`,
      errors,
    );
    if (!question.required) errors.push(`Question ${question.stableKey} must be required`);
    if (question.options.length < 2) {
      errors.push(`Question ${question.stableKey} requires at least two options`);
    }
    unique(
      question.options.map((option) => option.stableValue),
      `option for ${question.stableKey}`,
      errors,
    );
    unique(
      question.options.map((option) => String(option.position)),
      `option position for ${question.stableKey}`,
      errors,
    );
    for (const option of question.options) {
      requireLocalizedText(
        option.label,
        `option ${question.stableKey}/${option.stableValue}`,
        errors,
      );
    }
    if (question.legalProvisionKeys) {
      unique(
        question.legalProvisionKeys,
        `legal provision for ${question.stableKey}`,
        errors,
      );
    }
  }

  const requirements = release.requirementSet.requirements;
  unique(requirements.map((item) => item.code), "requirement code", errors);
  unique(
    requirements.map((item) => String(item.position)),
    "requirement position",
    errors,
  );
  const mappedQuestions = new Set<string>();
  const mappingCount = new Map<string, number>();
  for (const requirement of requirements) {
    requireLocalizedText(
      requirement.title,
      `requirement ${requirement.code} title`,
      errors,
    );
    requireLocalizedText(
      requirement.requirementText,
      `requirement ${requirement.code} text`,
      errors,
    );
    for (const reference of requirement.legalReferences ?? []) {
      if (!reference.demoPlaceholder) {
        errors.push(`Requirement ${requirement.code} legal reference is not labeled demo`);
      }
      try {
        if (new URL(reference.url).protocol !== "https:") {
          errors.push(`Requirement ${requirement.code} legal reference must use HTTPS`);
        }
      } catch {
        errors.push(`Requirement ${requirement.code} has an invalid legal reference URL`);
      }
    }
    if (requirement.questionStableKeys.length === 0) {
      errors.push(`Requirement ${requirement.code} has no question mapping`);
    }
    for (const key of requirement.questionStableKeys) {
      if (!questionKeys.has(key)) {
        errors.push(`Requirement ${requirement.code} maps unknown question ${key}`);
      }
      mappedQuestions.add(key);
      mappingCount.set(key, (mappingCount.get(key) ?? 0) + 1);
    }
    if (requirement.applicableOutcomeCodes.length === 0) {
      errors.push(`Requirement ${requirement.code} has no applicability coverage`);
    }
  }
  for (const key of questionKeys) {
    if (!mappedQuestions.has(key)) errors.push(`Question ${key} is not mapped`);
    if ((mappingCount.get(key) ?? 0) > 1) {
      errors.push(`Question ${key} is mapped more than once`);
    }
  }

  const guidedContract = getSupportedGuidedReleaseContract(
    release.releaseCode,
    release.versionLabel,
  );
  if (guidedContract) {
    validateSupportedGuidedRelease(
      release,
      mappingCount,
      guidedContract,
      errors,
    );
  }

  if (errors.length > 0) {
    throw new Error(`Invalid gap-analysis release:\n- ${errors.join("\n- ")}`);
  }

  const requirementHashes = Object.fromEntries(
    requirements.map((requirement) => [
      requirement.code,
      contentHash(requirement),
    ]),
  );
  const requirementSetHash = contentHash({
    code: release.requirementSet.code,
    title: release.requirementSet.title,
    versionLabel: release.requirementSet.versionLabel,
    members: requirements.map((requirement) => ({
      code: requirement.code,
      position: requirement.position,
      contentHash: requirementHashes[requirement.code],
    })),
  });
  const questionnaireHash = contentHash(release.questionnaire);
  const aggregateHash = contentHash({
    ...release,
    requirementHashes,
    requirementSetHash,
    questionnaireHash,
  });

  return {
    release,
    hashes: {
      aggregate: aggregateHash,
      questionnaire: questionnaireHash,
      requirementSet: requirementSetHash,
      requirements: requirementHashes,
    },
  };
}

const guidedOptionValues = [
  "fully_implemented",
  "partially_implemented",
  "not_implemented",
  "unsure",
  "not_applicable",
];

const priorityRank = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
} as const;

export type SupportedGuidedReleaseContract = {
  releaseCode: "nis2-gap";
  versionLabel: "guided-v4" | "guided-v5";
  questionCount: 31;
  requirementCount: 10;
  optionValues: readonly string[];
  evaluatorKind: "nis2_gap_category_v1";
  evaluatorVersion: 1;
  promptVersion: "5" | "6";
  responseSchemaVersion: "5" | "6";
};

const supportedGuidedReleaseContracts = {
  "nis2-gap/guided-v4": {
    releaseCode: "nis2-gap",
    versionLabel: "guided-v4",
    questionCount: 31,
    requirementCount: 10,
    optionValues: guidedOptionValues,
    evaluatorKind: "nis2_gap_category_v1",
    evaluatorVersion: 1,
    promptVersion: "5",
    responseSchemaVersion: "5",
  },
  "nis2-gap/guided-v5": {
    releaseCode: "nis2-gap",
    versionLabel: "guided-v5",
    questionCount: 31,
    requirementCount: 10,
    optionValues: guidedOptionValues,
    evaluatorKind: "nis2_gap_category_v1",
    evaluatorVersion: 1,
    promptVersion: "6",
    responseSchemaVersion: "6",
  },
} as const satisfies Record<string, SupportedGuidedReleaseContract>;

export function getSupportedGuidedReleaseContract(
  releaseCode: string,
  versionLabel: string,
): SupportedGuidedReleaseContract | null {
  return (
    supportedGuidedReleaseContracts[
      `${releaseCode}/${versionLabel}` as keyof typeof supportedGuidedReleaseContracts
    ] ?? null
  );
}

function validateSupportedGuidedRelease(
  release: GapAnalysisReleaseDefinition,
  mappingCount: Map<string, number>,
  contract: SupportedGuidedReleaseContract,
  errors: string[],
) {
  const questions = release.questionnaire.questions;
  const requirements = release.requirementSet.requirements;
  const label = contract.versionLabel;
  if (questions.length !== contract.questionCount) {
    errors.push(`${label} must have exactly ${contract.questionCount} questions`);
  }
  if (requirements.length !== contract.requirementCount) {
    errors.push(`${label} must have exactly ${contract.requirementCount} requirements`);
  }
  if (
    release.prompt.version !== contract.promptVersion ||
    release.prompt.responseSchemaVersion !==
      contract.responseSchemaVersion ||
    release.evaluator.kind !== contract.evaluatorKind ||
    release.evaluator.version !== contract.evaluatorVersion
  ) {
    errors.push(`${label} prompt or evaluator contract is invalid`);
  }
  unique(
    questions.map((question) => String(question.sourceNumber)),
    `${label} source number`,
    errors,
  );
  const sourceNumbers = questions
    .map((question) => question.sourceNumber)
    .sort((left, right) => (left ?? 0) - (right ?? 0));
  if (
    sourceNumbers.some((number, index) => number !== index + 1)
  ) {
    errors.push(`${label} source numbers must cover 1 through 31 exactly`);
  }
  for (const question of questions) {
    if (
      question.options.map((option) => option.stableValue).join("|") !==
      contract.optionValues.join("|")
    ) {
      errors.push(
        `Question ${question.stableKey} does not use the ${label} option contract`,
      );
    }
    if (!question.legalProvisionKeys?.length) {
      errors.push(`Question ${question.stableKey} has no legal provision`);
    }
    if ((mappingCount.get(question.stableKey) ?? 0) !== 1) {
      errors.push(`Question ${question.stableKey} must map exactly once`);
    }
    if (!question.sourcePriority) {
      errors.push(`Question ${question.stableKey} has no source priority`);
    }
  }
  const questionByKey = new Map(
    questions.map((question) => [question.stableKey, question]),
  );
  for (const requirement of requirements) {
    const priorities = requirement.questionStableKeys.flatMap((key) => {
      const priority = questionByKey.get(key)?.sourcePriority;
      return priority ? [priority] : [];
    });
    const highest = priorities.sort(
      (left, right) => priorityRank[right] - priorityRank[left],
    )[0];
    if (highest && requirement.criticality !== highest) {
      errors.push(
        `Requirement ${requirement.code} criticality must equal ${highest}`,
      );
    }
    const outcomes = new Set(requirement.applicableOutcomeCodes);
    if (
      !outcomes.has("essential_entity") ||
      !outcomes.has("important_entity")
    ) {
      errors.push(
        `Requirement ${requirement.code} must cover both applicable outcomes`,
      );
    }
  }
}

function unique(values: string[], label: string, errors: string[]) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) errors.push(`Duplicate ${label} ${value}`);
    seen.add(value);
  }
}

function requireNonEmpty(value: string, label: string, errors: string[]) {
  if (!value.trim()) errors.push(`Missing ${label}`);
}

function requireLocalizedText(
  value: { de: string; en: string },
  label: string,
  errors: string[],
) {
  for (const locale of ["de", "en"] as const) {
    if (!value[locale]?.trim()) errors.push(`Missing ${locale} ${label}`);
  }
}
