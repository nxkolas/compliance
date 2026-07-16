import { cacheLife } from "next/cache";
import { assemblePublishedComplianceRelease } from "./postgres-assembler";
import { createRuntimeReleaseReader } from "./direct-reader";
import { loadActiveReleasePointer } from "./postgres-assembler";

async function loadCachedPublished(
  checkReleaseId: string,
  locale: "de" | "en",
) {
  "use cache";
  cacheLife("max");
  const release = await assemblePublishedComplianceRelease(
    checkReleaseId,
    locale,
  );
  if (!release) {
    throw new PublishedReleaseNotFoundError(checkReleaseId);
  }
  return release;
}

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
