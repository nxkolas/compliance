import { contentHash } from "@/src/server/compliance/domain";
import type { GapAnalysisReleaseDefinition } from "../releases/types";

export function compileGapAnalysisRelease(
  release: GapAnalysisReleaseDefinition,
) {
  const errors: string[] = [];
  requireNonEmpty(release.releaseCode, "release code", errors);
  requireNonEmpty(release.versionLabel, "version label", errors);
  requireNonEmpty(
    release.compatibleCheck.checkCode,
    "compatible check code",
    errors,
  );
  unique(release.requiredCorpusFamilies, "required corpus family", errors);
  if (release.requiredCorpusFamilies.length === 0)
    errors.push("At least one corpus family is required");
  requirePromptMetadata(release.prompt, "Gap prompt", errors);
  if (!release.actionPlanPrompt) errors.push("Action Plan prompt is required");
  else requirePromptMetadata(release.actionPlanPrompt, "Action Plan prompt", errors);
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
    release.questionnaire.questions.map((question) =>
      String(question.position),
    ),
    "question position",
    errors,
  );
  const questionKeys = new Set(
    release.questionnaire.questions.map((question) => question.stableKey),
  );
  for (const question of release.questionnaire.questions) {
    requireLocalizedText(
      question.text,
      `question ${question.stableKey}`,
      errors,
    );
    requireLocalizedText(
      question.help,
      `question ${question.stableKey} help`,
      errors,
    );
    if (!question.required)
      errors.push(`Question ${question.stableKey} must be required`);
    if (question.options.length < 2) {
      errors.push(
        `Question ${question.stableKey} requires at least two options`,
      );
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
    if (
      question.splittable &&
      (!Number.isInteger(question.maximumStatements) ||
        (question.maximumStatements ?? 0) < 2 ||
        (question.maximumStatements ?? 0) > 5)
    ) {
      errors.push(
        `Question ${question.stableKey} has an invalid splittable statement bound`,
      );
    }
  }

  const requirements = release.requirementSet.requirements;
  unique(
    requirements.map((item) => item.code),
    "requirement code",
    errors,
  );
  unique(
    requirements.map((item) => String(item.position)),
    "requirement position",
    errors,
  );
  const mappedQuestions = new Set<string>();
  const mappingCount = new Map<string, number>();
  for (const requirement of requirements) {
    requireNonEmpty(
      requirement.icon,
      `requirement ${requirement.code} icon`,
      errors,
    );
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
        errors.push(
          `Requirement ${requirement.code} legal reference is not labeled demo`,
        );
      }
      try {
        if (new URL(reference.url).protocol !== "https:") {
          errors.push(
            `Requirement ${requirement.code} legal reference must use HTTPS`,
          );
        }
      } catch {
        errors.push(
          `Requirement ${requirement.code} has an invalid legal reference URL`,
        );
      }
    }
    if (requirement.questionStableKeys.length === 0) {
      errors.push(`Requirement ${requirement.code} has no question mapping`);
    }
    for (const key of requirement.questionStableKeys) {
      if (!questionKeys.has(key)) {
        errors.push(
          `Requirement ${requirement.code} maps unknown question ${key}`,
        );
      }
      mappedQuestions.add(key);
      mappingCount.set(key, (mappingCount.get(key) ?? 0) + 1);
    }
    if (requirement.applicableOutcomeCodes.length === 0) {
      errors.push(
        `Requirement ${requirement.code} has no applicability coverage`,
      );
    }
  }
  for (const key of questionKeys) {
    if (!mappedQuestions.has(key)) errors.push(`Question ${key} is not mapped`);
    if ((mappingCount.get(key) ?? 0) > 1) {
      errors.push(`Question ${key} is mapped more than once`);
    }
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

function requirePromptMetadata(
  prompt: {
    name: string;
    version: string;
    templateHash: string;
    responseSchemaVersion: string;
  },
  label: string,
  errors: string[],
) {
  requireNonEmpty(prompt.name, `${label} name`, errors);
  requireNonEmpty(prompt.version, `${label} version`, errors);
  requireNonEmpty(prompt.responseSchemaVersion, `${label} response schema version`, errors);
  if (!/^[a-f0-9]{64}$/u.test(prompt.templateHash)) {
    errors.push(`${label} template hash is invalid`);
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
