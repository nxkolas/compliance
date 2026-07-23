import { contentHash } from "../../compliance/publishing/canonical-json";
import { GAP_PROMPT_TEMPLATE_HASH } from "../prompt-contract";
import { GAP_PROMPT_V2_TEMPLATE_HASH } from "../prompt-contract-v2";
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
    ![GAP_PROMPT_V2_TEMPLATE_HASH, GAP_PROMPT_TEMPLATE_HASH].includes(
      release.prompt.templateHash,
    )
  ) {
    errors.push("Prompt template hash does not match the code-defined prompt");
  }
  if (release.modelPolicy.maxRequirementsPerBatch < 1) {
    errors.push("Model policy requires a positive batch size");
  }

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
    if (!question.required) errors.push(`Question ${question.stableKey} must be required`);
    if (question.options.length < 2) {
      errors.push(`Question ${question.stableKey} requires at least two options`);
    }
    unique(
      question.options.map((option) => option.stableValue),
      `option for ${question.stableKey}`,
      errors,
    );
  }

  const requirements = release.requirementSet.requirements;
  unique(requirements.map((item) => item.code), "requirement code", errors);
  unique(
    requirements.map((item) => String(item.position)),
    "requirement position",
    errors,
  );
  const mappedQuestions = new Set<string>();
  for (const requirement of requirements) {
    if (requirement.legalReferences.length === 0) {
      errors.push(`Requirement ${requirement.code} has no legal reference`);
    }
    for (const reference of requirement.legalReferences) {
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
    }
    if (requirement.applicableOutcomeCodes.length === 0) {
      errors.push(`Requirement ${requirement.code} has no applicability coverage`);
    }
  }
  for (const key of questionKeys) {
    if (!mappedQuestions.has(key)) errors.push(`Question ${key} is not mapped`);
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
