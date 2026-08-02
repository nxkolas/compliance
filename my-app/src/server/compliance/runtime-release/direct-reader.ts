import {
  CURRENT_APPLICABILITY_CHECK_CODE,
  currentApplicabilityDefinition,
  currentApplicabilityDefinitionHash,
  getCurrentApplicabilityDefinition,
} from "@/src/server/definitions/applicability";
import type {
  ActiveReleasePointer,
  PublishedComplianceRelease,
  RuntimeReleaseReader,
} from "./types";

export function createRuntimeReleaseReader(input: {
  loadPublished: (input: {
    checkReleaseId: string;
    locale: PublishedComplianceRelease["locale"];
  }) => Promise<PublishedComplianceRelease | null>;
  loadActivePointer: (
    checkCode: string,
  ) => Promise<ActiveReleasePointer | null>;
}): RuntimeReleaseReader {
  return {
    getPublished: input.loadPublished,
    getActivePointer: input.loadActivePointer,
    async getActive({ checkCode, locale }) {
      const pointer = await input.loadActivePointer(checkCode);
      if (!pointer) return null;
      const published = await input.loadPublished({
        checkReleaseId: pointer.checkReleaseId,
        locale,
      });
      return published
        ? { published, activePointer: pointer, isActive: true }
        : null;
    },
  };
}

export const directRuntimeReleaseReader = createRuntimeReleaseReader({
  loadPublished: async ({ checkReleaseId, locale }) =>
    checkReleaseId === currentApplicabilityDefinitionHash
      ? getCurrentApplicabilityDefinition(locale)
      : null,
  loadActivePointer: async (checkCode) =>
    checkCode === CURRENT_APPLICABILITY_CHECK_CODE
      ? {
          checkCode: CURRENT_APPLICABILITY_CHECK_CODE,
          checkReleaseId: currentApplicabilityDefinitionHash,
          versionLabel: currentApplicabilityDefinition.versionLabel,
        }
      : null,
});
