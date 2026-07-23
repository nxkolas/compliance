import { cacheLife } from "next/cache";
import {
  createGapReleaseReader,
  loadActiveGapAnalysisReleasePointer,
  loadGapAnalysisRelease,
} from "./release-loader";
import type { Locale } from "@/lib/i18n-config";

async function loadCachedPublishedGapRelease(
  releaseId: string,
  locale: Locale,
) {
  "use cache";
  cacheLife("max");
  const release = await loadGapAnalysisRelease(releaseId, locale);
  if (!release) {
    throw new PublishedGapReleaseNotFoundError(releaseId);
  }
  return release;
}

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
