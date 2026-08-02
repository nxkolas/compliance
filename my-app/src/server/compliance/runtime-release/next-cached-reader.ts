import { unstable_cache } from "next/cache";
import { createRuntimeReleaseReader } from "./direct-reader";
import {
  CURRENT_APPLICABILITY_CHECK_CODE,
  currentApplicabilityDefinition,
  currentApplicabilityDefinitionHash,
  getCurrentApplicabilityDefinition,
} from "@/src/server/definitions/applicability";

const loadCachedPublished = unstable_cache(
  async (checkReleaseId: string, locale: "de" | "en") => {
    const release =
      checkReleaseId === currentApplicabilityDefinitionHash
        ? getCurrentApplicabilityDefinition(locale)
        : null;
    if (!release) {
      throw new PublishedReleaseNotFoundError(checkReleaseId);
    }
    return release;
  },
  ["code-owned-applicability-definition"],
  { revalidate: false },
);

class PublishedReleaseNotFoundError extends Error {
  constructor(checkReleaseId: string) {
    super(`Published compliance release ${checkReleaseId} is unavailable`);
  }
}

export const nextCachedRuntimeReleaseReader = createRuntimeReleaseReader({
  async loadPublished({ checkReleaseId, locale }) {
    try {
      return await loadCachedPublished(checkReleaseId, locale);
    } catch (error) {
      if (error instanceof PublishedReleaseNotFoundError) return null;
      throw error;
    }
  },
  loadActivePointer: async (checkCode) =>
    checkCode === CURRENT_APPLICABILITY_CHECK_CODE
      ? {
          checkCode,
          checkReleaseId: currentApplicabilityDefinitionHash,
          versionLabel: currentApplicabilityDefinition.versionLabel,
        }
      : null,
});
