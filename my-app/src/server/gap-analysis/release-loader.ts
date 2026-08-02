import type { Locale } from "@/lib/i18n-config";
import {
  CURRENT_GAP_DEFINITION_CODE,
  currentGapDefinition,
  currentGapDefinitionHash,
  getCurrentGapDefinition,
} from "@/src/server/definitions/gap";

/**
 * Localized, executable view of the code-owned Gap definition. The legacy
 * release-shaped field names remain temporarily at this module boundary while
 * workflow persistence is cut over to definition hashes.
 */
export type LoadedGapRelease = {
  id: string;
  releaseCode: string;
  versionLabel: string;
  moduleId: string;
  moduleTitle: string;
  questionnaireId: string;
  questionnaireVersionId: string;
  questionnaireTitle: string;
  requirementSetTitle: string;
  compatibleCheckReleaseId: string;
  prompt: {
    name: string;
    version: string;
    templateHash: string;
    responseSchemaVersion: string;
  };
  actionPlanPrompt: {
    name: string;
    version: string;
    templateHash: string;
    responseSchemaVersion: string;
  };
  evaluator: { kind: string; version: number };
  questions: Array<{
    id: string;
    stableKey: string;
    position: number;
    questionText: string;
    helpText: string | null;
    answerType: string;
    required: boolean;
    splittable: boolean;
    maximumStatements: number;
    legalProvisions: Array<{
      id: string;
      key: string;
      provisionCode: string;
      position: number;
    }>;
    options: Array<{
      id: string;
      stableValue: string;
      label: string;
      position: number;
    }>;
  }>;
  requirements: Array<{
    id: string;
    stableRequirementId: string;
    code: string;
    position: number;
    icon: string;
    criticality: "low" | "medium" | "high" | "critical";
    title: string;
    requirementText: string;
    legalReferences: Array<{
      key: string;
      label: string;
      url: string | null;
    }>;
    applicabilityOutcomeCodes: string[];
    questionStableKeys: string[];
  }>;
};

export type GapReleaseReader = {
  getPublished: (input: {
    releaseId: string;
    locale: Locale;
  }) => Promise<LoadedGapRelease | null>;
  getActive: (input: {
    releaseCode: string;
    locale: Locale;
  }) => Promise<LoadedGapRelease | null>;
};

export function createGapReleaseReader(input: {
  loadPublished: GapReleaseReader["getPublished"];
  loadActivePointer: (
    releaseCode: string,
  ) => Promise<{ gapAnalysisReleaseId: string } | null | undefined>;
}): GapReleaseReader {
  return {
    getPublished: input.loadPublished,
    async getActive({ releaseCode, locale }) {
      const pointer = await input.loadActivePointer(releaseCode);
      if (!pointer) return null;
      return input.loadPublished({
        releaseId: pointer.gapAnalysisReleaseId,
        locale,
      });
    },
  };
}

export async function loadActiveGapAnalysisReleasePointer(
  releaseCode: string,
) {
  return releaseCode === CURRENT_GAP_DEFINITION_CODE
    ? {
        releaseCode,
        gapAnalysisReleaseId: currentGapDefinitionHash,
        definitionHash: currentGapDefinitionHash,
        versionLabel: currentGapDefinition.versionLabel,
      }
    : null;
}

export async function loadGapAnalysisRelease(
  releaseId: string,
  locale: Locale,
): Promise<LoadedGapRelease | null> {
  return releaseId === currentGapDefinitionHash
    ? getCurrentGapDefinition(locale)
    : null;
}

export const directGapReleaseReader = createGapReleaseReader({
  loadPublished: ({ releaseId, locale }) =>
    loadGapAnalysisRelease(releaseId, locale),
  loadActivePointer: loadActiveGapAnalysisReleasePointer,
});

export async function getActiveGapAnalysisRelease(
  releaseCode: string,
  locale: Locale,
) {
  return directGapReleaseReader.getActive({ releaseCode, locale });
}
