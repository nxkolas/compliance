import { unstable_cache } from "next/cache";
import {
  createGapReleaseReader,
  loadActiveGapAnalysisReleasePointer,
  loadGapAnalysisRelease,
} from "./release-loader";
import type { Locale } from "@/lib/i18n-config";

const loadCachedPublishedGapRelease = unstable_cache(
  async (releaseId: string, locale: Locale) => {
    const release = await loadGapAnalysisRelease(releaseId, locale);
    if (!release) {
      throw new PublishedGapReleaseNotFoundError(releaseId);
    }
    return release;
  },
  ["published-gap-analysis-release"],
  { revalidate: false },
);

class PublishedGapReleaseNotFoundError extends Error {
  constructor(releaseId: string) {
    super(`Published Gap-analysis release ${releaseId} is unavailable`);
  }
}

export const nextCachedGapReleaseReader = createGapReleaseReader({
  async loadPublished({ releaseId, locale }) {
    try {
      return await loadCachedPublishedGapRelease(releaseId, locale);
    } catch (error) {
      if (error instanceof PublishedGapReleaseNotFoundError) return null;
      throw error;
    }
  },
  loadActivePointer: loadActiveGapAnalysisReleasePointer,
});
