import { unstable_cache } from "next/cache";
import { assemblePublishedComplianceRelease } from "./postgres-assembler";
import { createRuntimeReleaseReader } from "./direct-reader";
import { loadActiveReleasePointer } from "./postgres-assembler";

const loadCachedPublished = unstable_cache(
  async (checkReleaseId: string, locale: "de" | "en") => {
    const release = await assemblePublishedComplianceRelease(
      checkReleaseId,
      locale,
    );
    if (!release) {
      throw new PublishedReleaseNotFoundError(checkReleaseId);
    }
    return release;
  },
  ["published-compliance-release"],
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
  loadActivePointer: loadActiveReleasePointer,
});
