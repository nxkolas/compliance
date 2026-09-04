import type {
  GapAnalysisReleaseDefinition,
  LocalizedText,
} from "../releases/types";

export function requirementContentKeys(
  definition: Pick<GapAnalysisReleaseDefinition, "releaseCode">,
  requirementCode: string,
) {
  const prefix = `${definition.releaseCode}.requirement.${requirementCode}`;
  return {
    title: `${prefix}.title`,
    text: `${prefix}.text`,
  };
}

export function requirementContentSources(
  definition: GapAnalysisReleaseDefinition,
) {
  return definition.requirementSet.requirements.flatMap((requirement) => {
    const keys = requirementContentKeys(definition, requirement.code);
    return [
      { key: keys.title, translations: requirement.title },
      { key: keys.text, translations: requirement.requirementText },
    ];
  });
}

export function assertExactBilingualTranslations(
  key: string,
  expected: LocalizedText,
  actual: Array<{ locale: string; value: string }>,
) {
  const byLocale = new Map(actual.map((row) => [row.locale, row.value]));
  if (
    actual.length !== 2 ||
    byLocale.size !== 2 ||
    byLocale.get("de") !== expected.de ||
    byLocale.get("en") !== expected.en
  ) {
    throw new Error(
      `Content revision ${key} does not contain the exact de and en translations`,
    );
  }
}

export function assertRequirementContentPins(
  identity: string,
  existing: {
    titleContentRevisionId: string;
    requirementTextContentRevisionId: string;
  },
  expected: {
    titleContentRevisionId: string;
    requirementTextContentRevisionId: string;
  },
) {
  if (
    existing.titleContentRevisionId !== expected.titleContentRevisionId ||
    existing.requirementTextContentRevisionId !==
      expected.requirementTextContentRevisionId
  ) {
    throw new Error(
      `Requirement ${identity} already exists with conflicting content revision pins`,
    );
  }
}
